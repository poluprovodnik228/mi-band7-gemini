import { MessageBuilder } from '../shared/message'
import { getRequestTimeout, withTimeout } from '../shared/request-timeout'

// Фоновый сервис-компаньон для смартфона (Zepp OS Side Service)
// Пересылает запросы с браслета в Gemini API и возвращает ответ

const messageBuilder = new MessageBuilder()

// Вставьте сюда ваш API-ключ (от Google AI Studio или OpenRouter)
// Также ключ можно задать прямо в приложении Zepp на телефоне в настройках приложения
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"

// Если используете OpenRouter, укажите true
const USE_OPENROUTER = false
const OPENROUTER_API_KEY = "YOUR_OPENROUTER_API_KEY"

function getEffectiveApiKey() {
  try {
    if (typeof settings !== 'undefined' && settings.settingsStorage) {
      const stored = settings.settingsStorage.getItem('geminiApiKey')
      if (stored && typeof stored === 'string') {
        const trimmed = stored.trim().replace(/^"|"$/g, '')
        if (trimmed.length > 5 && !trimmed.includes('YOUR_')) return trimmed
      }
    }
  } catch (_) {}
  return GEMINI_API_KEY
}

function getEffectiveOpenRouterKey() {
  try {
    if (typeof settings !== 'undefined' && settings.settingsStorage) {
      const stored = settings.settingsStorage.getItem('openRouterApiKey')
      if (stored && typeof stored === 'string') {
        const trimmed = stored.trim().replace(/^"|"$/g, '')
        if (trimmed.length > 5 && !trimmed.includes('YOUR_')) return trimmed
      }
    }
  } catch (_) {}
  return OPENROUTER_API_KEY
}

function isUseOpenRouter() {
  try {
    if (typeof settings !== 'undefined' && settings.settingsStorage) {
      const stored = settings.settingsStorage.getItem('useOpenRouter')
      if (typeof stored === 'boolean') return stored
      if (stored === 'true') return true
      if (stored === 'false') return false
    }
  } catch (_) {}
  return USE_OPENROUTER
}

// Конфигурация таймаутов и ограничений BLE
const WEB_SEARCH_TIMEOUT_MS = 3000
const MAX_BLE_TEXT_LENGTH = 1200 // Лимит буфера BLE на Mi Band 7 (~150-180 слов)

// Модели Google AI Studio
const MODELS = {
  lite: 'gemini-3.5-flash-lite',
  flash38: 'gemini-3.8-flash',
  hydrogen: 'gemini-4-hydrogen'
}

// Smart prompt for wearable smartwatch: brief by default, but detailed when asked
const SYSTEM_INSTRUCTION =
  'You are an AI on a wearable smartwatch device. By default, answer concisely and briefly. However, if the user explicitly asks for a long answer, detailed explanation, essay, story, or specific word count, fulfill their request thoroughly.'

// Conversation context memory (stores last 10 messages = 5 dialogue turns)
const MAX_HISTORY_TURNS = 10
let conversationHistory = []
let activeJob = null
let lastCompletedJob = null

function saveToHistory(history, prompt, answer) {
  // A clear replaces the history array; requests from that conversation must not write to the new one.
  if (history !== conversationHistory || !prompt || !answer) return
  conversationHistory.push({ role: 'user', text: prompt.trim() })
  conversationHistory.push({ role: 'model', text: answer.trim() })
  if (conversationHistory.length > MAX_HISTORY_TURNS) conversationHistory.splice(0, 2)
}

function timeLeft(deadline) {
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new Error('Request timed out')
  return remaining
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
 * Проверка перегрузки серверов (503 High Demand, 429 Quota)
 */
function isOverloadError(status, data) {
  const code = status || data?.error?.code
  const statusStr = data?.error?.status || ''
  const msg = (data?.error?.message || '').toLowerCase()
  return code === 503 || code === 429 || statusStr === 'UNAVAILABLE' || statusStr === 'RESOURCE_EXHAUSTED' ||
         msg.includes('high demand') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('overload') || msg.includes('spikes in demand')
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
async function fetchWebSearch(query, deadline) {
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
      if (Date.now() >= deadline) return []
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

async function searchWithinBudget(prompt, deadline) {
  const ms = Math.min(WEB_SEARCH_TIMEOUT_MS, timeLeft(deadline))
  const searchDeadline = Date.now() + ms
  try {
    return await withTimeout(() => fetchWebSearch(prompt, searchDeadline), ms)
  } catch (_) {
    return []
  }
}

/**
 * HTTP POST запрос с поддержкой Zepp OS Fetch API и таймаута
 */
async function httpPost(url, payload, deadline, extraHeaders = {}) {
  const timeoutMs = timeLeft(deadline)
  const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders
  }

  return withTimeout(async () => {
    let rawRes = null
    try {
      rawRes = await fetch({
        url,
        method: 'POST',
        headers,
        body: bodyStr
      })
    } catch (e) {
      timeLeft(deadline)
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
  }, timeoutMs)
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

        if (payload && payload.ping) {
          ctx.response({
            data: {
              status: 'ok',
              pong: true,
              timestamp: Date.now()
            }
          })
          return
        }

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

        if (payload && (payload.action === 'poll_status' || payload.poll)) {
          console.log('[Companion] Received poll_status check for requestId:', payload.requestId)
          if (lastCompletedJob && (!payload.requestId || lastCompletedJob.id === payload.requestId)) {
            ctx.response({
              data: {
                status: lastCompletedJob.status,
                answer: lastCompletedJob.answer,
                requestId: lastCompletedJob.id
              }
            })
            return
          }
          if (activeJob && activeJob.status === 'thinking') {
            ctx.response({
              data: {
                status: 'thinking',
                elapsed: Math.floor((Date.now() - activeJob.startTime) / 1000),
                requestId: activeJob.id
              }
            })
            return
          }
          ctx.response({
            data: {
              status: 'idle'
            }
          })
          return
        }

        const prompt = payload.prompt || ''
        const modelType = payload.model || 'hydrogen'
        const enableReasoning = !!payload.reasoning
        const enableWebSearch = payload.webSearch !== false
        const reqId = payload.requestId || Date.now()

        activeJob = {
          id: reqId,
          prompt,
          startTime: Date.now(),
          status: 'thinking'
        }

        try {
          const rawAnswer = await this.callGeminiAPI(prompt, modelType, enableReasoning, enableWebSearch)
          const safeAnswer = sanitizeForBLE(rawAnswer, MAX_BLE_TEXT_LENGTH)
          lastCompletedJob = {
            id: reqId,
            status: 'ok',
            answer: safeAnswer,
            timestamp: Date.now()
          }
          activeJob = null
          ctx.response({
            data: {
              status: 'ok',
              answer: safeAnswer,
              requestId: reqId
            }
          })
        } catch (err) {
          console.error('[Companion] API Error:', err)
          const errorText = 'AI Error: ' + (err.message || 'Check network')
          const safeError = sanitizeForBLE(errorText, MAX_BLE_TEXT_LENGTH)
          lastCompletedJob = {
            id: reqId,
            status: 'error',
            answer: safeError,
            timestamp: Date.now()
          }
          activeJob = null
          ctx.response({
            data: {
              status: 'error',
              answer: safeError,
              requestId: reqId
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
    const deadline = Date.now() + getRequestTimeout(modelType)
    if (isUseOpenRouter()) {
      return this.callOpenRouter(prompt, modelType, enableWebSearch, deadline)
    }

    const clearKeywords = ['/clear', 'clear', 'reset', 'new chat', 'clean', 'сброс', 'сбросить', 'новый чат', 'очистить']
    if (clearKeywords.includes(prompt.toLowerCase().trim())) {
      conversationHistory = []
      console.log('[Companion] Context cleared by user keyword')
      return 'Context cleared.'
    }

    const history = conversationHistory
    // Google AI Studio API:
    const chosenModel = MODELS[modelType] || MODELS.hydrogen
    const modelChain = modelType === 'hydrogen'
      ? [MODELS.hydrogen, MODELS.flash38, MODELS.lite]
      : (modelType === 'flash38' ? [MODELS.flash38, MODELS.lite] : [MODELS.lite])

    // 1. Live Web Search: получаем свежие факты из интернета при включенном поиске
    let effectiveUserText = prompt
    if (enableWebSearch) {
      try {
        const snippets = await searchWithinBudget(prompt, deadline)
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
    for (const msg of history) {
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

    const apiKey = getEffectiveApiKey()
    const makeUrl = (m) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`

    let res = null
    let lastError = null
    let fallbackNotice = ''

    for (let i = 0; i < modelChain.length; i++) {
      const currentModel = modelChain[i]
      try {
        console.log(`[Companion] Requesting Gemini model: ${currentModel} (${i + 1}/${modelChain.length}, контекст: ${history.length / 2} раунд.)`)
        timeLeft(deadline)
        res = await httpPost(makeUrl(currentModel), requestBody, deadline)

        if (isOverloadError(res.status, res.data)) {
          throw new Error('Overload: ' + (res.data?.error?.message || `Server high demand (${res.status})`))
        } else if (isFallbackError(res.status, res.data)) {
          throw new Error(`Fallback required: status ${res.status}`)
        }

        if (res.data?.error) {
          throw new Error(res.data.error.message || `API Error (${res.status})`)
        }

        if (i > 0) {
          const name = currentModel === MODELS.flash38 ? '3.8 Flash' : '3.5 Flash-Lite'
          fallbackNotice = `⚠️ Сервера перегружены (503 High Demand).\nОтвет через ${name}:\n\n`
          console.warn(`[Companion] Succeeded with fallback model: ${currentModel}`)
        }
        break
      } catch (err) {
        lastError = err
        if (/timeout|timed out/i.test(err.message)) {
          throw err
        }
        const isOverload = isOverloadError(res?.status, res?.data) || /overload|503|demand|unavailable|quota|rate limit/i.test(err.message)
        console.warn(`[Companion] Model ${currentModel} failed (${err.message}). ${i < modelChain.length - 1 ? 'Trying next in chain...' : 'Chain exhausted.'}`)
        if (i === modelChain.length - 1) {
          if (isOverload || /overload|503|demand|unavailable|quota|rate limit/i.test(lastError.message)) {
            throw new Error('⚠️ Сервера Google перегружены (503 High Demand). Попробуйте позже.')
          }
          throw lastError
        }
      }
    }
    timeLeft(deadline)

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
      saveToHistory(history, prompt, finalAnswer)
    }
    if (fallbackNotice) {
      finalAnswer = fallbackNotice + finalAnswer
    }
    return finalAnswer
  },

  async callOpenRouter(prompt, modelType, enableWebSearch, deadline) {
    const clearKeywords = ['/clear', 'clear', 'reset', 'new chat', 'clean', 'сброс', 'сбросить', 'новый чат', 'очистить']
    if (clearKeywords.includes(prompt.toLowerCase().trim())) {
      conversationHistory = []
      console.log('[Companion] Context cleared by user keyword')
      return 'Context cleared.'
    }

    const history = conversationHistory
    let effectiveUserText = prompt
    if (enableWebSearch) {
      try {
        const snippets = await searchWithinBudget(prompt, deadline)
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
    for (const msg of history) {
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
    const openRouterKey = getEffectiveOpenRouterKey()
    const headers = {
      Authorization: `Bearer ${openRouterKey}`
    }

    console.log(`[Companion] Requesting OpenRouter model: ${chosenModel} (context: ${history.length / 2} turns)`)
    let res = await httpPost(url, makeBody(chosenModel), deadline, headers)

    // Fallback для OpenRouter при 404, 429, 503
    if (isFallbackError(res.status, res.data) && chosenModel !== fallbackModel) {
      console.warn(`[Companion] OpenRouter model ${chosenModel} returned ${res.status}. Falling back to ${fallbackModel}...`)
      res = await httpPost(url, makeBody(fallbackModel), deadline, headers)
    }
    timeLeft(deadline)

    if (res.data?.error) {
      throw new Error(res.data.error.message || `OpenRouter Error (${res.status})`)
    }

    const rawResult = res.data?.choices?.[0]?.message?.content?.trim() || 'Empty response'
    const finalAnswer = stripFluff(rawResult)
    saveToHistory(history, prompt, finalAnswer)
    return finalAnswer
  },

  onDestroy() {
    console.log('[Companion] Side Service Stopped')
  }
})
