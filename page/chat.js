// Main Screen: Gemini AI Chat with Conversation History
// Optimized for Xiaomi Smart Band 7 (192x490) AMOLED pill display

import { getRequestTimeout } from '../shared/request-timeout'
import { vibrateClick, vibrateNotify } from '../shared/vibrate'

const BLE_GRACE_MS = 4000

function estimateTextHeight(text, charsPerLine, lineHeight) {
  if (!text) return lineHeight
  const paragraphs = text.split('\n')
  let totalLines = 0
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    totalLines += Math.max(1, Math.ceil(p.length / charsPerLine))
  }
  return totalLines * lineHeight
}

function navigateTo(url) {
  if (typeof hmApp !== 'undefined' && hmApp.gotoPage) {
    hmApp.gotoPage({ url })
  } else if (typeof hmRouter !== 'undefined' && hmRouter.push) {
    hmRouter.push({ url })
  }
}

function getModelBadgeText(globalData) {
  let name = 'Hydrogen'
  if (globalData.selectedModel === 'flash38') name = '3.8 Flash'
  else if (globalData.selectedModel === 'lite') name = '3.5 Lite'

  const web = (globalData.enableWebSearch !== false) ? ' +Web' : ''
  const rsn = globalData.enableReasoning ? ' +Think' : ''
  return `[${name}${web}${rsn}]`
}

Page({
  state: {
    modelBtnWidget: null,
    statusTextWidget: null,
    slots: [], // Pool of 6 message card slots: { bg, label, text }
    askBtnWidget: null,
    bottomSpacer: null,
    pollTimer: null,
    thinkingTimer: null,
    onChatChanged: null,
    isDestroyed: false
  },

  onInit() {
    console.log('[Chat Page] Init')
  },

  hapticNotify() {
    vibrateNotify()
  },

  startLoadingTimer() {
    if (this.state.thinkingTimer != null) return
    try {
      if (typeof timer !== 'undefined' && timer.createTimer) {
        this.state.thinkingTimer = timer.createTimer(
          1000,
          1000,
          () => this.refreshStatus(getApp().globalData),
          {}
        )
      }
    } catch (_) {}
  },

  stopLoadingTimer() {
    if (this.state.thinkingTimer != null && typeof timer !== 'undefined' && timer.stopTimer) {
      try {
        timer.stopTimer(this.state.thinkingTimer)
      } catch (_) {}
      this.state.thinkingTimer = null
    }
  },

  build() {
    if (typeof hmUI.setLayerScrolling === 'function') {
      hmUI.setLayerScrolling(true)
    }

    // 1. Model selection capsule at top (safe zone y=28, x=24)
    const app = getApp()
    const globalData = (app && app.globalData) ? app.globalData : {}
    const initModel = getModelBadgeText(globalData)

    this.state.modelBtnWidget = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 14,
      y: 28,
      w: 164,
      h: 32,
      radius: 16,
      text: initModel,
      color: 0x00F0FF,
      normal_color: 0x141B26,
      press_color: 0x222E40,
      text_size: 12,
      click_func: () => {
        vibrateClick()
        navigateTo('page/model_select')
      }
    })

    // 2. Status indicator
    this.state.statusTextWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 14,
      y: 64,
      w: 164,
      h: 20,
      text: 'Ready for question',
      text_size: 12,
      color: 0x00FF88,
      align_h: hmUI.align.CENTER_H
    })

    // 3. Pre-create pool of 6 message slots
    // Initialize without negative coordinates so Zepp OS layer bounds don't get corrupted
    this.state.slots = []
    const MAX_SLOTS = 6
    for (let i = 0; i < MAX_SLOTS; i++) {
      const bg = hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        radius: 12,
        color: 0x141C2E
      })
      const label = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        text: '',
        text_size: 11,
        color: 0x00E5FF
      })
      const text = hmUI.createWidget(hmUI.widget.TEXT, {
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        text: '',
        text_size: 14,
        color: 0xFFFFFF,
        text_style: hmUI.text_style.WRAP
      })
      if (typeof bg.setProperty === 'function' && hmUI.prop.VISIBLE !== undefined) {
        bg.setProperty(hmUI.prop.VISIBLE, false)
        label.setProperty(hmUI.prop.VISIBLE, false)
        text.setProperty(hmUI.prop.VISIBLE, false)
      }
      this.state.slots.push({ bg, label, text })
    }

    // 4. Main Action Button: Ask
    this.state.askBtnWidget = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 16,
      y: 420,
      w: 160,
      h: 50,
      radius: 25,
      text: 'Ask',
      text_size: 16,
      color: 0xFFFFFF,
      normal_color: 0x0066FF,
      press_color: 0x0044CC,
      click_func: () => {
        vibrateClick()
        navigateTo('page/keyboard')
      }
    })

    // 5. Bottom anchor spacer to ensure Zepp OS 1.0 layer scrolling recognizes overflowing height
    this.state.bottomSpacer = hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 0,
      y: 510,
      w: 192,
      h: 30,
      color: 0x000000
    })

    this.state.onChatChanged = (notify) => {
      if (notify) this.hapticNotify()
      this.refreshUI()
    }
    globalData.onChatChanged = this.state.onChatChanged
    this.refreshUI()

    // Poll for pending question from keyboard
    try {
      if (typeof timer !== 'undefined' && timer.createTimer) {
        this.state.pollTimer = timer.createTimer(
          200,
          250,
          () => {
            this.checkPendingQuestion()
          },
          {}
        )
      }
    } catch (e) {
      console.log('[Timer Error]', e)
    }
  },

  checkPendingQuestion() {
    const app = getApp()
    if (!app || !app.globalData) return

    if (app.globalData.pendingQuestion && !app.globalData.activeRequest && !app.globalData.isClearingContext) {
      const q = app.globalData.pendingQuestion
      app.globalData.pendingQuestion = null
      this.sendQuestion(q)
    }
  },

  sendQuestion(promptText) {
    const app = getApp()
    const globalData = app.globalData

    if (!globalData.chatMessages) {
      globalData.chatMessages = []
    }
    // Remove the initial single welcome message once user starts asking
    if (globalData.chatMessages.length === 1 && globalData.chatMessages[0].role === 'model') {
      globalData.chatMessages = []
    }

    const reqId = Date.now()
    // Append user question and pending model answer
    const answer = { role: 'model', text: 'Waiting for Gemini response...', reqId }
    globalData.chatMessages.push({ role: 'user', text: promptText }, answer)

    const request = { id: reqId, startedAt: Date.now() }
    globalData.pendingRequest = request
    globalData.activeRequest = request
    if (globalData.saveAppState) globalData.saveAppState()

    const reqTimeout = getRequestTimeout(globalData.selectedModel)
    this.refreshUI()

    const mb = globalData.messageBuilder
    if (mb) {
      console.log('[Chat] Sending request via MessageBuilder:', promptText)
      mb.request({
        requestId: reqId,
        prompt: promptText,
        model: globalData.selectedModel,
        reasoning: globalData.enableReasoning,
        webSearch: globalData.enableWebSearch !== false
      }, { timeout: reqTimeout + BLE_GRACE_MS })
      .then((res) => {
        let ans = (res && (res.answer || res.data?.answer || res.text)) || (typeof res === 'string' ? res : 'Empty response')
        if (res && (res.status === 'error' || res.data?.status === 'error') && !ans.startsWith('[!]')) {
          ans = '[!] ' + ans
        }
        this.applyAnswer(ans, false, request)
      })
      .catch((err) => {
        console.log('[Chat] Direct BLE request error or timeout:', err)
        // If notification interrupted the band or app was destroyed:
        // Do NOT overwrite or delete the waiting card! Polling will recover the result once phone finishes.
        if (!this.state.isDestroyed) {
          const isTimeout = /timeout|timed out/i.test(err && (err.message || err))
          this.applyAnswer(isTimeout
            ? '[!] Request timed out.\nCheck the Zepp app and phone internet.'
            : '[!] Phone connection error.\nCheck Bluetooth and Zepp app.', true, request)
        }
      })
    } else {
      this.applyAnswer('[!] Bridge module not initialized.', true, request)
    }
  },

  applyAnswer(text, isError = false, targetRequest = null) {
    const app = getApp()
    if (!app || !app.globalData) return
    const globalData = app.globalData
    if (!globalData.activeRequest && !globalData.pendingRequest) return
    if (targetRequest && globalData.activeRequest !== targetRequest) return

    globalData.activeRequest = null
    globalData.pendingRequest = null

    const msgs = globalData.chatMessages
    if (Array.isArray(msgs) && msgs.length > 0) {
      const lastMsg = msgs[msgs.length - 1]
      if (lastMsg && lastMsg.role === 'model') {
        lastMsg.text = text
      } else {
        msgs.push({ role: 'model', text })
      }
    }

    if (globalData.saveAppState) globalData.saveAppState()
    if (globalData.onChatChanged) globalData.onChatChanged(true)
    this.refreshUI()
  },

  refreshStatus(globalData) {
    const widget = this.state.statusTextWidget
    if (!widget) return
    const request = globalData.activeRequest
    const seconds = request ? Math.floor((Date.now() - request.startedAt) / 1000) : 0
    widget.setProperty(hmUI.prop.TEXT, request ? `Thinking... (${seconds}s)` : 'Ready for question')
    widget.setProperty(hmUI.prop.COLOR, request ? 0xFFAA00 : 0x00FF88)

    // Polling phone companion for background completion
    if (request && seconds > 0 && seconds % 2 === 0 && globalData.messageBuilder) {
      globalData.messageBuilder.request({
        action: 'poll_status',
        requestId: request.id
      }, { timeout: 2000 })
      .then((res) => {
        const data = (res && res.data) ? res.data : res
        if (data && (data.status === 'ok' || data.status === 'done') && data.answer) {
          this.applyAnswer(data.answer, false)
        } else if (data && data.status === 'error' && data.answer) {
          this.applyAnswer(data.answer, true)
        }
      })
      .catch(() => {})
    }
  },

  refreshUI() {
    const app = getApp()
    const globalData = (app && app.globalData) ? app.globalData : {}
    const isHydrogen = (globalData.selectedModel !== 'lite')

    // 1. Model Badge with Internet & Reasoning icons
    const modelLabel = getModelBadgeText(globalData)
    if (this.state.modelBtnWidget) {
      this.state.modelBtnWidget.setProperty(hmUI.prop.TEXT, modelLabel)
    }

    // 2. Status
    this.refreshStatus(globalData)
    if (globalData.activeRequest) this.startLoadingTimer()
    else this.stopLoadingTimer()

    // 3. Render conversation stream (up to last 6 messages)
    const msgs = (globalData.chatMessages && globalData.chatMessages.length > 0)
      ? globalData.chatMessages.slice(-6)
      : [{ role: 'model', text: 'Tap "Ask" below to type your question with keyboard.' }]

    let curY = 88
    const maxSlots = 6

    for (let i = 0; i < maxSlots; i++) {
      const slot = this.state.slots[i]
      if (!slot) continue

      if (i < msgs.length) {
        const msg = msgs[i]
        const isUser = (msg.role === 'user')
        const charsPerLine = isUser ? 16 : 15
        const lineHeight = isUser ? 20 : 21
        const fontSize = isUser ? 13 : 14
        const textH = Math.max(22, estimateTextHeight(msg.text, charsPerLine, lineHeight))
        const cardH = 30 + textH + 12

        const roleText = isUser ? 'YOU:' : (isHydrogen ? 'GEMINI (Hydrogen):' : 'GEMINI (Lite):')
        const roleColor = isUser ? 0x00E5FF : 0x00FF88
        const cardBgColor = isUser ? 0x141C2E : 0x101D24
        const radius = isUser ? 12 : 14

        if (typeof slot.bg.setProperty === 'function' && hmUI.prop.VISIBLE !== undefined) {
          slot.bg.setProperty(hmUI.prop.VISIBLE, true)
          slot.label.setProperty(hmUI.prop.VISIBLE, true)
          slot.text.setProperty(hmUI.prop.VISIBLE, true)
        }

        slot.bg.setProperty(hmUI.prop.MORE, {
          x: 12,
          y: curY,
          w: 168,
          h: cardH,
          radius: radius,
          color: cardBgColor
        })

        slot.label.setProperty(hmUI.prop.TEXT, roleText)
        slot.label.setProperty(hmUI.prop.MORE, {
          x: 22,
          y: curY + 8,
          w: 148,
          h: 18,
          text_size: 11,
          color: roleColor
        })

        slot.text.setProperty(hmUI.prop.TEXT, msg.text)
        slot.text.setProperty(hmUI.prop.MORE, {
          x: 22,
          y: curY + 28,
          w: 148,
          h: textH,
          text_size: fontSize,
          color: 0xFFFFFF,
          text_style: hmUI.text_style.WRAP
        })

        curY += cardH + 10
      } else {
        // Hide unused slot
        if (typeof slot.bg.setProperty === 'function' && hmUI.prop.VISIBLE !== undefined) {
          slot.bg.setProperty(hmUI.prop.VISIBLE, false)
          slot.label.setProperty(hmUI.prop.VISIBLE, false)
          slot.text.setProperty(hmUI.prop.VISIBLE, false)
        }
        slot.bg.setProperty(hmUI.prop.MORE, { x: 0, y: 0, w: 0, h: 0, radius: 0, color: 0x000000 })
        slot.label.setProperty(hmUI.prop.MORE, { x: 0, y: 0, w: 0, h: 0, text_size: 11, color: 0x000000 })
        slot.text.setProperty(hmUI.prop.MORE, { x: 0, y: 0, w: 0, h: 0, text_size: 14, color: 0x000000 })
      }
    }

    // 4. Position Ask Button below the last message
    const askBtnY = Math.max(420, curY + 12)
    if (this.state.askBtnWidget) {
      this.state.askBtnWidget.setProperty(hmUI.prop.MORE, {
        x: 16,
        y: askBtnY,
        w: 160,
        h: 50,
        radius: 25,
        text_size: 16,
        color: 0xFFFFFF,
        normal_color: 0x0066FF
      })
    }

    // 5. Expand bottom spacer so Zepp OS layer scrolling accommodates all message cards
    if (this.state.bottomSpacer) {
      this.state.bottomSpacer.setProperty(hmUI.prop.MORE, {
        x: 0,
        y: askBtnY + 54,
        w: 192,
        h: 40,
        color: 0x000000
      })
    }
  },

  onDestroy() {
    this.state.isDestroyed = true
    const globalData = getApp().globalData
    if (globalData.onChatChanged === this.state.onChatChanged) globalData.onChatChanged = null
    this.stopLoadingTimer()
    if (this.state.pollTimer && typeof timer !== 'undefined' && timer.stopTimer) {
      try {
        timer.stopTimer(this.state.pollTimer)
      } catch (e) {}
    }
  }
})
