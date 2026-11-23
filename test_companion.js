// Standalone test suite for Mi Band 7 Companion Service
// Tests:
// 1. BLE chunking & string safety (<= 1000 chars, clean word boundaries)
// 2. System prompt fluff removal (strips "Конечно!", "Вот ваш ответ:", etc.)
// 3. Fallback code & error detection (404, 429, 503, status strings)
// 4. Timeout handling with AbortController (prompt "Таймаут соединения")
// 5. Fallback mechanism with Live Gemini API (404/503 -> gemini-3.5-flash-lite)
// 6. Direct Gemini query with concise system prompt
// 7. Simulated Band BLE Request / Response cycle over peerSocket

const assert = require('assert')

const REQUEST_TIMEOUT_MS = 15000
const MAX_BLE_TEXT_LENGTH = 1000

const MODELS = {
  hydrogen: 'gemini-4-hydrogen',
  lite: 'gemini-3.5-flash-lite',
  fallback: 'gemini-3.5-flash-lite',
  secondaryFallback: 'gemini-3.1-flash-lite'
}

const SYSTEM_INSTRUCTION =
  'Ты — лаконичный AI-ассистент смарт-браслета Xiaomi Smart Band 7 (экран 192x490 пикселей).\n' +
  'ПРАВИЛА ОТВЕТА:\n' +
  '1. Давай ТОЛЬКО прямой ответ или факты. Сразу к сути вопроса.\n' +
  '2. СТРОГО ЗАПРЕЩЕНО: любые приветствия, вежливости ("Конечно", "Вот ответ", "Привет"), вводные слова, рассуждения вслух, дисклеймеры и заключительные фразы.\n' +
  '3. Формат: ультра-краткий текст (до 25-40 слов), формулы или компактный нумерованный список. Без таблиц, без markdown-заголовков (#).\n' +
  '4. Язык: отвечай на том же языке, на котором задан вопрос.'

function stripFluff(text) {
  if (!text || typeof text !== 'string') return ''
  let clean = text.trim()
  clean = clean.replace(/^(конечно|разумеется|безусловно|вот\s+(ваш\s+)?ответ|привет|здравствуйте)[!,.:\s—-]+/i, '')
  return clean.trim()
}

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

function isFallbackError(status, data) {
  const code = status || data?.error?.code
  if (code === 400 || code === 404 || code === 429 || code === 503) {
    return true
  }
  const statusStr = data?.error?.status
  if (statusStr === 'NOT_FOUND' || statusStr === 'RESOURCE_EXHAUSTED' || statusStr === 'UNAVAILABLE') {
    return true
  }
  const msg = (data?.error?.message || '').toLowerCase()
  if (msg.includes('not found') || msg.includes('quota') || msg.includes('rate limit')) {
    return true
  }
  return false
}

async function httpPost(url, payload, options = {}) {
  const timeoutMs = options.timeout || REQUEST_TIMEOUT_MS
  let controller = null
  let signal = null

  if (typeof AbortController !== 'undefined') {
    controller = new AbortController()
    signal = controller.signal
  }

  let timer = null
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (controller) {
        try {
          controller.abort()
        } catch (_) {}
      }
      const err = new Error('Таймаут соединения')
      err.name = 'TimeoutError'
      reject(err)
    }, timeoutMs)
  })

  const execRequest = async () => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
    const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload)

    let rawRes
    let isStandard = false

    try {
      const fetchOpts = {
        method: 'POST',
        headers,
        body: bodyStr
      }
      if (signal) {
        fetchOpts.signal = signal
      }
      rawRes = await fetch(url, fetchOpts)
      if (rawRes && typeof rawRes.text === 'function') {
        isStandard = true
      }
    } catch (err) {
      if (err.name === 'AbortError' || (signal && signal.aborted)) {
        const timeoutErr = new Error('Таймаут соединения')
        timeoutErr.name = 'TimeoutError'
        throw timeoutErr
      }
      // Поддержка Zepp OS fetch({ url, method, headers, body, timeout })
      const zeppParams = {
        url,
        method: 'POST',
        headers,
        body: bodyStr,
        timeout: timeoutMs
      }
      rawRes = await fetch(zeppParams)
    }

    if (!rawRes) {
      throw new Error('Нет ответа от сервера')
    }

    let status = 200
    let data = null

    if (isStandard) {
      status = rawRes.status
      const text = await rawRes.text()
      try {
        data = JSON.parse(text)
      } catch (_) {
        data = text
      }
    } else {
      status = rawRes.status || rawRes.statusCode || 200
      let b = rawRes.body
      if (typeof b === 'string') {
        try {
          b = JSON.parse(b)
        } catch (_) {}
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

async function runTests() {
  console.log('=== Mi Band 7 Gemini Companion Test Suite ===\n')

  // Test 1: BLE Chunking & Slicing Safety
  console.log('Test 1: BLE Safety & String Limits')
  {
    const shortText = 'Краткий ответ.'
    assert.strictEqual(sanitizeForBLE(shortText, 1000), shortText)

    // Very long text (> 1600 chars)
    const sentence = 'Это длинный текст с полезной информацией о космосе и галактиках. '
    const longText = sentence.repeat(25)
    assert(longText.length > 1500)

    const truncated = sanitizeForBLE(longText, 1000)
    assert(truncated.length <= 1000, `Truncated length ${truncated.length} must be <= 1000`)
    assert(truncated.endsWith('... [сокращено]'), 'Must have truncation indicator')
    assert(!truncated.endsWith(' ... [сокращено]'), 'Should trim before indicator')
    console.log(`  ✓ Successfully truncated ${longText.length} chars -> ${truncated.length} chars (<= 1000)`)
  }

  // Test 2: Introductory Fluff Removal
  console.log('\nTest 2: Fluff Removal')
  {
    assert.strictEqual(stripFluff('Конечно! Париж — столица Франции.'), 'Париж — столица Франции.')
    assert.strictEqual(stripFluff('Вот ваш ответ: 42.'), '42.')
    assert.strictEqual(stripFluff('Привет! Земля — третья планета.'), 'Земля — третья планета.')
    assert.strictEqual(stripFluff('Разумеется: E=mc^2'), 'E=mc^2')
    assert.strictEqual(stripFluff('Прямой ответ без вводных слов'), 'Прямой ответ без вводных слов')
    console.log('  ✓ All introductory conversational fluff stripped cleanly')
  }

  // Test 3: Fallback Status Code Detection
  console.log('\nTest 3: Fallback Code Detection')
  {
    assert(isFallbackError(404, null), '404 must trigger fallback')
    assert(isFallbackError(429, null), '429 must trigger fallback')
    assert(isFallbackError(503, null), '503 must trigger fallback')
    assert(isFallbackError(200, { error: { code: 503, status: 'UNAVAILABLE' } }), 'Error payload must trigger fallback')
    assert(isFallbackError(200, { error: { code: 429, status: 'RESOURCE_EXHAUSTED' } }), 'Quota error must trigger fallback')
    assert(!isFallbackError(200, { candidates: [] }), '200 OK must NOT trigger fallback')
    assert(!isFallbackError(400, { error: { code: 400, status: 'INVALID_ARGUMENT' } }), '400 should not trigger fallback')
    console.log('  ✓ Correctly detects 404, 429, 503 and API status strings')
  }

  // Test 4: Timeout Handling with AbortController
  console.log('\nTest 4: Timeout Handling (AbortController & Timely Reject)')
  {
    const start = Date.now()
    let timedOut = false
    let errMsg = ''

    try {
      // Use a fast timeout (200ms) with a simulated slow endpoint to verify timeout triggers
      await httpPost('https://httpbin.org/delay/3', { test: true }, { timeout: 200 })
    } catch (err) {
      timedOut = true
      errMsg = err.message
    }

    const elapsed = Date.now() - start
    assert(timedOut, 'Should have thrown timeout')
    assert.strictEqual(errMsg, 'Таймаут соединения', `Expected 'Таймаут соединения', got '${errMsg}'`)
    assert(elapsed < 1500, `Timeout should trigger promptly (took ${elapsed}ms)`)
    console.log(`  ✓ Timeout caught in ${elapsed}ms with message: "${errMsg}"`)
  }

  // Test 5: Fallback Mechanism (Simulating 404/503 -> Fallback to Gemini 3.5 Flash-Lite)
  console.log('\nTest 5: Fallback Mechanism with Live Gemini API')
  {
    const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY'

    async function callGemini(model, prompt) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        generationConfig: { maxOutputTokens: 250, temperature: 0.1 }
      }
      return httpPost(url, body, { timeout: REQUEST_TIMEOUT_MS })
    }

    // Call a model that triggers 404 (simulating unavailable/deprecated model)
    console.log('  Attempting primary model "gemini-deprecated-model-404"...')
    let res = await callGemini('gemini-deprecated-model-404', 'Сколько дней в високосном году?')
    console.log(`  Primary model status: ${res.status}`)

    assert(isFallbackError(res.status, res.data), 'Should detect fallback condition')
    console.log('  -> Fallback condition met! Triggering fallback to "gemini-3.5-flash-lite"...')

    res = await callGemini(MODELS.fallback, 'Сколько дней в високосном году?')
    console.log(`  Fallback model status: ${res.status}`)

    assert.strictEqual(res.status, 200, 'Fallback model must return 200')
    const rawAnswer = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const cleanAnswer = stripFluff(rawAnswer)
    console.log(`  Fallback Answer: "${cleanAnswer}"`)
    assert(cleanAnswer.includes('366'), 'Answer should contain 366')
    console.log('  ✓ Fallback mechanism recovered successfully and produced valid answer!')
  }

  // Test 6: Direct Gemini Query with Optimized System Prompt
  console.log('\nTest 6: Direct Gemini Query & 192x490 Concise Output Format')
  {
    const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.lite}:generateContent?key=${GEMINI_API_KEY}`
    const body = {
      contents: [{ parts: [{ text: 'Привет! Какая планета третья от Солнца?' }] }],
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      generationConfig: { maxOutputTokens: 250, temperature: 0.1 }
    }

    const res = await httpPost(url, body, { timeout: REQUEST_TIMEOUT_MS })
    assert.strictEqual(res.status, 200)
    const rawAnswer = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const cleanAnswer = stripFluff(rawAnswer)
    console.log(`  Question: "Привет! Какая планета третья от Солнца?"`)
    console.log(`  Answer: "${cleanAnswer}"`)
    assert(cleanAnswer.toLowerCase().includes('земля'), 'Must mention Земля')
    // Check that there is no greeting or conversational fluff
    assert(!/^(привет|конечно|здравствуйте)/i.test(cleanAnswer), 'Must not contain greeting')
    console.log('  ✓ Concise, direct answer generated with zero introductory fluff')
  }

  // Test 7: Band peerSocket BLE Simulation
  console.log('\nTest 7: Simulated Band BLE Request / Response Cycle')
  {
    let sentToBand = null

    const mockMessaging = {
      peerSocket: {
        send: (msg) => {
          sentToBand = msg
        }
      }
    }

    async function handleBandMessage(data) {
      if (data.type === 'ask_gemini') {
        const prompt = data.prompt || ''
        try {
          const answer = sanitizeForBLE('366 дней.', MAX_BLE_TEXT_LENGTH)
          mockMessaging.peerSocket.send({
            type: 'gemini_response',
            status: 'ok',
            question: prompt.slice(0, 100),
            answer: answer
          })
        } catch (err) {
          const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError'
          mockMessaging.peerSocket.send({
            type: 'gemini_response',
            status: 'error',
            question: prompt.slice(0, 100),
            answer: isTimeout ? 'Таймаут соединения' : ('Ошибка: ' + err.message)
          })
        }
      }
    }

    await handleBandMessage({
      type: 'ask_gemini',
      model: 'lite',
      prompt: 'Сколько дней в високосном году?'
    })

    assert(sentToBand, 'Message must be sent to band')
    assert.strictEqual(sentToBand.type, 'gemini_response')
    assert.strictEqual(sentToBand.status, 'ok')
    assert.strictEqual(sentToBand.answer, '366 дней.')
    console.log('  ✓ Mock peerSocket received response:', JSON.stringify(sentToBand))
  }

  console.log('\n=== ALL 7 TESTS PASSED SUCCESSFULLY! ===\n')
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
