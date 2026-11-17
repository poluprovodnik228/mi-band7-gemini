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
const REQUEST_TIMEOUT_MS = 120000 // 120s timeout to allow deep reasoning on Hydrogen
const MAX_BLE_TEXT_LENGTH = 1200 // Лимит буфера BLE на Mi Band 7 (~150-180 слов)

// Модели Google AI Studio
const MODELS = {
  lite: 'gemini-3.5-flash-lite',
  hydrogen: 'gemini-4-hydrogen',
  fallback: 'gemini-3.5-flash-lite',
  secondaryFallback: 'gemini-3.5-flash-lite'
}

// Smart prompt for wearable smartwatch: brief by default, but detailed when asked
const SYSTEM_INSTRUCTION =
  'You are an AI on a wearable smartwatch device. By default, answer concisely and briefly. However, if the user explicitly asks for a long answer, detailed explanation, essay, story, or specific word count, fulfill their request thoroughly.'

// Conversation context memory (stores last 10 messages = 5 dialogue turns)
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
  const msg = (data?.error?.message || '').toLowerCase()
  if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('exceeded')) {
    return true
  }
  return false
}

/**
 * Live Web Search via DuckDuckGo Lite (no API keys, no captcha, real-time facts)
 */
async function fetchWebSearch(query) {
  if (!query || typeof query !== 'string') return []
  const cleanQ = query.trim()
  if (cleanQ.length < 2) return []

  const skipKeywords = ['привет', 'hello', 'hi', 'clear', 'reset', 'спасибо', 'пока', 'test']
  if (skipKeywords.includes(cleanQ.toLowerCase())) return []

  try {
    const postBody = `q=${encodeURIComponent(cleanQ)}`
    const searchUrl = 'https://lite.duckduckgo.com/lite/'
    let rawRes = null

    try {
      rawRes = await fetch({
        url: searchUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: postBody
      })
    } catch (_) {
      try {
        rawRes = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: postBody
        })
      } catch (e) {
        console.log('[WebSearch fetch error]', e.message)
        return []
      }
    }

    if (!rawRes) return []

    let html = ''
    if (typeof rawRes.text === 'function') {
      try { html = await rawRes.text() } catch (_) {}
    } else if (typeof rawRes.body === 'string') {
      html = rawRes.body
    }

    if (!html) return []

    const snippets = []
    const regex = /<td class=[\x27"]result-snippet[\x27"]>([\s\S]*?)<\/td>/g
    let match
    while ((match = regex.exec(html)) !== null && snippets.length < 3) {
      const clean = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      if (clean && clean.length > 20) {
        snippets.push(clean)
      }
    }
    console.log(`[Companion WebSearch] Found ${snippets.length} live snippets for: "${cleanQ.slice(0, 30)}"`)
    return snippets
  } catch (err) {
    console.warn('[Companion WebSearch error]', err)
    return []
  }
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
      reject(new Error(`Connection timeout (${Math.round(timeoutMs / 1000)}s)`))
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
        throw new Error('Network failure: ' + (err2.message || 'no connection'))
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
              answer: 'Context cleared'
            }
          })
          return
        }

        const prompt = payload.prompt || ''
        const modelType = payload.model || 'hydrogen'
        const enableReasoning = !!payload.reasoning
        const enableWebSearch = payload.webSearch !== false

        try {
          const rawAnswer = await this.callGeminiAPI(prompt, modelType, enableReasoning, enableWebSearch)
          const safeAnswer = sanitizeForBLE(rawAnswer, MAX_BLE_TEXT_LENGTH)
          ctx.response({
            data: {
              status: 'ok',
              answer: safeAnswer
            }
          })
        } catch (err) {
          console.error('[Companion] API Error:', err)
          const errorText = 'AI Error: ' + (err.message || 'Check network')
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
    // Fallback peerSocket support
    if (this.messaging && this.messaging.peerSocket) {
      this.messaging.peerSocket.addListener('message', async (data) => {
        console.log('[Companion] Received request from Band (peerSocket):', data)

        if (data && (data.type === 'clear_context' || data.clear)) {
          conversationHistory = []
          console.log('[Companion] Context explicitly cleared via peerSocket')
          this.messaging.peerSocket.send({
            type: 'gemini_response',
            status: 'ok',
            question: 'Reset',
            answer: 'Context cleared'
          })
          return
        }

        if (data.type === 'ask_gemini') {
          const prompt = data.prompt || ''
          const modelType = data.model || 'hydrogen'
          const enableReasoning = !!data.reasoning
          const enableWebSearch = data.webSearch !== false

          try {
            const rawAnswer = await this.callGeminiAPI(prompt, modelType, enableReasoning, enableWebSearch)
            const safeAnswer = sanitizeForBLE(rawAnswer, MAX_BLE_TEXT_LENGTH)

            this.messaging.peerSocket.send({
              type: 'gemini_response',
              status: 'ok',
              question: prompt.slice(0, 100),
              answer: safeAnswer
            })
          } catch (err) {
            console.error('[Companion] API Error:', err)
            const errorText = 'AI Error: ' + (err.message || 'Check network')
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

  async callGeminiAPI(prompt, modelType, enableReasoning, enableWebSearch = true) {
    if (USE_OPENROUTER) {
      return this.callOpenRouter(prompt, modelType, enableReasoning, enableWebSearch)
    }

    const clearKeywords = ['/clear', 'clear', 'reset', 'new chat', 'clean', 'сброс', 'сбросить', 'новый чат', 'очистить']
    if (clearKeywords.includes(prompt.toLowerCase().trim())) {
      conversationHistory = []
      console.log('[Companion] Context cleared by user keyword')
      return 'Context cleared.'
    }

    // Google AI Studio API:
    const chosenModel = modelType === 'lite' ? MODELS.lite : MODELS.hydrogen
    const fallbackModel = (chosenModel === MODELS.fallback) ? MODELS.secondaryFallback : MODELS.fallback

    // 1. Live Web Search: получаем свежие факты из интернета при включенном поиске
    let effectiveUserText = prompt
    if (enableWebSearch) {
      try {
        const snippets = await fetchWebSearch(prompt)
        if (snippets && snippets.length > 0) {
          effectiveUserText = `[Current Web Search Results]:\n${snippets.join('\n')}\n\n[User Question]: ${prompt}\n(Answer concisely using the latest real-time web info above if relevant)`
          console.log(`[Companion] Injected ${snippets.length} web search snippets into prompt`)
        }
      } catch (err) {
        console.log('[Companion] Web search failed, proceeding without search:', err)
      }
    }

    // Формируем историю диалога (чередование user -> model -> user -> model)
    const contents = []
    for (const msg of conversationHistory) {
      contents.push({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      })
    }
    // Добавляем текущий вопрос пользователя с веб-контекстом
    contents.push({
      role: 'user',
      parts: [{ text: effectiveUserText }]
    })

    const requestBody = {
      contents,
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      generationConfig: {
        maxOutputTokens: 1200,
        temperature: 0.1
      }
    }

    if (enableReasoning) {
      requestBody.generationConfig.thinkingConfig = {
        thinkingBudget: 2048
      }
    } else if (chosenModel === MODELS.hydrogen) {
      // Ограничиваем бюджет мыслей когда рассуждения выключены, чтобы ответ был быстрым (10-15 сек)
      requestBody.generationConfig.thinkingConfig = {
        thinkingBudget: 512
      }
    }

    const makeUrl = (m) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_API_KEY}`

    console.log(`[Companion] Requesting Gemini model: ${chosenModel} (контекст: ${conversationHistory.length / 2} раундов)`)
    let res = await httpPost(makeUrl(chosenModel), requestBody, { timeout: REQUEST_TIMEOUT_MS })

    // Автоматический откат на облегченную модель при 404, 429 или 503
    if (isFallbackError(res.status, res.data)) {
      console.warn(
        `[Companion] Model ${chosenModel} returned ${res.status} (${res.data?.error?.message || 'Quota/Network error'}). Falling back to ${fallbackModel}...`
      )
      res = await httpPost(makeUrl(fallbackModel), requestBody, { timeout: REQUEST_TIMEOUT_MS })
    }

    if (res.data?.error) {
      throw new Error(res.data.error.message || `API Error (${res.status})`)
    }

    const candidate = res.data?.candidates?.[0]
    if (!candidate || !candidate.content || !candidate.content.parts) {
      return 'No response from model'
    }

    // Извлекаем только финальный текст без промежуточных мыслей thinking
    let textParts = candidate.content.parts
      .filter((p) => !p.thought && p.text)
      .map((p) => p.text.trim())

    let rawResult = textParts.join('\n')
    // Fallback если все части были помечены как thought или текст лежал во всех частях
    if (!rawResult) {
      rawResult = candidate.content.parts
        .filter((p) => p.text)
        .map((p) => p.text.trim())
        .join('\n')
    }

    const stripped = stripFluff(rawResult)
    // Защита: если stripFluff удалил всё (например, ответ был просто "Привет!"), сохраняем rawResult
    let finalAnswer = (stripped && stripped.length > 0 ? stripped : rawResult.trim())
    if (!finalAnswer) {
      if (candidate.finishReason === 'MAX_TOKENS') {
        finalAnswer = 'Response truncated (token limit)'
      } else {
        finalAnswer = 'Empty response'
      }
    }

    if (finalAnswer && !finalAnswer.startsWith('Empty response') && !finalAnswer.startsWith('Response truncated')) {
      saveToHistory(prompt, finalAnswer)
    }
    return finalAnswer
  },

  async callOpenRouter(prompt, modelType, enableReasoning, enableWebSearch = true) {
    const clearKeywords = ['/clear', 'clear', 'reset', 'new chat', 'clean', 'сброс', 'сбросить', 'новый чат', 'очистить']
    if (clearKeywords.includes(prompt.toLowerCase().trim())) {
      conversationHistory = []
      console.log('[Companion] Context cleared by user keyword')
      return 'Context cleared.'
    }

    let effectiveUserText = prompt
    if (enableWebSearch) {
      try {
        const snippets = await fetchWebSearch(prompt)
        if (snippets && snippets.length > 0) {
          effectiveUserText = `[Current Web Search Results]:\n${snippets.join('\n')}\n\n[User Question]: ${prompt}`
        }
      } catch (_) {}
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
      content: effectiveUserText
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

    console.log(`[Companion] Requesting OpenRouter model: ${chosenModel} (context: ${conversationHistory.length / 2} turns)`)
    let res = await httpPost(url, makeBody(chosenModel), { headers, timeout: REQUEST_TIMEOUT_MS })

    // Fallback для OpenRouter при 404, 429, 503
    if (isFallbackError(res.status, res.data) && chosenModel !== fallbackModel) {
      console.warn(`[Companion] OpenRouter model ${chosenModel} returned ${res.status}. Falling back to ${fallbackModel}...`)
      res = await httpPost(url, makeBody(fallbackModel), { headers, timeout: REQUEST_TIMEOUT_MS })
    }

    if (res.data?.error) {
      throw new Error(res.data.error.message || `OpenRouter Error (${res.status})`)
    }

    const rawResult = res.data?.choices?.[0]?.message?.content?.trim() || 'Empty response'
    const finalAnswer = stripFluff(rawResult)
    saveToHistory(prompt, finalAnswer)
    return finalAnswer
  },

  onDestroy() {
    console.log('[Companion] Side Service Stopped')
  }
})
