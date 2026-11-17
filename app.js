import './shared/device-polyfill'
import { MessageBuilder } from './shared/message'

App({
  globalData: {
    messageBuilder: null,
    selectedModel: 'hydrogen', // 'hydrogen' (default) or 'lite'
    enableReasoning: false,
    enableWebSearch: true, // Real-time internet search via companion
    chatMessages: [
      {
        role: 'model',
        text: 'Tap "Ask" below to type your question with keyboard.'
      }
    ],
    pendingQuestion: null,
    isLoading: false,
    onAnswerReceived: null
  },

  onCreate(options) {
    console.log('[Gemini Band] App Started')
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
    if (this.globalData.messageBuilder) {
      try {
        this.globalData.messageBuilder.disConnect()
      } catch (e) {}
    }
  }
})
