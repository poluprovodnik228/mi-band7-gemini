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

## 📲 Installation Guide (3 Ways to Install)

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

---

### Method 1. 1-Click Cloud Build via GitHub Actions (Recommended)

Build your personal package directly on GitHub's secure infrastructure — zero local tools needed, zero typing on the watch, and no third-party servers:

1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/) (takes 1 minute).
2. **Fork this repository** to your GitHub account (click **Fork** in the top right).
3. In your fork, navigate to the **Actions** tab.
4. Select the workflow **Build Personal Band Package** from the left sidebar.
5. Click **Run workflow**, paste your Gemini API key, and click the green button.
6. Once the build finishes (~45 seconds), click on the completed run.
7. Under **Summary**, you will see a personalized **QR Code** and direct install links.
8. In the Zepp app on your phone, open **Developer Mode ➔ QR Scanner** and scan the code off your screen. The app installs automatically over Bluetooth!

---

### Method 2. In-Browser Client-Side Patcher (GitHub Pages)

If you prefer to download the `.zpk` file directly without running GitHub Actions:

1. Open the [Gemini Band Web Portal](https://poluprovodnik228.github.io/mi-band7-gemini/) on your computer or phone.
2. Paste your Google Gemini API key into the field.
3. Click **Patch & Download .zpk**.
4. The `.zpk` package is patched **100% in your browser's local memory** using JSZip. Your API key never leaves your device and is never sent to any server.

---

### Method 3. Compile & Build from Source (Offline Zeus CLI)

For developers who want to compile their own package locally without any web interface:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/poluprovodnik228/mi-band7-gemini.git
   cd mi-band7-gemini
   ```
2. **Install Zeus CLI:**
   ```bash
   npm install -g @zeppos/zeus-cli
   ```
3. **Create local configuration file (`config.js`):**
   Create `config.js` in the project root (already ignored by `.gitignore` so your key is never committed):
   ```javascript
   module.exports = {
     GEMINI_API_KEY: "AIzaSyYourActualKeyFromGoogleAIStudio"
   };
   ```
4. **Compile the package:**
   ```bash
   zeus build
   ```
5. **Serve and flash via QR code:**
   ```bash
   node serve.js
   ```
   Open `http://localhost:8080/gemini_band.zpk` via Zepp's Developer Mode QR scanner.

---

### ⚠️ Troubleshooting: "Download failed (error null)"

If the Zepp app shows a toast error saying `Download failed (error null)` when scanning the QR code:

* **Insecure HTTP / Local IP Rejection:** Zepp's built-in Dart downloader (`Dart/3.1 (dart:io)`) strictly rejects unencrypted local IP addresses (`http://192.168.x.x`). The download link **must be a valid public HTTPS URL**.
* **Solution:** Use **Method 1 (GitHub Actions)** or **GitHub Pages**. GitHub provides official, trusted HTTPS endpoints (`zpkd1://github.com/...` or `zpkd1://<username>.github.io/...`) which Zepp accepts and downloads immediately without errors.
* **Local Development with Tunnel:** If you run `serve.js` locally, expose port 8080 via a secure tunnel (e.g., Cloudflare Tunnel / Pinggy HTTPS) so Zepp receives a public SSL connection.

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
* **⚙️ Три способа установки с API-ключом:**
  1. **GitHub Actions (Рекомендуется):** Форкаете репозиторий ➔ вкладка Actions ➔ запускаете *Build Personal Band Package* со своим ключом ➔ на экране появляется QR-код для Zepp. Всё собирается на серверах Microsoft/GitHub без передачи ключей сторонним сервисам.
  2. **В браузере (GitHub Pages):** Открываете портал ➔ вводите ключ ➔ пакет собирается локально в памяти браузера через JSZip и скачивается на телефон.
  3. **Локальная компиляция:** Zeus CLI + локальный `config.js` (`zeus build`).
* **Установка:** Браслет привязывается к моду Zepp MB7 под видом Amazfit Band 7 ➔ в *«О программе»* 7 раз тапаем по версии для включения Режима разработчика ➔ сканируем сгенерированный QR-код.
* **⚠️ Ошибка «Download failed (error null)»:** Zepp блокирует локальные HTTP адреса (`192.168.x.x`). Ссылки должны быть валидным HTTPS (GitHub Releases или GitHub Pages).

---

## 📄 License

MIT License. Open for modification and personal use.
