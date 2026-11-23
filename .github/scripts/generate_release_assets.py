#!/usr/bin/env python3
import sys
import os
import shutil
import io
import qrcode

def main():
    if len(sys.argv) < 5:
        print("Usage: generate_release_assets.py <zpk_path> <repo_owner> <repo_name> <full_repo> [model_name]")
        sys.exit(1)

    zpk_path = sys.argv[1]
    repo_owner = sys.argv[2]
    repo_name = sys.argv[3]
    full_repo = sys.argv[4]
    model_name = sys.argv[5] if len(sys.argv) > 5 else "Gemini 4 Hydrogen / 3.8 Flash / 3.5 Lite"

    public_dir = os.path.abspath("public")
    os.makedirs(public_dir, exist_ok=True)

    # 1. Copy gemini_band.zpk
    dest_zpk = os.path.join(public_dir, "gemini_band.zpk")
    if os.path.exists(zpk_path):
        shutil.copyfile(zpk_path, dest_zpk)
        zpk_size_kb = round(os.path.getsize(dest_zpk) / 1024, 1)
    else:
        print(f"Warning: {zpk_path} not found")
        zpk_size_kb = 0

    # 2. Copy icon.png if present
    if os.path.exists("icon.png"):
        shutil.copyfile("icon.png", os.path.join(public_dir, "icon.png"))

    # 3. Construct URLs
    # GitHub Pages:
    url_pages = f"zpkd1://{repo_owner}.github.io/{repo_name}/gemini_band.zpk"
    # GitHub Release:
    url_release = f"zpkd1://github.com/{full_repo}/releases/download/personal-build/gemini_band.zpk"
    # Fallback raw / direct HTTPS
    http_release = f"https://github.com/{full_repo}/releases/download/personal-build/gemini_band.zpk"
    http_pages = f"https://{repo_owner}.github.io/{repo_name}/gemini_band.zpk"

    # 4. Generate QR code images (PNG)
    # GitHub Release QR (standard default for releases)
    qr_rel = qrcode.QRCode(box_size=8, border=2)
    qr_rel.add_data(url_release)
    qr_rel.make(fit=True)
    img_rel = qr_rel.make_image(fill_color="black", back_color="white")
    img_rel.save(os.path.join(public_dir, "qr_release.png"))

    # GitHub Pages QR
    qr_pg = qrcode.QRCode(box_size=8, border=2)
    qr_pg.add_data(url_pages)
    qr_pg.make(fit=True)
    img_pg = qr_pg.make_image(fill_color="black", back_color="white")
    img_pg.save(os.path.join(public_dir, "qr_pages.png"))

    # 5. Generate ASCII QR Code
    ascii_buf = io.StringIO()
    qr_rel.print_ascii(out=ascii_buf, invert=True)
    ascii_qr = ascii_buf.getvalue()

    # 6. Write public/index.html (GitHub Pages landing & installer)
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gemini Band — Installation</title>
  <link rel="icon" type="image/png" href="icon.png">
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: #0d1117;
      color: #c9d1d9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      padding: 32px 16px;
      display: flex;
      justify-content: center;
    }}
    .container {{
      max-width: 480px;
      width: 100%;
    }}
    .header {{
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }}
    .header img {{
      width: 40px;
      height: 40px;
      border-radius: 8px;
    }}
    h1 {{
      font-size: 20px;
      font-weight: 600;
      color: #f0f6fc;
    }}
    .desc {{
      font-size: 13px;
      color: #8b949e;
      margin-bottom: 24px;
      line-height: 1.5;
    }}
    .card {{
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      text-align: center;
    }}
    .card h2 {{
      font-size: 15px;
      color: #f0f6fc;
      margin-bottom: 12px;
      text-align: left;
    }}
    .qr-box {{
      background: #ffffff;
      padding: 12px;
      border-radius: 8px;
      display: inline-block;
      margin-bottom: 14px;
    }}
    .qr-box img {{
      display: block;
      width: 220px;
      height: 220px;
    }}
    .btn {{
      display: block;
      width: 100%;
      text-align: center;
      background: #238636;
      color: #ffffff;
      border: 1px solid rgba(240, 246, 252, 0.1);
      border-radius: 6px;
      padding: 10px;
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      margin-bottom: 8px;
      cursor: pointer;
    }}
    .btn:hover {{
      background: #2ea043;
    }}
    .btn-secondary {{
      background: #21262d;
      color: #58a6ff;
      border: 1px solid #30363d;
    }}
    .btn-secondary:hover {{
      background: #30363d;
    }}
    .code-box {{
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 8px 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      color: #8b949e;
      word-break: break-all;
      margin-bottom: 14px;
      text-align: left;
    }}
    .steps {{
      font-size: 13px;
      color: #c9d1d9;
      line-height: 1.6;
      text-align: left;
      margin-top: 14px;
      border-top: 1px solid #30363d;
      padding-top: 14px;
    }}
    .steps ol {{
      margin-left: 20px;
    }}
    .badge {{
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      background: #1f6feb22;
      color: #58a6ff;
      border: 1px solid #1f6feb44;
      margin-bottom: 10px;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="icon.png" alt="Icon">
      <div>
        <h1>Gemini Band</h1>
        <span class="badge">Model: {model_name} • {zpk_size_kb} KB</span>
      </div>
    </div>
    <p class="desc">Standalone Google Gemini AI client for Xiaomi Smart Band 7 (Zepp OS 1.0).</p>

    <div class="card">
      <h2>Install via Zepp App</h2>
      <div class="qr-box">
        <img src="qr_release.png" alt="Installation QR Code">
      </div>
      <div class="code-box">{url_release}</div>
      <a href="{url_release}" class="btn">Open in Zepp App (Mobile)</a>
      <a href="./gemini_band.zpk" class="btn btn-secondary" download>Download .zpk File</a>

      <div class="steps">
        <ol>
          <li>Open the <b>Zepp</b> app on your phone.</li>
          <li>Go to <b>Profile ➔ Xiaomi Smart Band 7 (Amazfit Band 7) ➔ Developer Mode</b>.</li>
          <li>Tap the <b>QR Code Scanner</b> icon in the top right corner.</li>
          <li>Scan the QR code above to transfer and install via Bluetooth.</li>
        </ol>
      </div>
    </div>
  </div>
</body>
</html>"""

    with open(os.path.join(public_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write(html_content)

    # 7. Write step_summary.md for GitHub Actions Summary
    summary_content = f"""## 📲 Gemini Band Personal Build Ready!

Your personal package has been built with your Gemini API key and is ready to install on your **Xiaomi Smart Band 7**!

---

### 📷 Scan to Install (Zepp Developer Mode)

Scan this QR code using **Zepp App ➔ Profile ➔ Amazfit Band 7 ➔ Developer Mode ➔ QR Scanner**:

<div align="center">
  <img src="https://github.com/{full_repo}/releases/download/personal-build/qr_release.png" width="220" height="220" alt="Zepp QR Code" />
  <p><b>Deep Link:</b></p>
  <code>{url_release}</code>
</div>

---

### 💻 Terminal ASCII QR Code
*(If browsing from terminal or images are blocked, scan directly off your screen):*

```text
{ascii_qr}
```

---

### 🔗 Direct Links
* 📦 **Download Package:** [`gemini_band.zpk` ({zpk_size_kb} KB)]({http_release})
* 🌐 **GitHub Pages Mirror:** [{http_pages}]({http_pages})
* 📱 **Mobile One-Tap Install:** [`{url_release}`]({url_release})

> **Note:** Sideloading via Zepp Developer Mode requires the band to be paired via the **Zepp MB7 mod** (masked as Amazfit Band 7).
"""

    with open("step_summary.md", "w", encoding="utf-8") as f:
        f.write(summary_content)

    # 8. Print ASCII to terminal log
    print("\n" + "="*50)
    print("GEMINI BAND - SCAN THIS QR CODE IN ZEPP DEVELOPER MODE:")
    print("="*50 + "\n")
    print(ascii_qr)
    print("Deep link:", url_release)
    print("="*50 + "\n")

if __name__ == "__main__":
    main()
