<div align="center">
  <img src="assets/band-7/icon.png" width="96" height="96" alt="Gemini Band Icon" />
  <h1>Gemini Band</h1>
  <p><b>Standalone Google Gemini AI client for Xiaomi Smart Band 7 (Zepp OS 1.0)</b></p>
  <p>Featuring a direct on-screen keyboard, live web search grounding, notification-resilient generation, and smartphone settings UI.</p>

  <p>
    <img src="https://img.shields.io/badge/Zepp%20OS-1.0-blue?style=flat-square" alt="Zepp OS 1.0" />
    <img src="https://img.shields.io/badge/Device-Xiaomi%20Smart%20Band%207-orange?style=flat-square" alt="Mi Band 7" />
    <img src="https://img.shields.io/badge/AI-Google%20Gemini%204%20%7C%203.8%20%7C%203.5-brightgreen?style=flat-square" alt="Gemini Models" />
    <img src="https://img.shields.io/badge/License-MIT-purple?style=flat-square" alt="MIT License" />
  </p>

  ---

  ### 📲 Instant QR Code Installation

  <p>Scan with the <b>Zepp App ➔ Developer Mode ➔ QR Code Scanner</b> to install directly onto your band via Bluetooth:</p>

  <img src="assets/qr_install.png" width="220" height="220" alt="Install QR Code" />

  ```text
  zpkd1://cdn.jsdelivr.net/gh/poluprovodnik228/mi-band7-gemini@main/gemini_band.zpk
  ```
  <sub>Pre-compiled packages are also available in <a href="https://github.com/poluprovodnik228/mi-band7-gemini/releases">GitHub Releases</a>.</sub>

</div>

---

## ✨ Features

* **⌨️ Direct Paginated Keyboard (Single-Tap Typing without T9):**
  * **Russian Alphabet:** All **33 letters** distributed across 3 ergonomic pages (3×4 grid, 54×45 px keys).
  * **English Alphabet:** 26 letters across 3 pages.
  * **Digits & Symbols (`123`):** Dedicated page for numbers and punctuation.
  * **Case Switcher (`caps` / `CAPS`):** Easily toggle uppercase and lowercase input.
  * **Top Navigation Tabs:** One-tap switching between letter groups (`[а-л]`, `[м-ч]`, `[ш-я]`, `[123]`) or swipe gestures.
  * **Smart Auto-Fit:** The text field dynamically scales font size so you always see your active typing area.
  * **Haptic Feedback:** Discrete tactile vibration on every keypress.

* **🧠 Multi-Model AI Engine & Thinking Budget:**
  * **Gemini 4 Hydrogen:** Google's deep reasoning model for complex queries, logic, and code.
  * **Gemini 3.8 Flash:** Balanced model offering fast and accurate replies.
  * **Gemini 3.5 Flash-Lite:** Ultra-fast (< 1s) responses for quick facts, dates, and translations.
  * **Reasoning Toggle (`[Think ON/OFF]`):** Switch between extended thinking budget (2048 tokens) and rapid reply (512 tokens).

* **🌐 Live Web Search Grounding:**
  * Toggle real-time web search (`[Web ON/OFF]`).
  * Scrapes fresh facts, news, weather, and crypto/stock prices via DuckDuckGo Lite without external API fees or captchas.

* **🔔 Notification & Screen-Off Resilience:**
  * If an incoming phone notification arrives or the screen turns off while Gemini is generating an answer, **the request never cancels**.
  * The companion on the smartphone continues running in the background (`activeJob` / `lastCompletedJob`), and the band automatically retrieves the finished answer via background polling and notifies you with haptic feedback.

* **⚙️ Zero-Code API Key Setup via Phone UI (Zepp Settings):**
  * Enter your API key directly on your phone in the Zepp app settings. No need to edit source code or rebuild `.zab` packages.
  * Supports free keys from [Google AI Studio](https://aistudio.google.com/) as well as [OpenRouter](https://openrouter.ai/).

* **🖤 100% OLED Cyberpunk Interface:**
  * Official Google Gemini neon sparkle HD icon (96×96 TGA).
  * No square glyphs / tofu characters (`DEL`, `caps`, `Space`, `Send`, `(*) `).
  * Smooth layer scrolling for lengthy multi-turn conversations.

---

## 📲 User Installation Guide (3 Easy Steps)

### Step 1. Prepare the Zepp App

Xiaomi Smart Band 7 requires the **Zepp** app (not *Zepp Life* or *Mi Fitness*) to run apps with network access:

1. **Unpair your band** from *Zepp Life* or *Mi Fitness* (the band will reset and show a pairing QR code).
2. **Install the modified Zepp app:**
   * Download the **Zepp MB7** mod by *melianmiko* ([4PDA Thread #122339400](https://4pda.to/forum/index.php?showtopic=797981&st=15620#entry122339400) or [Guide on mmk.pw](https://mmk.pw/posts/mi-band-7-with-zepp/)).
   * Log into your Zepp account using **Email & Password** or **Mi Account** (Google login is disabled in modded APKs).
   * Tap `+` and scan the QR code on your Mi Band 7. The band will pair masked as an **Amazfit Band 7** (which unlocks all Zepp OS developer and network APIs).
3. **Enable Developer Mode in Zepp:**
   * In Zepp, go to: **Profile ➔ Settings ➔ About**.
   * **Tap 7–8 times** on the app version number until a message appears saying *"You are now a developer"*.
   * Return to **Profile ➔ Xiaomi Smart Band 7 (Amazfit Band 7)** — the **Developer Mode** menu will appear at the bottom.
   *(Optional: You can stay on the modded Zepp permanently, or reinstall the official Zepp from Google Play/App Store — the device pairing remains tied in the cloud).*

---

### Step 2. Install Gemini Band onto the Watch

1. Open Zepp: **Profile ➔ Xiaomi Smart Band 7 ➔ Developer Mode**.
2. Tap the **QR Code Scanner** icon in the upper-right corner.
3. Scan the installation QR code shown at the top of this page (or download `gemini_band.zpk` from [Releases](https://github.com/poluprovodnik228/mi-band7-gemini/releases) and flash via *Notify for Xiaomi*).
4. Zepp will automatically push and install the application onto your band via Bluetooth.

---

### Step 3. Configure Your Free API Key

1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/) (takes 1 minute).
2. Open the Zepp app on your phone:
   > **Profile ➔ Band ➔ App Management ➔ Gemini Band**
3. Paste your key into the **Gemini API Key** field.
4. Done! Launch Gemini Band on your wrist and ask any question.

*(Optional)* If you prefer OpenRouter, toggle `Use OpenRouter` in the app settings and paste your OpenRouter key.

---

## 🛠️ Development & Building from Source

For developers looking to modify the source code or build the `.zab` package:

```bash
# 1. Clone the repository
git clone https://github.com/poluprovodnik228/mi-band7-gemini.git
cd mi-band7-gemini

# 2. Install Zeus CLI (Zepp OS SDK)
npm install -g @zeppos/zeus-cli

# 3. Run test suite
node --test test_chat_fixes.js

# 4. Build for Xiaomi Smart Band 7
zeus build

# 5. Local preview & QR code generation
zeus preview
```

### Local HTTP Serving with Pinggy Tunnel:
```bash
# Start local package server
node serve.js

# Expose port 8080 via Pinggy
ssh -p 443 -R0:localhost:8080 -o StrictHostKeyChecking=no a.pinggy.io

# Generate installation QR code
python3 -c "import qrcode; url='zpkd1://<TUNNEL_URL>/gemini_band.zpk'; qr=qrcode.QRCode(border=1); qr.add_data(url); qr.make(fit=True); qr.print_ascii(invert=True)"
```

---

## 📁 Project Structure

```text
mi-band7-gemini/
├── app.json               # Zepp OS 1.0 manifest (routing, permissions, targets)
├── app.js                 # Global lifecycle, flash memory persistence & MessageBuilder
├── page/
│   ├── chat.js            # Main chat screen (conversation stream, timer, background polling)
│   ├── keyboard.js        # On-screen keyboard (RU 33 letters, EN, 123, CAPS, zero tofu glyphs)
│   └── model_select.js    # AI Model selector (Hydrogen / 3.8 Flash / 3.5 Lite, Think, Web)
├── setting/
│   └── index.js           # Zepp mobile settings UI (API key entry on smartphone)
├── app-side/
│   └── index.js           # Companion service (BLE bridge, Google AI Studio, DuckDuckGo scraper)
├── shared/                # MessageBuilder protocol, haptics, storage, timeouts
└── assets/                # HD icons (96x96 TGA) and installation QR code
```

---

## 🇷🇺 Краткая русская инструкция

* **Клиент Gemini AI для Mi Band 7** с полноценным экранным вводом без Т9 (33 буквы русского алфавита + EN + 123).
* **Модели:** Gemini 4 Hydrogen, Gemini 3.8 Flash и Gemini 3.5 Flash-Lite с тумблером глубоких рассуждений (`Think ON/OFF`).
* **🌐 Поиск в интернете:** Свежие курсы валют, новости и погода через DuckDuckGo Lite в реальном времени.
* **🔔 Защита от сбоев:** При звонках и уведомлениях генерация ответа продолжается в фоне на смартфоне.
* **⚙️ Ввод ключа без кода:** Ключ от [Google AI Studio](https://aistudio.google.com/) вводится прямо в приложении Zepp на телефоне.
* **Установка:** Браслет привязывается к моду Zepp MB7 под видом Amazfit Band 7 ➔ в *«О программе»* 7 раз тапаем по версии для включения Режима разработчика ➔ сканируем QR-код вверху страницы.

---

## 📄 License

MIT License. Open for modification and personal use.
