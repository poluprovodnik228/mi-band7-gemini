import { MessageBuilder } from '../shared/message'

// Фоновый сервис-компаньон для смартфона (Zepp OS Side Service)
// Пересылает запросы с браслета в Gemini API и возвращает ответ

const messageBuilder = new MessageBuilder()

// Вставьте сюда ваш API-ключ (от Google AI Studio или OpenRouter)
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"

// Если используете OpenRouter, укажите true
const USE_OPENROUTER = false
const OPENROUTER_API_KEY = "YOUR_OPENROUTER_API_KEY"

// Конфигурация таймаутов и ограничений BLE
const REQUEST_TIMEOUT_MS = 15000 // 15-секундный таймаут запроса
const MAX_BLE_TEXT_LENGTH = 1000 // Лимит буфера BLE на Mi Band 7 (1000 символов)

// Модели Google AI Studio
const MODELS = {
  lite: 'gemini-3.5-flash-lite',
  hydrogen: 'gemini-4-hydrogen',
  fallback: 'gemini-3.5-flash-lite',
  secondaryFallback: 'gemini-3.5-flash-lite'
}

// Минималистичный системный промпт под мелкий экран
const SYSTEM_INSTRUCTION =
  'Отвечай максимально коротко. Ты интегрирован в устройство с мелким экраном.'

// Память контекста диалога (хранит последние 10 сообщений = 5 раундов беседы)
const MAX_HISTORY_TURNS = 10
let conversationHistory = []

function saveToHistory(prompt, answer) {
  if (!prompt || !answer) return
  conversationHistory.push({ role: 'user', text: prompt.trim() })
  conversationHistory.push({ role: 'model', text: answer.trim() })

  if (conversationHistory.length > MAX_HISTORY_TURNS) {
    conversationHistory = conversationHistory.slice(conversationHistory.length - MAX_HISTORY_TURNS)
    while (conversationHistory.length > 0 && conversationHistory[0].role !== 'user') {
      conversationHistory.shift()
    }
  }
}

/**
 * Очистка вводных вежливых клише ("Конечно!", "Вот ваш ответ:" и т.д.)
 */
function stripFluff(text) {
  if (!text || typeof text !== 'string') return ''
  let clean = text.trim()
  clean = clean.replace(/^(конечно|разумеется|безусловно|вот\s+(ваш\s+)?ответ|привет|здравствуйте)[!,.:\s—-]+/i, '')
  return clean.trim()
}

/**
 * Защита буфера BLE: безопасное усечение ответа до 1000 символов по границе слов
 */
function sanitizeForBLE(text, maxLength = MAX_BLE_TEXT_LENGTH) {
  if (!text || typeof text !== 'string') return ''
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }

  const suffix = '\n... [сокращено]'
  const limit = maxLength - suffix.length
  const searchWindow = trimmed.slice(0, limit)

  let cutIndex = -1
  const lastNewline = searchWindow.lastIndexOf('\n')
  if (lastNewline > limit - 120) {
    cutIndex = lastNewline
  } else {
    const lastSentence = Math.max(
      searchWindow.lastIndexOf('. '),
      searchWindow.lastIndexOf('! '),
      searchWindow.lastIndexOf('? ')
    )
    if (lastSentence > limit - 100) {
      cutIndex = lastSentence + 1
    } else {
      const lastSpace = searchWindow.lastIndexOf(' ')
      if (lastSpace > limit - 80) {
        cutIndex = lastSpace
      } else {
        cutIndex = limit
      }
    }
  }

  return trimmed.slice(0, cutIndex).trim() + suffix
}

/**
 * Проверка необходимости отката на облегченную модель (404, 429, 503)
 */
function isFallbackError(status, data) {
  const code = status || data?.error?.code
  if (code === 404 || code === 429 || code === 503) {
    return true
  }
  const statusStr = data?.error?.status
  if (statusStr === 'NOT_FOUND' || statusStr === 'RESOURCE_EXHAUSTED' || statusStr === 'UNAVAILABLE') {
    return true
  }
  return false
}

/**
 * HTTP POST запрос с поддержкой Zepp OS Fetch API и таймаута
 */
async function httpPost(url, payload, options = {}) {
  const timeoutMs = options.timeout || REQUEST_TIMEOUT_MS
  const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }

  let timer = null
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Таймаут соединения (15 сек)'))
    }, timeoutMs)
  })

  const execRequest = async () => {
    let rawRes = null
    try {
      rawRes = await fetch({
        url,
        method: 'POST',
        headers,
        body: bodyStr
      })
    } catch (e) {
      try {
        rawRes = await fetch(url, {
          method: 'POST',
          headers,
          body: bodyStr
        })
      } catch (err2) {
        throw new Error('Сбой сети: ' + (err2.message || 'нет подключения'))
      }
    }

    if (!rawRes) {
      throw new Error('Нет ответа от сервера')
    }

    let status = rawRes.status || rawRes.statusCode || 200
    let data = null

    if (typeof rawRes.json === 'function') {
      try { data = await rawRes.json() } catch (_) {}
    } else if (typeof rawRes.text === 'function') {
      try {
        const txt = await rawRes.text()
        data = JSON.parse(txt)
      } catch (_) {}
    } else if (rawRes.body) {
      let b = rawRes.body
      if (typeof b === 'string') {
        try { b = JSON.parse(b) } catch (_) {}
      }
      data = b
    }

    return { status, data }
  }

  try {
    return await Promise.race([execRequest(), timeoutPromise])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

AppSideService({
  onInit() {
    console.log('[Companion] Gemini Side Service Initialized')
    try {
      if (typeof globalThis !== 'undefined' && this.messaging) {
        globalThis.messaging = this.messaging
      }
      messageBuilder.listen(() => {
        console.log('[Companion] MessageBuilder listening')
      })

      messageBuilder.on('request', async (ctx) => {
        console.log('[Companion] Received MessageBuilder request')
        let payload = ctx.request.payload
        if (payload && typeof messageBuilder.buf2Json === 'function') {
          try {
            payload = messageBuilder.buf2Json(payload)
          } catch (e) {}
        }
        console.log('[Companion] Request data:', payload)

        if (payload && payload.clear) {
          conversationHistory = []
          console.log('[Companion] Context explicitly cleared by user')
          ctx.response({
            data: {
              status: 'ok',
              answer: 'Контекст диалога очищен'
            }
          })
          return
        }

        const prompt = payload.prompt || ''
        const modelType = payload.model || 'hydrogen'
        const enableReasoning = !!payload.reasoning

        try {
          const rawAnswer = await this.callGeminiAPI(prompt, modelType, enableReasoning)
          const safeAnswer = sanitizeForBLE(rawAnswer, MAX_BLE_TEXT_LENGTH)
          ctx.response({
            data: {
              status: 'ok',
              answer: safeAnswer
            }
          })
        } catch (err) {
          console.error('[Companion] API Error:', err)
          const errorText = 'Ошибка ИИ: ' + (err.message || 'Проверьте сеть')
          ctx.response({
            data: {
              status: 'error',
              answer: sanitizeForBLE(errorText, MAX_BLE_TEXT_LENGTH)
            }
          })
        }
      })
    } catch (e) {
      console.log('[Companion Init Error]', e)
    }
  },

  onRun() {
    // Резервная поддержка peerSocket
    if (this.messaging && this.messaging.peerSocket) {
      this.messaging.peerSocket.addListener('message', async (data) => {
        console.log('[Companion] Received request from Band (peerSocket):', data)

        if (data && (data.type === 'clear_context' || data.clear)) {
          conversationHistory = []
          console.log('[Companion] Context explicitly cleared via peerSocket')
          this.messaging.peerSocket.send({
            type: 'gemini_response',
            status: 'ok',
            question: 'Сброс',
            answer: 'Контекст диалога очищен'
          })
          return
        }

        if (data.type === 'ask_gemini') {
          const prompt = data.prompt || ''
          const modelType = data.model || 'hydrogen'
          const enableReasoning = !!data.reasoning

          try {
            const rawAnswer = await this.callGeminiAPI(prompt, modelType, enableReasoning)
            const safeAnswer = sanitizeForBLE(rawAnswer, MAX_BLE_TEXT_LENGTH)

            this.messaging.peerSocket.send({
              type: 'gemini_response',
              status: 'ok',
              question: prompt.slice(0, 100),
              answer: safeAnswer
            })
          } catch (err) {
            console.error('[Companion] API Error:', err)
            const errorText = 'Ошибка связи с ИИ: ' + (err.message || 'Проверьте сеть')
            this.messaging.peerSocket.send({
              type: 'gemini_response',
              status: 'error',
              question: prompt.slice(0, 100),
              answer: sanitizeForBLE(errorText, MAX_BLE_TEXT_LENGTH)
            })
          }
        }
      })
    }
  },

  async callGeminiAPI(prompt, modelType, enableReasoning) {
    if (USE_OPENROUTER) {
      return this.callOpenRouter(prompt, modelType, enableReasoning)
    }

    const clearKeywords = ['/clear', 'сброс', 'сбросить', 'новый чат', 'очистить', 'clear']
    if (clearKeywords.includes(prompt.toLowerCase().trim())) {
      conversationHistory = []
      console.log('[Companion] Context cleared by user keyword')
      return 'Контекст диалога очищен.'
    }

    // Google AI Studio API:
    const chosenModel = modelType === 'lite' ? MODELS.lite : MODELS.hydrogen
    const fallbackModel = (chosenModel === MODELS.fallback) ? MODELS.secondaryFallback : MODELS.fallback

    // Формируем историю диалога (чередование user -> model -> user -> model)
    const contents = []
    for (const msg of conversationHistory) {
      contents.push({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      })
    }
    // Добавляем текущий вопрос пользователя
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    })

    const requestBody = {
      contents,
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      generationConfig: {
        maxOutputTokens: 250,
        temperature: 0.1
      }
    }

    if (enableReasoning) {
      requestBody.generationConfig.thinkingConfig = {
        thinkingBudget: 1024
      }
    }

    const makeUrl = (m) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_API_KEY}`

    console.log(`[Companion] Requesting Gemini model: ${chosenModel} (контекст: ${conversationHistory.length / 2} раундов)`)
    let res = await httpPost(makeUrl(chosenModel), requestBody, { timeout: REQUEST_TIMEOUT_MS })

    // Автоматический откат на облегченную модель при 404, 429 или 503
    if (isFallbackError(res.status, res.data)) {
      console.warn(
        `[Companion] Model ${chosenModel} returned ${res.status} (${res.data?.error?.message || 'Error'}). Falling back to ${fallbackModel}...`
      )
      res = await httpPost(makeUrl(fallbackModel), requestBody, { timeout: REQUEST_TIMEOUT_MS })
    }

    if (res.data?.error) {
      throw new Error(res.data.error.message || `API Error (${res.status})`)
    }

    const candidate = res.data?.candidates?.[0]
    if (!candidate || !candidate.content || !candidate.content.parts) {
      return 'Нет ответа от модели'
    }

    // Извлекаем только финальный текст без промежуточных мыслей thinking
    const textParts = candidate.content.parts
      .filter((p) => !p.thought && p.text)
      .map((p) => p.text.trim())

    const rawResult = textParts.join('\n')
    const finalAnswer = stripFluff(rawResult) || 'Пустой ответ'
    saveToHistory(prompt, finalAnswer)
    return finalAnswer
  },

  async callOpenRouter(prompt, modelType, enableReasoning) {
    const clearKeywords = ['/clear', 'сброс', 'сбросить', 'новый чат', 'очистить', 'clear']
    if (clearKeywords.includes(prompt.toLowerCase().trim())) {
      conversationHistory = []
      console.log('[Companion] Context cleared by user keyword')
      return 'Контекст диалога очищен.'
    }

    const chosenModel = modelType === 'lite'
      ? 'google/gemini-3.5-flash-lite'
      : 'google/gemini-4-hydrogen'
    const fallbackModel = 'google/gemini-3.5-flash-lite'

    const messages = [
      {
        role: 'system',
        content: SYSTEM_INSTRUCTION
      }
    ]
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.text
      })
    }
    messages.push({
      role: 'user',
      content: prompt
    })

    const makeBody = (m) => ({
      model: m,
      messages,
      max_tokens: 250,
      temperature: 0.1
    })

    const url = 'https://openrouter.ai/api/v1/chat/completions'
    const headers = {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`
    }

    console.log(`[Companion] Requesting OpenRouter model: ${chosenModel} (контекст: ${conversationHistory.length / 2} раундов)`)
    let res = await httpPost(url, makeBody(chosenModel), { headers, timeout: REQUEST_TIMEOUT_MS })

    // Fallback для OpenRouter при 404, 429, 503
    if (isFallbackError(res.status, res.data) && chosenModel !== fallbackModel) {
      console.warn(`[Companion] OpenRouter model ${chosenModel} returned ${res.status}. Falling back to ${fallbackModel}...`)
      res = await httpPost(url, makeBody(fallbackModel), { headers, timeout: REQUEST_TIMEOUT_MS })
    }

    if (res.data?.error) {
      throw new Error(res.data.error.message || `OpenRouter Error (${res.status})`)
    }

    const rawResult = res.data?.choices?.[0]?.message?.content?.trim() || 'Пустой ответ'
    const finalAnswer = stripFluff(rawResult)
    saveToHistory(prompt, finalAnswer)
    return finalAnswer
  },

  onDestroy() {
    console.log('[Companion] Side Service Stopped')
  }
})
