# 🤖 Gemini Band — Инструкция разработчика

Документ сохранен в системе и базе знаний проекта.

### Быстрые команды:

1. **Сборка приложения:**
   ```bash
   cd /Users/pidop/mi-band7-gemini && zeus build
   ```

2. **Запуск локального сервера отдачи .zpk:**
   ```bash
   node serve.js
   ```

3. **Проброс туннеля для QR-кода:**
   ```bash
   ssh -p 443 -R0:localhost:8080 -o StrictHostKeyChecking=no -o ServerAliveInterval=30 a.pinggy.io
   ```

4. **Генерация QR (без лишних переносов строк):**
   ```bash
   python3 -c "import qrcode; url='zpkd1://<ТУННЕЛЬ>/gemini_band.zpk'; qr=qrcode.QRCode(border=1); qr.add_data(url); qr.make(fit=True); qr.print_ascii(invert=True); qr.make_image().save('install_qr.png')"
   ```

5. **Правило коммитов и безопасности:**
   * **НИКОГДА** не коммитить API-ключ пользователя из `app-side/index.js`.
   * Перед любым коммитом проверять: `git diff --staged`.
   * Коммиты делать только по явной просьбе пользователя.
