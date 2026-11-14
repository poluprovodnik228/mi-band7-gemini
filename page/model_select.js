// Экран настройки и выбора модели Gemini AI
// Обновленный OLED дизайн

function goBack() {
  if (typeof hmApp !== 'undefined' && hmApp.goBack) {
    hmApp.goBack()
  } else if (typeof hmRouter !== 'undefined' && hmRouter.back) {
    hmRouter.back()
  }
}

Page({
  state: {
    vibrate: null,
    reasoningBtn: null,
    modelBtns: {}
  },

  onInit() {
    try {
      if (typeof hmSensor !== 'undefined' && hmSensor.createSensor && hmSensor.id && hmSensor.id.VIBRATE) {
        this.state.vibrate = hmSensor.createSensor(hmSensor.id.VIBRATE)
      }
    } catch (e) {
      console.log('[ModelSelect Vibrate Init Error]', e)
    }
  },

  clickHaptic() {
    const v = this.state.vibrate
    if (v) {
      try {
        v.stop()
        v.scene = 24
        v.start()
      } catch (e) {}
    }
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
      h: 28,
      text: '⚙️ Настройки ИИ',
      text_size: 17,
      color: 0x00F0FF,
      align_h: hmUI.align.CENTER_H
    })

    // 1. Тумблер глубоких рассуждений
    this.state.reasoningBtn = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 12,
      y: 52,
      w: 168,
      h: 52,
      radius: 12,
      text: globalData.enableReasoning ? '💭 Рассуждения: ВКЛ' : '⚡ Рассуждения: ВЫКЛ',
      text_size: 13,
      color: globalData.enableReasoning ? 0x00FF88 : 0x8899AA,
      normal_color: 0x161C26,
      press_color: 0x242F40,
      click_func: () => {
        this.clickHaptic()
        globalData.enableReasoning = !globalData.enableReasoning
        const isEnabled = globalData.enableReasoning
        this.state.reasoningBtn.setProperty(
          hmUI.prop.TEXT,
          isEnabled ? '💭 Рассуждения: ВКЛ' : '⚡ Рассуждения: ВЫКЛ'
        )
        this.state.reasoningBtn.setProperty(
          hmUI.prop.COLOR,
          isEnabled ? 0x00FF88 : 0x8899AA
        )
      }
    })

    // 2. Две целевые модели
    const models = [
      {
        id: 'lite',
        title: '⚡ 3.5 Flash-Lite',
        tag: 'РЕКОМЕНДУЕТСЯ',
        subtitle: 'Мгновенный ответ (<0.8с)\nФакты, перевод, поиск'
      },
      {
        id: 'hydrogen',
        title: '🧠 4 Hydrogen',
        tag: 'ГЛУБОКАЯ ЛОГИКА',
        subtitle: 'Сложные задачи, код\nПошаговое мышление'
      }
    ]

    let startY = 114
    models.forEach((m) => {
      const isSelected = (globalData.selectedModel || 'lite') === m.id
      const btn = hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 12,
        y: startY,
        w: 168,
        h: 96,
        radius: 14,
        text: `${isSelected ? '◉ ' : '○ '}${m.title}\n[${m.tag}]\n${m.subtitle}`,
        text_size: 12,
        color: isSelected ? 0x00F0FF : 0xAAAAAA,
        normal_color: isSelected ? 0x003366 : 0x141A24,
        press_color: 0x005599,
        click_func: () => {
          this.clickHaptic()
          globalData.selectedModel = m.id
          this.updateModelButtons(models)
          goBack()
        }
      })
      this.state.modelBtns[m.id] = btn
      startY += 106
    })

    // 3. Кнопка возврата в чат
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 14,
      y: 420,
      w: 164,
      h: 48,
      radius: 24,
      text: '← Назад в чат',
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

  updateModelButtons(models) {
    const app = getApp()
    const globalData = (app && app.globalData) ? app.globalData : {}
    models.forEach((m) => {
      const isSelected = globalData.selectedModel === m.id
      const btn = this.state.modelBtns[m.id]
      if (btn) {
        btn.setProperty(hmUI.prop.TEXT, `${isSelected ? '◉ ' : '○ '}${m.title}\n[${m.tag}]\n${m.subtitle}`)
        btn.setProperty(hmUI.prop.COLOR, isSelected ? 0x00F0FF : 0xAAAAAA)
        btn.setProperty(hmUI.prop.NORMAL_COLOR, isSelected ? 0x003366 : 0x141A24)
      }
    })
  },

  onDestroy() {
    if (this.state.vibrate) {
      try {
        this.state.vibrate.stop()
      } catch (e) {}
      this.state.vibrate = null
    }
  }
})
