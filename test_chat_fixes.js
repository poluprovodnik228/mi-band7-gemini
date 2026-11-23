const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const { runInContext, createContext } = require('node:vm')

function load(path, context) {
  const source = readFileSync(join(__dirname, path), 'utf8')
  runInContext(source.replace(/^import .+\n/gm, '').replace(/^export /gm, ''), context, { filename: path })
}

const flush = () => new Promise(setImmediate)

function companion(fetch) {
  let service, handler
  class MessageBuilder {
    listen() {}
    on(_, callback) { handler = callback }
  }
  const context = createContext({
    Date, setTimeout, clearTimeout, fetch, MessageBuilder,
    console: { log() {}, warn() {}, error() {} },
    AppSideService: (value) => { service = value }
  })
  load('shared/request-timeout.js', context)
  load('app-side/index.js', context)
  service.onInit()
  return async (payload) => {
    let result
    await handler({ request: { payload }, response: ({ data }) => { result = data } })
    return result
  }
}

function modelAnswer(text) {
  return { status: 200, body: { candidates: [{ content: { parts: [{ text }] } }] } }
}

test('a stalled web search leaves only the rest of Lite’s 25-second budget for the API', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] })
  const calls = []
  const ask = companion(({ url }) => {
    calls.push(url)
    return new Promise(() => {})
  })
  const response = ask({ prompt: 'What is new?', model: 'lite' })
  await flush()
  assert.match(calls[0], /duckduckgo/)
  t.mock.timers.tick(3000)
  await flush()
  assert.match(calls[1], /flash-lite/)
  t.mock.timers.tick(22000)
  assert.match((await response).answer, /timed out/i)
})

test('the fallback shares Hydrogen’s deadline instead of starting a new one', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] })
  const calls = []
  const ask = companion(({ url }) => {
    calls.push(url)
    if (calls.length === 1) return new Promise((resolve) => setTimeout(() => resolve({ status: 503 }), 119000))
    return new Promise(() => {})
  })
  const response = ask({ prompt: 'Ask Hydrogen', webSearch: false })
  await flush()
  t.mock.timers.tick(119000)
  await flush()
  assert.match(calls[0], /hydrogen/)
  assert.match(calls[1], /flash/)
  t.mock.timers.tick(1000)
  assert.match((await response).answer, /timed out/i)
})

test('an answer arriving after a confirmed clear does not restore phone history', async () => {
  let resolveOld
  let latestBody
  const ask = companion(({ body }) => {
    latestBody = JSON.parse(body)
    if (!resolveOld) return new Promise((resolve) => { resolveOld = resolve })
    return modelAnswer('New answer')
  })
  const first = ask({ prompt: 'Old question', webSearch: false })
  await flush()
  assert.equal((await ask({ clear: true })).status, 'ok')
  resolveOld(modelAnswer('Late answer'))
  await first
  await ask({ prompt: 'New question', webSearch: false })
  assert.deepEqual(latestBody.contents, [{ role: 'user', parts: [{ text: 'New question' }] }])
})

test('a timed-out clear waiting on BLE handshake is never sent later', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] })
  const context = createContext({ Date, setTimeout, clearTimeout, Logger: { getLogger() {} } })
  load('shared/js-module.js', context)
  load('shared/event.js', context)
  load('shared/defer.js', context)
  load('shared/request-timeout.js', context)
  load('shared/message.js', context)
  const bridge = runInContext('new MessageBuilder()', context)
  let sent = false
  bridge.sendJson = () => { sent = true }
  const timedOut = assert.rejects(bridge.request({ clear: true }, { timeout: 5000 }), /timed out/i)
  t.mock.timers.tick(5000)
  await timedOut
  bridge.shakeTask.resolve()
  await flush()
  assert.equal(sent, false)
  assert.equal(bridge.count('response'), 0)
  assert.equal(bridge.count('error'), 0)
})

test('the watch keeps history on reset failure and ignores late answers after success', async () => {
  const app = { globalData: { selectedModel: 'lite', chatMessages: [] } }
  let page, backs = 0, status, resolveAnswer, resolveClear
  const context = createContext({
    getApp: () => app, Page: (value) => { page = value },
    hmApp: { goBack: () => { backs++ } }, hmUI: { prop: { TEXT: 'text' } }, console: { log() {} }
  })
  load('shared/request-timeout.js', context)
  load('page/chat.js', context)
  const chat = page
  chat.refreshUI = () => {}
  load('page/model_select.js', context)
  const settings = page
  settings.state.clearBtn = { setProperty: (_, text) => { status = text } }
  app.globalData.messageBuilder = {
    request: (data, opts) => new Promise((resolve, reject) => {
      if (data.ping) resolve({ status: 'ok', pong: true })
      else if (data.clear) resolveClear = resolve
      else if (!resolveAnswer) {
        assert.equal(opts.timeout, 29000)
        resolveAnswer = resolve
      } else reject(new Error('Timed out in 29000ms.'))
    })
  }

  chat.sendQuestion('First question')
  const failed = settings.clearContext(app.globalData)
  assert.equal(app.globalData.chatMessages.length, 2)
  assert.equal(backs, 0)
  resolveClear({ status: 'error' })
  await failed
  assert.match(status, /retry/i)
  assert.equal(app.globalData.chatMessages.length, 2)

  const cleared = settings.clearContext(app.globalData)
  resolveClear({ status: 'ok' })
  await cleared
  resolveAnswer({ answer: 'Late answer' })
  await flush()
  assert.equal(backs, 1)
  assert.equal(app.globalData.chatMessages.length, 1)
  assert.match(app.globalData.chatMessages[0].text, /context cleared/i)

  chat.sendQuestion('Next question')
  await flush()
  assert.match(app.globalData.chatMessages[1].text, /timed out/i)
  assert.equal(app.globalData.activeRequest, null)
})

test('keyboard preserves draft when leaving and clears it on send', async () => {
  let page, appInst, backs = 0
  const context = createContext({
    getApp: () => appInst,
    Page: (val) => { page = val },
    App: (val) => { appInst = val },
    hmApp: { goBack: () => { backs++ } },
    hmUI: {
      widget: { FILL_RECT: 1, TEXT: 2, BUTTON: 3 },
      prop: { MORE: 1, TEXT: 2, COLOR: 3, NORMAL_COLOR: 4 },
      text_style: { WRAP: 1 },
      align: { LEFT: 1 },
      setLayerScrolling() {},
      createWidget: () => ({ setProperty() {} })
    },
    hmSensor: { createSensor: () => null, id: {} },
    console: { log() {} }
  })
  load('shared/data.js', context)
  load('shared/storage.js', context)
  load('app.js', context)
  appInst.onCreate()

  load('page/keyboard.js', context)
  const kb = page
  kb.build()

  kb.state.text = 'Привет как дела'
  kb.syncDraft()
  assert.equal(appInst.globalData.keyboardDraft, 'Привет как дела')

  // Simulate leaving keyboard (onDestroy)
  kb.onDestroy()
  assert.equal(appInst.globalData.keyboardDraft, 'Привет как дела')

  // Re-open keyboard
  const kb2 = page
  kb2.build()
  assert.equal(kb2.state.text, 'Привет как дела')

  // Submit prompt
  kb2.submitPrompt()
  assert.equal(appInst.globalData.pendingQuestion, 'Привет как дела')
  assert.equal(appInst.globalData.keyboardDraft, '')
  assert.equal(backs, 1)
})

test('long keyboard text displays tail so user sees active typing area', async () => {
  let page, displayedText = ''
  const context = createContext({
    getApp: () => ({ globalData: {} }),
    Page: (val) => { page = val },
    hmApp: { goBack() {} },
    hmUI: {
      widget: { FILL_RECT: 1, TEXT: 2, BUTTON: 3 },
      prop: { MORE: 1, TEXT: 2, COLOR: 3, NORMAL_COLOR: 4 },
      text_style: { WRAP: 1 },
      align: { LEFT: 1 },
      setLayerScrolling() {},
      createWidget: () => ({
        setProperty(prop, val) {
          if (prop === 2) displayedText = val
        }
      })
    },
    hmSensor: { createSensor: () => null, id: {} },
    console: { log() {} }
  })
  load('page/keyboard.js', context)
  page.build()
  page.state.text = 'Это очень длинный вопрос к искусственному интеллекту, который превышает размер карточки'
  page.updateTextUI()

  assert.match(displayedText, /^…/)
  assert.equal(displayedText.endsWith('размер карточки'), true)
  assert.equal(displayedText.length <= 45, true)
})

test('chat messages and settings survive simulated app restart / notification interrupt', async () => {
  let appInst
  const files = new Map()
  const makeHmFS = () => ({
    O_CREAT: 1, O_RDWR: 2, O_TRUNC: 4, O_RDONLY: 8, SEEK_SET: 0,
    open: (fn) => fn,
    seek: () => 0,
    write: (fn, buf, offset, length) => {
      files.set(fn, Buffer.from(buf).subarray(offset, offset + length))
    },
    read: (fn, buf, offset, length) => {
      const data = files.get(fn)
      if (data) data.copy(Buffer.from(buf), offset, 0, length)
    },
    stat: (fn) => {
      const data = files.get(fn)
      return data ? [{ size: data.length }, 0] : [null, -1]
    },
    close: () => 0
  })

  const context = createContext({
    Buffer,
    getApp: () => appInst,
    App: (val) => { appInst = val },
    Page: () => {},
    hmFS: makeHmFS(),
    console: { log() {} }
  })
  load('shared/data.js', context)
  load('shared/storage.js', context)
  load('app.js', context)

  appInst.onCreate()
  appInst.globalData.chatMessages = [
    { role: 'user', text: 'Какая сегодня погода?' },
    { role: 'model', text: 'Солнечно, +20C' }
  ]
  appInst.globalData.selectedModel = 'lite'
  appInst.globalData.enableReasoning = true
  appInst.globalData.saveAppState()
  appInst.onDestroy()

  // App is killed and restarted fresh by Zepp OS
  const context2 = createContext({
    Buffer,
    getApp: () => appInst,
    App: (val) => { appInst = val },
    Page: () => {},
    hmFS: makeHmFS(),
    console: { log() {} }
  })
  load('shared/data.js', context2)
  load('shared/storage.js', context2)
  load('app.js', context2)
  appInst.onCreate()

  assert.equal(appInst.globalData.chatMessages.length, 2)
  assert.equal(appInst.globalData.chatMessages[0].text, 'Какая сегодня погода?')
  assert.equal(appInst.globalData.chatMessages[1].text, 'Солнечно, +20C')
  assert.equal(appInst.globalData.selectedModel, 'lite')
  assert.equal(appInst.globalData.enableReasoning, true)
})

test('interruption on app destroy suppresses connection errors in chat and preserves query for recovery', async () => {
  const app = { globalData: { selectedModel: 'lite', chatMessages: [] } }
  let page
  const context = createContext({
    getApp: () => app,
    Page: (val) => { page = val },
    hmUI: { prop: { TEXT: 'text' } },
    console: { log() {} }
  })
  load('shared/request-timeout.js', context)
  load('page/chat.js', context)
  const chat = page
  chat.refreshUI = () => {}

  let rejectReq
  app.globalData.messageBuilder = {
    request: () => new Promise((_, reject) => { rejectReq = reject })
  }

  chat.sendQuestion('Test question')
  assert.equal(app.globalData.chatMessages.length, 2)

  // User exits or notification arrives
  chat.onDestroy()
  rejectReq(new Error('BLE disconnected'))
  await flush()

  // Chat does not contain raw error, query is preserved so companion polling can recover answer
  assert.equal(app.globalData.chatMessages.length, 2)
  assert.equal(app.globalData.chatMessages[0].text, 'Test question')
  assert.equal(app.globalData.chatMessages[1].text, 'Waiting for Gemini response...')
})

test('primary model network exception triggers fallback to 3.8 Flash', async () => {
  const calls = []
  const ask = companion((arg1) => {
    const url = typeof arg1 === 'string' ? arg1 : (arg1 && arg1.url)
    calls.push(url)
    if (/hydrogen/.test(url)) {
      throw new Error('Network failure: failed to connect')
    }
    return Promise.resolve({
      status: 200,
      json: () => Promise.resolve({
        candidates: [{
          content: { parts: [{ text: 'Fallback response from 3.8 Flash' }] }
        }]
      })
    })
  })

  const res = await ask({ prompt: 'Test question', model: 'hydrogen', webSearch: false })
  assert.ok(calls.some((u) => /hydrogen/.test(u)))
  assert.ok(calls.some((u) => /3\.8-flash/.test(u)))
  assert.equal(res.status, 'ok')
  assert.match(res.answer, /Fallback response from 3.8 Flash/)
  assert.match(res.answer, /3\.8 Flash/)
})

test('server 503 high demand informs user of overload and falls back to Flash-Lite if 3.8 is also down', async () => {
  const calls = []
  const ask = companion((arg1) => {
    const url = typeof arg1 === 'string' ? arg1 : (arg1 && arg1.url)
    calls.push(url)
    if (/hydrogen|3\.8-flash/.test(url)) {
      return Promise.resolve({
        status: 503,
        json: () => Promise.resolve({
          error: {
            code: 503,
            message: 'This model is currently experiencing high demand.',
            status: 'UNAVAILABLE'
          }
        })
      })
    }
    return Promise.resolve({
      status: 200,
      json: () => Promise.resolve({
        candidates: [{
          content: { parts: [{ text: 'Here is your answer' }] }
        }]
      })
    })
  })

  const res = await ask({ prompt: 'Tell me about quantum', model: 'hydrogen', webSearch: false })
  assert.ok(calls.some((u) => /hydrogen/.test(u)))
  assert.ok(calls.some((u) => /3\.8-flash/.test(u)))
  assert.ok(calls.some((u) => /flash-lite/.test(u)))
  assert.equal(res.status, 'ok')
  assert.match(res.answer, /перегружены.*503/i)
  assert.match(res.answer, /3\.5 Flash-Lite/)
  assert.match(res.answer, /Here is your answer/)
})

test('when hydrogen is overloaded, it succeeds via 3.8 flash if available', async () => {
  const calls = []
  const ask = companion((arg1) => {
    const url = typeof arg1 === 'string' ? arg1 : (arg1 && arg1.url)
    calls.push(url)
    if (/hydrogen/.test(url)) {
      return Promise.resolve({
        status: 503,
        json: () => Promise.resolve({
          error: { code: 503, message: 'High demand' }
        })
      })
    }
    return Promise.resolve({
      status: 200,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: 'Answer from 3.8 Flash' }] } }]
      })
    })
  })

  const res = await ask({ prompt: 'Test question', model: 'hydrogen', webSearch: false })
  assert.equal(calls.length, 2)
  assert.match(calls[0], /hydrogen/)
  assert.match(calls[1], /3\.8-flash/)
  assert.equal(res.status, 'ok')
  assert.match(res.answer, /3\.8 Flash/)
  assert.match(res.answer, /Answer from 3.8 Flash/)
})

test('flash38 model can be selected and calls gemini-3.8-flash endpoint', async () => {
  const calls = []
  const ask = companion((arg1) => {
    const url = typeof arg1 === 'string' ? arg1 : (arg1 && arg1.url)
    calls.push(url)
    return Promise.resolve({
      status: 200,
      json: () => Promise.resolve({
        candidates: [{
          content: { parts: [{ text: 'Response from 3.8 Flash' }] }
        }]
      })
    })
  })

  const res = await ask({ prompt: 'Quick query', model: 'flash38', webSearch: false })
  assert.ok(calls.some((u) => /gemini-3\.8-flash/.test(u)))
  assert.equal(res.status, 'ok')
  assert.equal(res.answer, 'Response from 3.8 Flash')
})

test('vibration singleton reuses same sensor instance across keyboard and chat', () => {
  let createdCount = 0
  let startedCount = 0
  let currentTime = 1000
  const mockSensor = {
    scene: 0,
    start() { startedCount++ },
    stop() {}
  }
  const app = { globalData: {} }
  const context = createContext({
    getApp: () => app,
    Date: { now: () => { currentTime += 200; return currentTime } },
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    hmSensor: {
      id: { VIBRATE: 1 },
      createSensor: (id) => {
        createdCount++
        return mockSensor
      }
    },
    console: { log() {} }
  })
  load('shared/vibrate.js', context)
  const { vibrateClick, vibrateNotify } = context

  vibrateClick()
  assert.equal(createdCount, 1)
  assert.equal(startedCount, 1)
  assert.equal(mockSensor.scene, 24)

  vibrateClick()
  assert.equal(createdCount, 1)
  assert.equal(startedCount, 2)

  vibrateNotify()
  assert.equal(createdCount, 1)
  assert.equal(startedCount, 3)
  assert.equal(mockSensor.scene, 25)
})

