// Экран настройки и выбора модели Gemini AI
// Обновленный OLED дизайн
import { vibrateClick } from '../shared/vibrate'

function goBack() {
  if (typeof hmApp !== 'undefined' && hmApp.goBack) {
    hmApp.goBack()
  } else if (typeof hmRouter !== 'undefined' && hmRouter.back) {
    hmRouter.back()
  }
}

Page({
  state: {
    reasoningBtn: null,
    webSearchBtn: null,
    modelBtns: {},
    clearBtn: null
  },

  onInit() {},

  clickHaptic() {
    vibrateClick()
  },

  build() {
    if (typeof hmUI !== 'undefined' && hmUI.setLayerScrolling) {
      hmUI.setLayerScrolling(false)
    }

    const app = getApp()
    const globalData = (app && app.globalData) ? app.globalData : {}

    // Черный фон
    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 192,
      h: 490,
      color: 0x000000
    })

    // Заголовок экрана
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 12,
      y: 16,
      w: 168,
      h: 26,
      text: 'AI Settings',
      text_size: 16,
      color: 0x00F0FF,
      align_h: hmUI.align.CENTER_H
    })

    // 1. Тумблер глубоких рассуждений (слева)
    this.state.reasoningBtn = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 10,
      y: 48,
      w: 82,
      h: 46,
      radius: 12,
      text: globalData.enableReasoning ? 'Think\nON' : 'Think\nOFF',
      text_size: 12,
      color: globalData.enableReasoning ? 0x00FF88 : 0x8899AA,
      normal_color: 0x161C26,
      press_color: 0x242F40,
      click_func: () => {
        this.clickHaptic()
        globalData.enableReasoning = !globalData.enableReasoning
        if (globalData.saveAppState) globalData.saveAppState()
        const isEnabled = globalData.enableReasoning
        this.state.reasoningBtn.setProperty(
          hmUI.prop.TEXT,
          isEnabled ? 'Think\nON' : 'Think\nOFF'
        )
        this.state.reasoningBtn.setProperty(
          hmUI.prop.COLOR,
          isEnabled ? 0x00FF88 : 0x8899AA
        )
      }
    })

    // 2. Тумблер живого веб-поиска (справа)
    const isWeb = (globalData.enableWebSearch !== false)
    this.state.webSearchBtn = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 100,
      y: 48,
      w: 82,
      h: 46,
      radius: 12,
      text: isWeb ? 'Web\nON' : 'Web\nOFF',
      text_size: 12,
      color: isWeb ? 0x00F0FF : 0x8899AA,
      normal_color: 0x161C26,
      press_color: 0x242F40,
      click_func: () => {
        this.clickHaptic()
        globalData.enableWebSearch = (globalData.enableWebSearch === false) ? true : false
        if (globalData.saveAppState) globalData.saveAppState()
        const active = (globalData.enableWebSearch !== false)
        this.state.webSearchBtn.setProperty(
          hmUI.prop.TEXT,
          active ? 'Web\nON' : 'Web\nOFF'
        )
        this.state.webSearchBtn.setProperty(
          hmUI.prop.COLOR,
          active ? 0x00F0FF : 0x8899AA
        )
      }
    })

    // 3. Три целевые модели (Hydrogen по умолчанию)
    const models = [
      {
        id: 'hydrogen',
        title: '4 Hydrogen',
        subtitle: 'Deep reasoning & logic'
      },
      {
        id: 'flash38',
        title: '3.8 Flash',
        subtitle: 'Latest balanced speed'
      },
      {
        id: 'lite',
        title: '3.5 Flash-Lite',
        subtitle: 'Fastest reply (<1.0s)'
      }
    ]

    let startY = 98
    models.forEach((m) => {
      const isSelected = (globalData.selectedModel || 'hydrogen') === m.id
      const btn = hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 10,
        y: startY,
        w: 172,
        h: 64,
        radius: 13,
        text: `${isSelected ? '(*) ' : '( ) '}${m.title}\n${m.subtitle}`,
        text_size: 12,
        color: isSelected ? 0x00F0FF : 0xAAAAAA,
        normal_color: isSelected ? 0x003366 : 0x141A24,
        press_color: 0x005599,
        click_func: () => {
          this.clickHaptic()
          globalData.selectedModel = m.id
          if (globalData.saveAppState) globalData.saveAppState()
          this.updateModelButtons(models)
          goBack()
        }
      })
      this.state.modelBtns[m.id] = btn
      startY += 70
    })

    // 4. Кнопка сброса контекста диалога
    this.state.clearBtn = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 14,
      y: 312,
      w: 164,
      h: 42,
      radius: 14,
      text: 'Clear Context',
      text_size: 13,
      color: 0xFFAA88,
      normal_color: 0x28181C,
      press_color: 0x442026,
      click_func: () => {
        this.clickHaptic()
        this.clearContext(globalData)
      }
    })

    // 5. Кнопка возврата в чат
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 14,
      y: 362,
      w: 164,
      h: 44,
      radius: 22,
      text: '< Back to Chat',
      text_size: 15,
      color: 0xFFFFFF,
      normal_color: 0x1E2430,
      press_color: 0x333D50,
      click_func: () => {
        this.clickHaptic()
        goBack()
      }
    })
  },

  clearContext(globalData) {
    if (globalData.isClearingContext) return
    const button = this.state.clearBtn
    const bridge = globalData.messageBuilder
    if (!bridge) {
      button.setProperty(hmUI.prop.TEXT, 'No phone connection')
      return
    }

    globalData.isClearingContext = true
    button.setProperty(hmUI.prop.TEXT, 'Clearing...')
    return bridge.request({ clear: true }, { timeout: 5000 }).then((res) => {
      if ((res?.data || res)?.status !== 'ok') throw new Error('Clear not confirmed')
    }).then(() => {
      globalData.isClearingContext = false
      globalData.activeRequest = null
      globalData.pendingRequest = null
      globalData.pendingQuestion = null
      globalData.chatMessages = [
        { role: 'model', text: 'Context cleared. Ready for new questions.' }
      ]
      if (globalData.saveAppState) globalData.saveAppState()
      if (this.state.clearBtn === button) goBack()
      else if (globalData.onChatChanged) globalData.onChatChanged()
    }, () => {
      globalData.isClearingContext = false
      if (this.state.clearBtn === button) button.setProperty(hmUI.prop.TEXT, 'No confirmation. Retry')
    })
  },

  updateModelButtons(models) {
    const app = getApp()
    const globalData = (app && app.globalData) ? app.globalData : {}
    models.forEach((m) => {
      const isSelected = (globalData.selectedModel || 'hydrogen') === m.id
      const btn = this.state.modelBtns[m.id]
      if (btn) {
        btn.setProperty(hmUI.prop.TEXT, `${isSelected ? '(*) ' : '( ) '}${m.title}\n${m.subtitle}`)
        btn.setProperty(hmUI.prop.COLOR, isSelected ? 0x00F0FF : 0xAAAAAA)
        btn.setProperty(hmUI.prop.NORMAL_COLOR, isSelected ? 0x003366 : 0x141A24)
      }
    })
  },

  onDestroy() {
    this.state.clearBtn = null
  }
})
