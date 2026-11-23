<div align="center">
  <img src="assets/band-7/icon.png" width="96" height="96" alt="Gemini Band Icon" />
  <h1>Gemini Band</h1>
  <p><b>Standalone Google Gemini AI client for Xiaomi Smart Band 7 (Zepp OS 1.0)</b></p>
  <p>Featuring a direct on-screen keyboard, live web search grounding, multi-model fallback chain, and notification-resilient background generation.</p>

  <p>
    <img src="https://img.shields.io/badge/Zepp%20OS-1.0-blue?style=flat-square" alt="Zepp OS 1.0" />
    <img src="https://img.shields.io/badge/Device-Xiaomi%20Smart%20Band%207-orange?style=flat-square" alt="Mi Band 7" />
    <img src="https://img.shields.io/badge/AI-Gemini%204%20%7C%203.8%20%7C%203.5-brightgreen?style=flat-square" alt="Gemini Models" />
    <img src="https://img.shields.io/badge/License-MIT-purple?style=flat-square" alt="MIT License" />
  </p>

  ---

  ### 📲 Base Template Installation (Developer Preview)

  <p>Scan with <b>Zepp App ➔ Developer Mode ➔ QR Scanner</b> to install the clean base template directly via Bluetooth:</p>

  <img src="assets/qr_install.png" width="220" height="220" alt="Install QR Code" />

  ```text
  zpkd1://raw.githubusercontent.com/poluprovodnik228/mi-band7-gemini/main/docs/gemini_band.zpk
  ```
  <sub>💡 <i>To embed your private Gemini API key without typing on the band, use <b>Method 1 (GitHub Actions)</b> below.</i></sub>

</div>

---

## ✨ Features

* **⌨️ Direct Paginated Keyboard (Single-Tap Typing without T9):**
  * **Russian Alphabet:** All **33 letters** distributed across 3 ergonomic pages (3×4 grid, 54×45 px keys).
  * **English Alphabet:** 26 letters across 3 pages.
  * **Digits & Symbols (`123`):** Dedicated page for numbers and essential punctuation.
  * **Case Switcher (`caps` / `CAPS`):** Seamless uppercase and lowercase toggling.
  * **Top Navigation Tabs & Gestures:** One-tap switching between letter clusters (`[а-л]`, `[м-ч]`, `[ш-я]`, `[123]`) and swipe navigation.
  * **Smart Auto-Fit:** The text field dynamically scales font size so you always see your active typing area.
  * **Tactile Haptic Feedback:** Discrete vibration feedback on every keypress.

* **🧠 Multi-Model AI Engine & Cascade Fallback Chain:**
  * **Gemini 4 Hydrogen:** Google's deep reasoning model for complex queries, logic, and code.
  * **Gemini 3.8 Flash:** High-speed balanced model for rapid general questions.
  * **Gemini 3.5 Flash-Lite:** Ultra-fast (< 1s) responses for instant definitions, dates, and translations.
  * **Automatic Cascade Fallback:** If Hydrogen is temporarily overloaded (`503 High Demand` / `429 Too Many Requests`), the companion automatically falls back to **3.8 Flash**, and then to **3.5 Flash-Lite**. You never receive an empty error toast.
  * **Reasoning Toggle (`[Think ON/OFF]`):** Switch between extended thinking budget (2048 tokens) and rapid reply (512 tokens).

* **🌐 Live Web Search Grounding:**
  * Toggle real-time web search (`[Web ON/OFF]`).
  * Scrapes fresh facts, news, weather forecasts, and crypto/stock prices via DuckDuckGo Lite in real-time without external API fees or captchas.

* **🔔 Notification & Screen-Off Resilience:**
  * If an incoming phone notification arrives or the watch screen turns off while Gemini is generating an answer, **the request is never cancelled**.
  * The companion service on the smartphone continues running in the background (`activeJob` / `lastCompletedJob`).
  * When you reopen the chat or screen, the band automatically polls the finished answer via background BLE sync and buzzes with haptic feedback.

* **💬 Multi-Turn Conversation Context Memory:**
  * Remembers the last 5 dialogue turns (10 messages) so you can ask natural follow-up questions.
  * Dedicated `[Reset Chat]` button in settings and keyword trigger (`/clear`) to start a clean slate.

* **🖤 100% OLED Cyberpunk Interface:**
  * True black background (`#000000`) for zero battery drain on AMOLED.
  * Official Google Gemini neon sparkle HD icon (96×96 TGA).
  * Smooth layer scrolling for lengthy multi-turn conversations.
  * Zero tofu glyphs / broken square characters (`DEL`, `caps`, `Space`, `Send`, `(*) `).

---

## 📲 Installation Guide (3 Pathways)

### Step 1. Prepare the Zepp App

Xiaomi Smart Band 7 requires the **Zepp** app (not *Zepp Life* or *Mi Fitness*) to unlock Zepp OS developer and network APIs:

1. **Unpair your band** from *Zepp Life* or *Mi Fitness* (the band will display a pairing QR code).
2. **Install the modified Zepp app:**
   * Download the **Zepp MB7** mod by *melianmiko* ([4PDA Thread #122339400](https://4pda.to/forum/index.php?showtopic=797981&st=15620#entry122339400) or [mmk.pw Guide](https://mmk.pw/posts/mi-band-7-with-zepp/)).
   * Log into your Zepp account using **Email & Password** or **Mi Account** (Google login is disabled in modded APKs).
   * Tap `+` and scan the QR code on your Mi Band 7. The band will pair masked as an **Amazfit Band 7** (unlocking all Zepp OS developer and network capabilities).
3. **Enable Developer Mode in Zepp:**
   * In Zepp, go to: **Profile ➔ Settings ➔ About**.
   * **Tap 7–8 times** on the app version number until a message appears saying *"You are now a developer"*.
   * Return to **Profile ➔ Xiaomi Smart Band 7 (Amazfit Band 7)** — the **Developer Mode** menu will appear at the bottom.

---

### Method 1. 1-Click Cloud Build via GitHub Actions (Recommended)

The cleanest and most trusted way for end-users. Build your personal package directly on GitHub's secure infrastructure — zero local tools needed, zero typing on the watch, and no third-party servers:

1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/) (takes 1 minute).
2. **Fork this repository** to your GitHub account (click the **Fork** button at the top right of this repo).
3. In your fork, navigate to the **Actions** tab:
   👉 **`https://github.com/<your-username>/mi-band7-gemini/actions/workflows/build-personal.yml`**
4. Click **Run workflow**, paste your Gemini API key, and click the green button.
5. Wait ~40 seconds. Open the completed run and scroll to **Summary**.
6. You will see a personalized **QR Code** (and an ASCII QR code in the job logs).
7. In the Zepp app on your phone, open **Developer Mode ➔ QR Scanner** and scan the code off your screen. The app installs automatically over Bluetooth!

> 🛡️ **Security Guarantee:** Your API key is processed exclusively inside your private GitHub Actions runner on Microsoft/GitHub infrastructure. It is never stored on third-party servers or public logs.

---

### Method 2. In-Browser Client-Side Patcher (GitHub Pages)

If you prefer to download the `.zpk` file directly to your phone without running GitHub Actions:

1. Open the [Gemini Band Web Portal](https://poluprovodnik228.github.io/mi-band7-gemini/) on your computer or smartphone.
2. Paste your Google Gemini API key into the field.
3. Click **Patch & Download .zpk**.
4. The `.zpk` package is patched **100% in your browser's local memory** using JSZip. Your API key never leaves your device and is never sent to any server.
5. Install the downloaded `.zpk` file onto your band using Zepp Developer Mode or *Notify for Xiaomi*.

---

### Method 3. Compile & Build from Source (Offline Zeus CLI)

For developers who want to compile their own package locally from raw source code:

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
5. **Serve and flash via local server:**
   ```bash
   node serve.js
   ```
   Open `http://localhost:8080/gemini_band.zpk` via Zepp's Developer Mode QR scanner.

---

## 🛠️ Technical Details & Under the Hood

### Why "Download failed (error null)" Occurs and How It Is Solved
* **The Root Cause:** Zepp's internal package downloader (`Dart/3.1 (dart:io)`) strictly rejects:
  1. Plain HTTP connections and local private IP addresses (`http://192.168.x.x`).
  2. **HTTP 301/302 Redirects:** GitHub Releases (`github.com/.../releases/download/...`) redirects via HTTP 302 to signed AWS/Azure storage URLs (`release-assets.githubusercontent.com`). The Zepp Dart client drops redirect parameters or aborts, resulting in `error null`.
* **The Solution:** Our GitHub Actions workflow automatically deploys the personal `.zpk` package to the `build` branch. The QR code points directly to:
  ```text
  zpkd1://raw.githubusercontent.com/<user>/mi-band7-gemini/build/gemini_band.zpk
  ```
  `raw.githubusercontent.com` returns a direct **`HTTP/2 200 OK`** without any redirects, allowing Zepp to download and install smoothly.

### Why Phone Settings UI is Inaccessible for Sideloaded Apps
* In Zepp OS, sideloading an app via `zpkd1://` pushes the binary to the band over Bluetooth, but does **not** register it into the official App Store "Installed Apps" list on Band 7 (since Mi Band 7 lacks an official App Store).
* Consequently, `setting/index.js` (the smartphone-side settings UI) cannot be opened by the user in Zepp.
* To provide a frictionless experience, Gemini Band supports **build-time key embedding** via GitHub Actions or `config.js`.

---

## 📁 Project Structure

```text
mi-band7-gemini/
├── .github/
│   ├── workflows/
│   │   └── build-personal.yml    # GitHub Actions 1-click cloud builder
│   └── scripts/
│       └── generate_release_assets.py # QR generator (raw direct 200 OK links)
├── docs/
│   ├── index.html                # GitHub Pages portal & in-browser JSZip patcher
│   ├── gemini_band.zpk           # Base template package
│   └── icon.png                  # Project web asset
├── app.json                      # Zepp OS 1.0 manifest (Amazfit Band 7 targets: 252, 253, 254)
├── app.js                        # App lifecycle, flash persistence & MessageBuilder
├── page/
│   ├── chat.js                   # Main chat screen (stream rendering, polling, haptics)
│   ├── keyboard.js               # On-screen keyboard (RU 33 letters, EN, 123, CAPS, auto-fit)
│   └── model_select.js           # Settings screen (Hydrogen, 3.8 Flash, 3.5 Lite, Think, Web)
├── setting/
│   └── index.js                  # Companion mobile settings UI (for devices with App Store)
├── app-side/
│   └── index.js                  # Phone companion service (Gemini API, fallback, DDG scraper)
├── shared/                       # MessageBuilder protocol, haptics, storage, timeouts
├── patch_zpk.py                  # In-memory fast zip patcher (replaces key in 15ms)
├── serve.js                      # Local development builder & QR server
└── assets/                       # HD icons (96x96 TGA) and installation QR codes
```

---

## 🇷🇺 Подробная русская инструкция

### Возможности:
* **Полноценная экранная клавиатура без Т9:** Все **33 буквы русского алфавита** на 3 страницах (сетка 3×4, крупные клавиши 54×45 px) + английский алфавит (26 букв) + цифры и спецсимволы (`123`).
* **Модели Gemini AI:**
  * **Gemini 4 Hydrogen:** Модель глубоких рассуждений для сложных вопросов, логики и кода.
  * **Gemini 3.8 Flash:** Быстрая и точная модель для повседневных задач.
  * **Gemini 3.5 Flash-Lite:** Мгновенные (< 1 сек) ответы для переводов, определений и дат.
  * **Каскадный авто-фоллбэк:** Если Hydrogen перегружен (`503 High Demand`), компаньон автоматически делает запрос к 3.8 Flash, а затем к 3.5 Flash-Lite. Ошибок «сервер перегружен» пользователь не увидит.
* **🌐 Поиск в интернете (DuckDuckGo Lite):** Актуальные курсы валют, новости и погода в реальном времени.
* **🔔 Защита от сбоев:** При звонках, уведомлениях или выключении экрана генерация ответа на смартфоне не прерывается. При включении экрана браслет автоматически забирает готовый ответ и вибрирует.
* **💬 Память контекста:** Помнит до 5 диалоговых ходов (10 сообщений) для естественного общения.

### Установка (3 способа):

1. **Подготовка (Мод Zepp MB7):**
   * Отвяжите браслет от *Zepp Life* / *Mi Fitness* (появится QR-код сопряжения).
   * Установите мод **Zepp MB7** от *melianmiko* ([Тема на 4PDA](https://4pda.to/forum/index.php?showtopic=797981&st=15620#entry122339400) или [Инструкция на mmk.pw](https://mmk.pw/posts/mi-band-7-with-zepp/)).
   * Войдите в аккаунт через Email/пароль или Mi-аккаунт. Нажмите `+` и отсканируйте QR-код на браслете (браслет привяжется под видом *Amazfit Band 7*, открыв доступ к Zepp OS API).
   * В Zepp перейдите: **Профиль ➔ Настройки ➔ О программе** и **тапните 7 раз** по версии приложения для включения *Режима разработчика*.

2. **Способ 1 (GitHub Actions — Рекомендуется):**
   * Получите бесплатный ключ в [Google AI Studio](https://aistudio.google.com/).
   * Нажмите **Fork** в правом верхнем углу этого репозитория.
   * В своём форке перейдите во вкладку **Actions** ➔ выберите воркфлоу **«Build Personal Band Package»**.
   * Нажмите **Run workflow**, вставьте ключ и нажмите зелёную кнопку.
   * Через ~40 секунд откройте завершённый запуск и отсканируйте появившийся **QR-код** через Zepp (*Профиль ➔ Режим разработчика ➔ Сканер QR*). Пакет скачается и установится на браслет!

3. **Способ 2 (В браузере через GitHub Pages):**
   * Откройте [веб-портал Gemini Band](https://poluprovodnik228.github.io/mi-band7-gemini/) на телефоне или ПК.
   * Введите свой API-ключ и нажмите **Patch & Download .zpk**.
   * Ключ вшивается прямо в браузере через JSZip без отправки на серверы. Скачанный файл установите через Zepp или Notify.

4. **Способ 3 (Сборка из исходников на ПК):**
   * Клонируйте репозиторий, создайте `config.js` с `GEMINI_API_KEY` и выполните `zeus build`.

---

## 📄 License

MIT License. Open for modification and personal use.
