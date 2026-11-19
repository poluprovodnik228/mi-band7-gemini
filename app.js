import './shared/device-polyfill'
import { MessageBuilder } from './shared/message'
import { loadState, saveState } from './shared/storage'

App({
  globalData: {
    messageBuilder: null,
    selectedModel: 'hydrogen', // 'hydrogen' (default), 'flash38', or 'lite'
    enableReasoning: false,
    enableWebSearch: true, // Real-time internet search via companion
    chatMessages: [
      {
        role: 'model',
        text: 'Tap "Ask" below to type your question with keyboard.'
      }
    ],
    keyboardDraft: '',
    pendingQuestion: null,
    activeRequest: null,
    isClearingContext: false,
    onChatChanged: null,
    saveAppState() {
      try {
        saveState({
          chatMessages: this.chatMessages,
          keyboardDraft: this.keyboardDraft,
          selectedModel: this.selectedModel,
          enableReasoning: this.enableReasoning,
          enableWebSearch: this.enableWebSearch
        })
      } catch (_) {}
    }
  },

  onCreate(options) {
    console.log('[Gemini Band] App Started')
    try {
      const saved = loadState()
      if (saved) {
        if (Array.isArray(saved.chatMessages) && saved.chatMessages.length > 0) {
          this.globalData.chatMessages = saved.chatMessages
        }
        if (typeof saved.keyboardDraft === 'string') {
          this.globalData.keyboardDraft = saved.keyboardDraft
        }
        if (saved.selectedModel && ['hydrogen', 'flash38', 'lite'].includes(saved.selectedModel)) {
          this.globalData.selectedModel = saved.selectedModel
        }
        if (typeof saved.enableReasoning === 'boolean') {
          this.globalData.enableReasoning = saved.enableReasoning
        }
        if (typeof saved.enableWebSearch === 'boolean') {
          this.globalData.enableWebSearch = saved.enableWebSearch
        }
        const lastMsg = this.globalData.chatMessages[this.globalData.chatMessages.length - 1]
        if (lastMsg && lastMsg.role === 'model' && lastMsg.text === 'Waiting for Gemini response...') {
          this.globalData.chatMessages.pop()
        }
        console.log('[Gemini Band] Restored state from flash storage')
      }
    } catch (e) {
      console.log('[Gemini Band State Restore Error]', e)
    }

    try {
      const appId = 1098234
      this.globalData.messageBuilder = new MessageBuilder({ appId })
      this.globalData.messageBuilder.connect()
      console.log('[Gemini Band] MessageBuilder Connected')
    } catch (e) {
      console.log('[MessageBuilder Connect Error]', e)
    }
  },

  onDestroy(options) {
    console.log('[Gemini Band] App Closed')
    try {
      if (this.globalData.saveAppState) {
        this.globalData.saveAppState()
      }
    } catch (_) {}
    if (this.globalData.messageBuilder) {
      try {
        this.globalData.messageBuilder.disConnect()
      } catch (e) {}
    }
  }
})
