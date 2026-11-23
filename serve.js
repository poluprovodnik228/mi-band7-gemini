const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { URL } = require('url');

const PORT = 8080;
const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PATCH_SCRIPT = path.join(ROOT_DIR, 'patch_zpk.py');

function getLatestZab() {
  if (!fs.existsSync(DIST_DIR)) return null;
  const files = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.zab'));
  if (files.length === 0) return null;
  files.sort((a, b) => fs.statSync(path.join(DIST_DIR, b)).mtimeMs - fs.statSync(path.join(DIST_DIR, a)).mtimeMs);
  return path.join(DIST_DIR, files[0]);
}

function ensureBaseZpk() {
  const zpkPath = path.join(DIST_DIR, 'gemini_band.zpk');
  const latestZab = getLatestZab();
  if (!latestZab) return fs.existsSync(zpkPath) ? zpkPath : null;

  if (fs.existsSync(zpkPath)) {
    const zpkTime = fs.statSync(zpkPath).mtimeMs;
    const zabTime = fs.statSync(latestZab).mtimeMs;
    if (zpkTime >= zabTime) return zpkPath;
  }

  try {
    const zabName = path.basename(latestZab);
    execSync(`cd "${DIST_DIR}" && unzip -p "${zabName}" $(unzip -l "${zabName}" | grep "\\.zpk" | awk '{print $4}') > gemini_band.zpk`);
    if (fs.existsSync(zpkPath)) return zpkPath;
  } catch (e) {
    console.error('[ensureBaseZpk error]', e);
  }
  return fs.existsSync(zpkPath) ? zpkPath : null;
}

function patchZpk(baseZpkPath, apiKey) {
  const cleanKey = apiKey.trim().replace(/[^a-zA-Z0-9_\-]/g, '');
  if (!cleanKey || cleanKey.length < 6) return null;

  const tempOut = path.join(DIST_DIR, `temp_${Date.now()}_${Math.floor(Math.random() * 10000)}.zpk`);
  try {
    const res = spawnSync('python3', [PATCH_SCRIPT, baseZpkPath, tempOut, cleanKey]);
    if (res.status === 0 && fs.existsSync(tempOut)) {
      const data = fs.readFileSync(tempOut);
      fs.unlinkSync(tempOut);
      return data;
    }
  } catch (err) {
    console.error('[patchZpk error]', err);
  }
  if (fs.existsSync(tempOut)) {
    try { fs.unlinkSync(tempOut); } catch (_) {}
  }
  return null;
}

function generateQrPng(text) {
  try {
    const pyCode = `
import sys, qrcode, io
text = sys.argv[1]
qr = qrcode.QRCode(border=1)
qr.add_data(text)
qr.make(fit=True)
img = qr.make_image(fill_color="black", back_color="white")
buf = io.BytesIO()
img.save(buf, format='PNG')
sys.stdout.buffer.write(buf.getvalue())
`;
    const res = spawnSync('python3', ['-c', pyCode, text]);
    if (res.status === 0 && res.stdout && res.stdout.length > 50) {
      return res.stdout;
    }
  } catch (e) {
    console.error('[generateQrPng error]', e);
  }
  return null;
}

function getHtmlPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gemini Band — Installer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d1117;
      color: #c9d1d9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
    }
    .container {
      max-width: 420px;
      width: 100%;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .header img {
      width: 36px;
      height: 36px;
      border-radius: 8px;
    }
    h1 {
      font-size: 18px;
      font-weight: 600;
      color: #f0f6fc;
    }
    .desc {
      font-size: 13px;
      color: #8b949e;
      margin-bottom: 20px;
      line-height: 1.5;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #f0f6fc;
      margin-bottom: 6px;
    }
    input {
      width: 100%;
      padding: 9px 12px;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #f0f6fc;
      font-size: 13px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      margin-bottom: 12px;
    }
    input:focus {
      outline: none;
      border-color: #58a6ff;
    }
    button {
      width: 100%;
      background: #238636;
      color: #ffffff;
      border: 1px solid rgba(240, 246, 252, 0.1);
      border-radius: 6px;
      padding: 9px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    button:hover {
      background: #2ea043;
    }
    .qr-section {
      margin-top: 20px;
      display: none;
      text-align: center;
    }
    .qr-card {
      background: #ffffff;
      padding: 10px;
      border-radius: 8px;
      display: inline-block;
      margin-bottom: 14px;
    }
    .qr-card img {
      display: block;
      width: 200px;
      height: 200px;
    }
    .btn-install {
      display: block;
      width: 100%;
      text-align: center;
      background: #21262d;
      color: #58a6ff;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 9px;
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      margin-bottom: 16px;
    }
    .btn-install:hover {
      background: #30363d;
    }
    .notes {
      font-size: 12px;
      color: #8b949e;
      line-height: 1.6;
      border-top: 1px solid #21262d;
      padding-top: 14px;
      text-align: left;
    }
    .notes ol {
      margin-left: 18px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="/icon.png" alt="Icon">
      <h1>Gemini Band</h1>
    </div>
    <p class="desc">Install on Xiaomi Smart Band 7 with pre-configured API key.</p>

    <label for="apiKey">Google Gemini API Key:</label>
    <input type="text" id="apiKey" placeholder="AIzaSy..." spellcheck="false" autocomplete="off">
    <button onclick="gen()">Generate QR Code</button>

    <div class="qr-section" id="qrBox">
      <div class="qr-card">
        <img id="qr" src="" alt="QR">
      </div>
      <a id="link" href="#" class="btn-install">Open in Zepp App (Mobile)</a>
      <div class="notes">
        <ol>
          <li>In the <b>Zepp</b> app, go to <i>Profile ➔ Developer Mode</i>.</li>
          <li>Tap the QR scanner icon in the top right corner.</li>
          <li>Scan this QR code (or tap the button above if on mobile).</li>
        </ol>
      </div>
    </div>
  </div>

  <script>
    function gen() {
      const val = document.getElementById('apiKey').value.trim();
      if (!val) return;
      const url = 'zpkd1://' + window.location.host + '/gemini_band.zpk?key=' + encodeURIComponent(val);
      document.getElementById('qr').src = '/qr?text=' + encodeURIComponent(url);
      document.getElementById('link').href = url;
      document.getElementById('qrBox').style.display = 'block';
    }
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const reqTime = new Date().toISOString();
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  console.log(`[${reqTime}] ${req.method} ${req.url} - UA: ${req.headers['user-agent'] || 'none'}`);

  // 1. Web UI
  if (pathname === '/' || pathname === '/index.html' || pathname === '/builder') {
    const html = getHtmlPage();
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(html, 'utf8'),
      'Cache-Control': 'no-cache'
    });
    res.end(html);
    return;
  }

  // 2. Icon asset
  if (pathname === '/icon.png') {
    const iconPath = path.join(ROOT_DIR, 'icon.png');
    if (fs.existsSync(iconPath)) {
      const stat = fs.statSync(iconPath);
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': stat.size });
      fs.createReadStream(iconPath).pipe(res);
      return;
    }
  }

  // 3. Dynamic QR code generator
  if (pathname === '/qr') {
    const text = parsedUrl.searchParams.get('text');
    if (!text) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing text parameter');
      return;
    }
    const qrPng = generateQrPng(text);
    if (qrPng) {
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': qrPng.length,
        'Cache-Control': 'no-cache'
      });
      res.end(qrPng);
      return;
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Failed to generate QR');
      return;
    }
  }

  // 4. ZPK / ZAB download (with optional on-the-fly API key patch)
  if (pathname.endsWith('.zpk') || pathname.endsWith('.zab')) {
    const baseZpk = ensureBaseZpk();
    if (!baseZpk || !fs.existsSync(baseZpk)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Base package not found');
      return;
    }

    const apiKey = parsedUrl.searchParams.get('key');
    if (apiKey && apiKey.length > 5) {
      const patchedBytes = patchZpk(baseZpk, apiKey);
      if (patchedBytes) {
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': patchedBytes.length,
          'Content-Disposition': 'attachment; filename="gemini_band.zpk"',
          'Access-Control-Allow-Origin': '*',
          'Connection': 'close'
        });
        res.end(patchedBytes);
        console.log(`Served on-the-fly patched package (${patchedBytes.length} bytes) with 200 OK`);
        return;
      }
    }

    // Default base package without patch
    const stat = fs.statSync(baseZpk);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${path.basename(baseZpk)}"`,
      'Access-Control-Allow-Origin': '*',
      'Connection': 'close'
    });
    fs.createReadStream(baseZpk).pipe(res);
    console.log(`Served base package ${baseZpk} (${stat.size} bytes) with 200 OK`);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gemini Band Builder Server listening on http://0.0.0.0:${PORT}`);
});
