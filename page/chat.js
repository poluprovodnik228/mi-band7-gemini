// Главный экран: Чат с Gemini AI
// Обновленный современный дизайн под дисплей Xiaomi Smart Band 7 (192x490)

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

Page({
  state: {
    bgWidget: null,
    modelBtnWidget: null,
    statusTextWidget: null,
    qCardBg: null,
    qLabelWidget: null,
    qTextWidget: null,
    aCardBg: null,
    aLabelWidget: null,
    aTextWidget: null,
    askBtnWidget: null,
    pollTimer: null,
    vibrate: null,
    isRequesting: false
  },

  onInit() {
    console.log('[Chat Page] Init')
    try {
      if (typeof hmSensor !== 'undefined' && hmSensor.createSensor && hmSensor.id && hmSensor.id.VIBRATE) {
        this.state.vibrate = hmSensor.createSensor(hmSensor.id.VIBRATE)
      }
    } catch (e) {
      console.log('[Chat Vibrate Init Error]', e)
    }
  },

  hapticNotify() {
    if (this.state.vibrate) {
      try {
        this.state.vibrate.stop()
        this.state.vibrate.scene = 24
        this.state.vibrate.start()
      } catch (e) {}
    }
  },

  build() {
    if (typeof hmUI.setLayerScrolling === 'function') {
      hmUI.setLayerScrolling(true)
    }

    // 1. Черный AMOLED фон
    this.state.bgWidget = hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 192,
      h: 490,
      color: 0x000000
    })

    // 2. Верхняя капсула: Выбор модели (безопасная зона от скруглений y=28, x=24)
    const app = getApp()
    const globalData = (app && app.globalData) ? app.globalData : {}
    const isHydrogen = (globalData.selectedModel !== 'lite')
    const initModel = (isHydrogen ? '🧠 4 Hydrogen' : '⚡ 3.5 Lite') + ' ⚙️'

    this.state.modelBtnWidget = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 24,
      y: 28,
      w: 144,
      h: 32,
      radius: 16,
      text: initModel,
      color: 0x00F0FF,
      normal_color: 0x141B26,
      press_color: 0x222E40,
      text_size: 13,
      click_func: () => {
        this.hapticNotify()
        navigateTo('page/model_select')
      }
    })

    // 3. Статус готовности / индикатор ожидания
    this.state.statusTextWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 14,
      y: 64,
      w: 164,
      h: 20,
      text: '🟢 Готов к вопросу',
      text_size: 12,
      color: 0x00FF88,
      align_h: hmUI.align.CENTER_H
    })

    // 4. Карточка вопроса пользователя (ВЫ) - FILL_RECT для беспрепятственного скролла
    const qY = 88
    this.state.qCardBg = hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 12,
      y: qY,
      w: 168,
      h: 60,
      radius: 12,
      color: 0x141C2E
    })

    this.state.qLabelWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 22,
      y: qY + 8,
      w: 148,
      h: 18,
      text: '👤 ВЫ:',
      text_size: 11,
      color: 0x00E5FF
    })

    this.state.qTextWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 22,
      y: qY + 24,
      w: 148,
      h: 26,
      text: 'Пока нет вопроса',
      text_size: 13,
      color: 0xFFFFFF,
      text_style: hmUI.text_style.WRAP
    })

    // 5. Карточка ответа Gemini AI - FILL_RECT для беспрепятственного скролла
    const ansY = qY + 70
    this.state.aCardBg = hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 12,
      y: ansY,
      w: 168,
      h: 120,
      radius: 14,
      color: 0x101D24
    })

    this.state.aLabelWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 22,
      y: ansY + 8,
      w: 148,
      h: 18,
      text: isHydrogen ? '🧠 GEMINI (Hydrogen):' : '⚡ GEMINI (Lite):',
      text_size: 11,
      color: 0x00FFB0
    })

    this.state.aTextWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 22,
      y: ansY + 28,
      w: 148,
      h: 80,
      text: 'Нажмите «Спросить» внизу для ввода вопроса с клавиатуры.',
      text_size: 14,
      color: 0xFFFFFF,
      text_style: hmUI.text_style.WRAP
    })

    // 6. Главная кнопка: Задать вопрос
    this.state.askBtnWidget = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 16,
      y: 420,
      w: 160,
      h: 50,
      radius: 25,
      text: '💬 Спросить',
      text_size: 16,
      color: 0xFFFFFF,
      normal_color: 0x0066FF,
      press_color: 0x0044CC,
      click_func: () => {
        this.hapticNotify()
        navigateTo('page/keyboard')
      }
    })

    this.refreshUI()

    // Таймер опроса новых вопросов из клавиатуры
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

    if (app.globalData.pendingQuestion && !this.state.isRequesting) {
      const q = app.globalData.pendingQuestion
      app.globalData.pendingQuestion = null
      this.sendQuestion(q)
    }
  },

  sendQuestion(promptText) {
    const app = getApp()
    const globalData = app.globalData

    this.state.isRequesting = true
    globalData.isLoading = true
    globalData.lastQuestion = promptText
    globalData.lastAnswer = 'Ожидание ответа Gemini...'
    this.refreshUI()

    let finished = false
    const fallbackTimer = setTimeout(() => {
      if (!finished) {
        finished = true
        this.state.isRequesting = false
        globalData.isLoading = false
        globalData.lastAnswer = '⚠️ Нет ответа от телефона (15 сек).\nУбедитесь, что Zepp запущен на смартфоне.'
        this.hapticNotify()
        this.refreshUI()
      }
    }, 15000)

    const mb = globalData.messageBuilder
    if (mb) {
      console.log('[Chat] Sending request via MessageBuilder:', promptText)
      mb.request({
        prompt: promptText,
        model: globalData.selectedModel,
        reasoning: globalData.enableReasoning
      }, { timeout: 14000 })
      .then((res) => {
        if (!finished) {
          finished = true
          clearTimeout(fallbackTimer)
          this.state.isRequesting = false
          globalData.isLoading = false
          const ans = (res && (res.answer || res.data?.answer || res.text)) || (typeof res === 'string' ? res : 'Пустой ответ')
          globalData.lastAnswer = ans
          this.hapticNotify()
          this.refreshUI()
        }
      })
      .catch((err) => {
        if (!finished) {
          finished = true
          clearTimeout(fallbackTimer)
          this.state.isRequesting = false
          globalData.isLoading = false
          globalData.lastAnswer = '⚠️ Ошибка связи с телефоном.\nПроверьте Bluetooth и приложение Zepp.'
          this.hapticNotify()
          this.refreshUI()
        }
      })
    } else {
      finished = true
      clearTimeout(fallbackTimer)
      this.state.isRequesting = false
      globalData.isLoading = false
      globalData.lastAnswer = '⚠️ Модуль связи не инициализирован.'
      this.refreshUI()
    }
  },

  refreshUI() {
    const app = getApp()
    const globalData = (app && app.globalData) ? app.globalData : {}

    // 1. Верхний бейдж модели
    const isHydrogen = globalData.selectedModel === 'hydrogen'
    const modelLabel = (isHydrogen ? '🧠 4 Hydrogen' : '⚡ 3.5 Lite') +
                       (globalData.enableReasoning ? ' + 💭' : '') + ' ⚙️'

    if (this.state.modelBtnWidget) {
      this.state.modelBtnWidget.setProperty(hmUI.prop.TEXT, modelLabel)
    }

    // 2. Статус
    if (this.state.statusTextWidget) {
      if (globalData.isLoading) {
        this.state.statusTextWidget.setProperty(hmUI.prop.TEXT, '⏳ Gemini думает...')
        this.state.statusTextWidget.setProperty(hmUI.prop.COLOR, 0xFFAA00)
      } else {
        this.state.statusTextWidget.setProperty(hmUI.prop.TEXT, '🟢 Готов к вопросу')
        this.state.statusTextWidget.setProperty(hmUI.prop.COLOR, 0x00FF88)
      }
    }

    // 3. Вычисление размеров карточек с улучшенной точностью
    const qText = globalData.lastQuestion || 'Пока нет вопроса'
    const aText = globalData.lastAnswer || 'Нажмите «Спросить» внизу для ввода вопроса с клавиатуры.'

    // Высота карточки вопроса
    const qHeight = Math.max(24, estimateTextHeight(qText, 16, 20))
    const qCardH = 26 + qHeight + 12

    // Высота карточки ответа (шрифт 14px, межстрочный интервал 21px)
    const aHeight = Math.max(48, estimateTextHeight(aText, 15, 21))
    const aCardH = 32 + aHeight + 16

    const qY = 88
    const ansY = qY + qCardH + 12
    const askBtnY = Math.max(420, ansY + aCardH + 20)
    const totalContentH = askBtnY + 50 + 40

    // Обновляем карточку вопроса (FILL_RECT)
    if (this.state.qCardBg) {
      this.state.qCardBg.setProperty(hmUI.prop.MORE, {
        x: 12,
        y: qY,
        w: 168,
        h: qCardH,
        radius: 12,
        color: 0x141C2E
      })
    }
    if (this.state.qLabelWidget) {
      this.state.qLabelWidget.setProperty(hmUI.prop.MORE, {
        x: 22,
        y: qY + 8,
        w: 148,
        h: 18,
        text_size: 11,
        color: 0x00E5FF
      })
    }
    if (this.state.qTextWidget) {
      this.state.qTextWidget.setProperty(hmUI.prop.TEXT, qText)
      this.state.qTextWidget.setProperty(hmUI.prop.MORE, {
        x: 22,
        y: qY + 26,
        w: 148,
        h: qHeight,
        text_size: 13,
        color: 0xFFFFFF,
        text_style: hmUI.text_style.WRAP
      })
    }

    // Обновляем карточку ответа (FILL_RECT - не блокирует скролл)
    if (this.state.aCardBg) {
      this.state.aCardBg.setProperty(hmUI.prop.MORE, {
        x: 12,
        y: ansY,
        w: 168,
        h: aCardH,
        radius: 14,
        color: 0x101D24
      })
    }
    if (this.state.aLabelWidget) {
      this.state.aLabelWidget.setProperty(hmUI.prop.TEXT, isHydrogen ? '🧠 GEMINI (Hydrogen):' : '⚡ GEMINI (Lite):')
      this.state.aLabelWidget.setProperty(hmUI.prop.MORE, {
        x: 22,
        y: ansY + 8,
        w: 148,
        h: 18,
        text_size: 11,
        color: 0x00FFB0
      })
    }
    if (this.state.aTextWidget) {
      this.state.aTextWidget.setProperty(hmUI.prop.TEXT, aText)
      this.state.aTextWidget.setProperty(hmUI.prop.MORE, {
        x: 22,
        y: ansY + 28,
        w: 148,
        h: aHeight,
        text_size: 14,
        color: 0xFFFFFF,
        text_style: hmUI.text_style.WRAP
      })
    }

    // Обновляем кнопку спросить
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

    // Обновляем высоту фона для скролла
    if (this.state.bgWidget) {
      this.state.bgWidget.setProperty(hmUI.prop.MORE, {
        x: 0,
        y: 0,
        w: 192,
        h: Math.max(490, totalContentH),
        color: 0x000000
      })
    }
  },

  onDestroy() {
    if (this.state.pollTimer && typeof timer !== 'undefined' && timer.stopTimer) {
      try {
        timer.stopTimer(this.state.pollTimer)
      } catch (e) {}
    }
  }
})
