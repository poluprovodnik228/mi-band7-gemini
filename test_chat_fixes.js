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
  assert.match(calls[1], /flash-lite/)
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
      if (data.clear) resolveClear = resolve
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
