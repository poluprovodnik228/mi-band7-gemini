// Клавиатура с прямым побуквенным вводом (2-3 страницы на весь алфавит)
// Поддержка строчных и заглавных букв (Caps/Shift), переключение языков (RU/EN)
// Оптимизировано под дисплей Xiaomi Smart Band 7 (192x490) с защитой от скруглений и плавания виджетов
import { vibrateClick } from '../shared/vibrate'

function goBack() {
  if (typeof hmApp !== 'undefined' && hmApp.goBack) {
    hmApp.goBack()
  } else if (typeof hmRouter !== 'undefined' && hmRouter.back) {
    hmRouter.back()
  }
}

const LAYOUTS = {
  RU: {
    tabs: ['а-л', 'м-ч', 'ш-я', '123'],
    tabsUpper: ['А-Л', 'М-Ч', 'Ш-Я', '123'],
    lower: [
      // Стр 0: а - л (12 букв, строчные)
      ['а', 'б', 'в', 'г', 'д', 'е', 'ж', 'з', 'и', 'й', 'к', 'л'],
      // Стр 1: м - ч (12 букв, строчные)
      ['м', 'н', 'о', 'п', 'р', 'с', 'т', 'у', 'ф', 'х', 'ц', 'ч'],
      // Стр 2: ш - я (9 букв + 3 знака)
      ['ш', 'щ', 'ъ', 'ы', 'ь', 'э', 'ю', 'я', 'ё', '.', ',', '?'],
      // Стр 3: 123 (цифры и знаки)
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '-']
    ],
    upper: [
      // Стр 0: А - Л (12 букв, заглавные)
      ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'Й', 'К', 'Л'],
      // Стр 1: М - Ч (12 букв, заглавные)
      ['М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч'],
      // Стр 2: Ш - Я (9 букв + 3 знака)
      ['Ш', 'Щ', 'Ъ', 'Ы', 'Ь', 'Э', 'Ю', 'Я', 'Ё', '.', ',', '?'],
      // Стр 3: 123 (цифры и знаки)
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '-']
    ]
  },
  EN: {
    tabs: ['a-l', 'm-x', 'y-z', '123'],
    tabsUpper: ['A-L', 'M-X', 'Y-Z', '123'],
    lower: [
      // Стр 0: a - l (12 букв, строчные)
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'],
      // Стр 1: m - x (12 букв, строчные)
      ['m', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x'],
      // Стр 2: y - z + знаки (12 клавиш)
      ['y', 'z', '.', ',', '?', '!', '@', '/', '-', ':', '_', '='],
      // Стр 3: 123
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '-']
    ],
    upper: [
      // Стр 0: A - L (12 букв, заглавные)
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
      // Стр 1: M - X (12 букв, заглавные)
      ['M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X'],
      // Стр 2: Y - Z + знаки (12 клавиш)
      ['Y', 'Z', '.', ',', '?', '!', '@', '/', '-', ':', '_', '='],
      // Стр 3: 123
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '-']
    ]
  }
}

Page({
  state: {
    text: '',
    lang: 'EN',
    isUpper: false, // false = lowercase, true = uppercase (Caps)
    currentPage: 0,
    textWidget: null,
    tabWidgets: [],
    keyWidgets: [],
    langWidget: null,
    shiftWidget: null
  },

  onInit() {},

  hapticClick() {
    vibrateClick()
  },

  syncDraft() {
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.keyboardDraft = this.state.text
    }
  },

  build() {
    const app = getApp()
    if (app && app.globalData && typeof app.globalData.keyboardDraft === 'string') {
      this.state.text = app.globalData.keyboardDraft
    }

    if (typeof hmUI.setLayerScrolling === 'function') {
      hmUI.setLayerScrolling(false)
    }

    // 1. Черный AMOLED фон дисплея
    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 192,
      h: 490,
      color: 0x000000
    })

    // 2. Поле ввода (в безопасной зоне y=34 для исключения срезания закруглением)
    const inputCardY = 34
    const inputCardH = 58

    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 14,
      y: inputCardY,
      w: 164,
      h: inputCardH,
      radius: 12,
      color: 0x121722
    })

    // Текст поля ввода внутри карточки
    this.state.textWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 22,
      y: 38,
      w: 148,
      h: 50,
      text: 'Enter question...',
      text_size: 14,
      color: 0x556677,
      text_style: hmUI.text_style.WRAP,
      align_h: hmUI.align.LEFT
    })

    // 3. Вкладки страниц алфавита (4 вкладки)
    const tabY = 100
    const tabW = 39
    const tabGap = 4
    this.state.tabWidgets = []

    for (let i = 0; i < 4; i++) {
      const tabX = 12 + i * (tabW + tabGap)
      const tabBtn = hmUI.createWidget(hmUI.widget.BUTTON, {
        x: tabX,
        y: tabY,
        w: tabW,
        h: 30,
        radius: 8,
        text: '',
        text_size: 12,
        color: 0x778899,
        normal_color: 0x1A202A,
        press_color: 0x0055AA,
        click_func: () => {
          this.hapticClick()
          this.state.currentPage = i
          this.updateTabs()
          this.updateKeys()
        }
      })
      this.state.tabWidgets.push(tabBtn)
    }

    // 4. Сетка из 12 буквенных клавиш (3 столбца x 4 ряда)
    const keyStartX = 10
    const keyStartY = 136
    const keyW = 54
    const keyH = 45
    const keyGapX = 5
    const keyGapY = 4
    this.state.keyWidgets = []

    for (let index = 0; index < 12; index++) {
      const col = index % 3
      const row = Math.floor(index / 3)
      const kX = keyStartX + col * (keyW + keyGapX)
      const kY = keyStartY + row * (keyH + keyGapY)

      const btn = hmUI.createWidget(hmUI.widget.BUTTON, {
        x: kX,
        y: kY,
        w: keyW,
        h: keyH,
        radius: 10,
        text: '',
        text_size: 20,
        color: 0xFFFFFF,
        normal_color: 0x1A2230,
        press_color: 0x0066FF,
        click_func: () => {
          this.hapticClick()
          this.onKeyPress(index)
        }
      })
      this.state.keyWidgets.push(btn)
    }

    // 5. Ряд управления: [ EN ]  [ CAPS ]  [ Space ]  [ DEL ]
    const ctrlY = 334
    const ctrlH = 44

    // Кнопка языка (EN / RU)
    this.state.langWidget = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 10,
      y: ctrlY,
      w: 38,
      h: ctrlH,
      radius: 10,
      text: this.state.lang,
      text_size: 13,
      color: 0x00FFCC,
      normal_color: 0x1E2632,
      press_color: 0x334455,
      click_func: () => {
        this.hapticClick()
        this.state.lang = this.state.lang === 'EN' ? 'RU' : 'EN'
        this.state.currentPage = 0
        this.state.langWidget.setProperty(hmUI.prop.TEXT, this.state.lang)
        this.updateShiftBtn()
        this.updateTabs()
        this.updateKeys()
      }
    })

    // Кнопка регистра (Shift / Caps)
    this.state.shiftWidget = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 52,
      y: ctrlY,
      w: 38,
      h: ctrlH,
      radius: 10,
      text: 'caps',
      text_size: 12,
      color: 0x8899AA,
      normal_color: 0x1E2632,
      press_color: 0x0055AA,
      click_func: () => {
        this.hapticClick()
        this.state.isUpper = !this.state.isUpper
        this.updateShiftBtn()
        this.updateTabs()
        this.updateKeys()
      }
    })

    // Пробел (Space)
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 94,
      y: ctrlY,
      w: 48,
      h: ctrlH,
      radius: 10,
      text: 'Space',
      text_size: 12,
      color: 0xFFFFFF,
      normal_color: 0x1E2632,
      press_color: 0x334455,
      click_func: () => {
        this.hapticClick()
        this.state.text += ' '
        this.syncDraft()
        this.updateTextUI()
      }
    })

    // Стереть (Backspace / DEL)
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 146,
      y: ctrlY,
      w: 36,
      h: ctrlH,
      radius: 10,
      text: 'DEL',
      text_size: 12,
      color: 0xFF6677,
      normal_color: 0x2A151B,
      press_color: 0x551111,
      click_func: () => {
        this.hapticClick()
        if (this.state.text.length > 0) {
          this.state.text = this.state.text.slice(0, -1)
          this.syncDraft()
          this.updateTextUI()
        }
      }
    })

    // 6. Панель действий: [ Back ]  [ Send ]
    const actY = 386
    const actH = 48

    // Назад в чат
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 10,
      y: actY,
      w: 82,
      h: actH,
      radius: 24,
      text: '< Back',
      text_size: 14,
      color: 0xAAAAAA,
      normal_color: 0x20242D,
      press_color: 0x333A44,
      click_func: () => {
        this.hapticClick()
        goBack()
      }
    })

    // Отправить в ИИ
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 100,
      y: actY,
      w: 82,
      h: actH,
      radius: 24,
      text: 'Send',
      text_size: 14,
      color: 0xFFFFFF,
      normal_color: 0x0066FF,
      press_color: 0x0044AA,
      click_func: () => {
        this.hapticClick()
        this.submitPrompt()
      }
    })

    this.updateTabs()
    this.updateKeys()
    this.updateShiftBtn()
    this.updateTextUI()
    this.registerGestures()
  },

  registerGestures() {
    if (typeof hmApp !== 'undefined' && hmApp.registerGestureEvent) {
      const G_UP = (hmApp.gesture && hmApp.gesture.UP) || 3
      const G_DOWN = (hmApp.gesture && hmApp.gesture.DOWN) || 4
      const G_RIGHT = (hmApp.gesture && hmApp.gesture.RIGHT) || 1

      hmApp.registerGestureEvent((event) => {
        if (event === G_UP) {
          this.hapticClick()
          this.nextPage()
          return true
        } else if (event === G_DOWN) {
          this.hapticClick()
          this.prevPage()
          return true
        } else if (event === G_RIGHT) {
          // Свайп вправо: стандартный возврат назад
          return false
        }
        return true
      })
    }
  },

  nextPage() {
    this.state.currentPage = (this.state.currentPage + 1) % 4
    this.updateTabs()
    this.updateKeys()
  },

  prevPage() {
    this.state.currentPage = (this.state.currentPage - 1 + 4) % 4
    this.updateTabs()
    this.updateKeys()
  },

  onKeyPress(index) {
    const layout = LAYOUTS[this.state.lang] || LAYOUTS.RU
    const pages = this.state.isUpper ? layout.upper : layout.lower
    const pageChars = pages[this.state.currentPage] || []
    const char = pageChars[index]
    if (char) {
      this.state.text += char
      this.syncDraft()
      this.updateTextUI()
    }
  },

  updateShiftBtn() {
    if (!this.state.shiftWidget) return
    const isUp = this.state.isUpper
    this.state.shiftWidget.setProperty(hmUI.prop.TEXT, isUp ? 'CAPS' : 'caps')
    this.state.shiftWidget.setProperty(hmUI.prop.COLOR, isUp ? 0x00F0FF : 0x8899AA)
    this.state.shiftWidget.setProperty(hmUI.prop.NORMAL_COLOR, isUp ? 0x004488 : 0x1E2632)
  },

  updateTabs() {
    const layout = LAYOUTS[this.state.lang] || LAYOUTS.RU
    const tabs = this.state.isUpper ? layout.tabsUpper : layout.tabs
    for (let i = 0; i < 4; i++) {
      const widget = this.state.tabWidgets[i]
      if (widget) {
        const title = tabs[i] || ''
        const isActive = (i === this.state.currentPage)
        widget.setProperty(hmUI.prop.TEXT, title)
        widget.setProperty(hmUI.prop.COLOR, isActive ? 0x00F0FF : 0x778899)
        widget.setProperty(hmUI.prop.NORMAL_COLOR, isActive ? 0x004488 : 0x1A202A)
      }
    }
  },

  updateKeys() {
    const layout = LAYOUTS[this.state.lang] || LAYOUTS.RU
    const pages = this.state.isUpper ? layout.upper : layout.lower
    const pageChars = pages[this.state.currentPage] || []

    for (let i = 0; i < 12; i++) {
      const widget = this.state.keyWidgets[i]
      if (widget) {
        const char = pageChars[i] || ''
        widget.setProperty(hmUI.prop.TEXT, char)
      }
    }
  },

  updateTextUI() {
    if (!this.state.textWidget) return

    const t = this.state.text
    if (t.length === 0) {
      this.state.textWidget.setProperty(hmUI.prop.MORE, {
        x: 22,
        y: 38,
        w: 148,
        h: 50,
        text_size: 14,
        text_style: hmUI.text_style.WRAP,
        align_h: hmUI.align.LEFT
      })
      this.state.textWidget.setProperty(hmUI.prop.TEXT, 'Enter question...')
      this.state.textWidget.setProperty(hmUI.prop.COLOR, 0x556677)
    } else {
      let fSize = 15
      let displayText = t
      // Если текст длинный, показываем конец строки (где сейчас печатаешь)
      if (t.length > 45) {
        fSize = 11
        displayText = '…' + t.slice(-42)
      } else if (t.length > 32) {
        fSize = 12
      } else if (t.length > 18) {
        fSize = 13
      }

      this.state.textWidget.setProperty(hmUI.prop.MORE, {
        x: 22,
        y: 38,
        w: 148,
        h: 50,
        text_size: fSize,
        text_style: hmUI.text_style.WRAP,
        align_h: hmUI.align.LEFT
      })
      this.state.textWidget.setProperty(hmUI.prop.COLOR, 0x00FFCC)
      this.state.textWidget.setProperty(hmUI.prop.TEXT, displayText)
    }
  },

  submitPrompt() {
    const trimmed = this.state.text.trim()
    if (trimmed.length > 0) {
      const app = getApp()
      if (app && app.globalData) {
        app.globalData.pendingQuestion = trimmed
        app.globalData.keyboardDraft = ''
        this.state.text = ''
        if (app.globalData.saveAppState) {
          app.globalData.saveAppState()
        }
      }
    }
    goBack()
  },

  onDestroy() {
    this.syncDraft()
    const app = getApp()
    if (app && app.globalData && app.globalData.saveAppState) {
      app.globalData.saveAppState()
    }
    if (typeof hmApp !== 'undefined' && hmApp.unregisterGestureEvent) {
      try {
        hmApp.unregisterGestureEvent()
      } catch (e) {}
    }
  }
})
