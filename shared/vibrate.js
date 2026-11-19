let vibrateSensor = null

export function getVibrate() {
  if (typeof getApp === 'function') {
    try {
      const app = getApp()
      if (app && app.globalData) {
        if (!app.globalData._vibrateSensor) {
          if (typeof hmSensor !== 'undefined' && hmSensor.createSensor && hmSensor.id && hmSensor.id.VIBRATE) {
            app.globalData._vibrateSensor = hmSensor.createSensor(hmSensor.id.VIBRATE)
          }
        }
        if (app.globalData._vibrateSensor) {
          return app.globalData._vibrateSensor
        }
      }
    } catch (_) {}
  }

  if (!vibrateSensor) {
    try {
      if (typeof hmSensor !== 'undefined' && hmSensor.createSensor && hmSensor.id && hmSensor.id.VIBRATE) {
        vibrateSensor = hmSensor.createSensor(hmSensor.id.VIBRATE)
      }
    } catch (e) {
      console.log('[Vibrate Init Error]', e)
    }
  }
  return vibrateSensor
}

export function vibrateClick() {
  const v = getVibrate()
  if (v) {
    try {
      v.stop()
      v.scene = 24 // Идеальный легкий клик, как на кнопке выбора модели (Medium short, 20ms)
      v.start()
    } catch (_) {}
  }
}

export function vibrateNotify() {
  const v = getVibrate()
  if (v) {
    try {
      v.stop()
      v.scene = 25 // Одинарная сильная вибрация при ответе модели (High short, 20ms)
      v.start()
    } catch (_) {}
  }
}
