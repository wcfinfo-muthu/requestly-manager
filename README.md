# 🔄 URL Rewriter — Chrome Extension

<p align="center">
  <img src="icons/app128.png" width="80" height="80" alt="URL Rewriter Logo" />
</p>

<p align="center">
  <strong>High-performance request manipulation engine for Chrome, engineered for developers.</strong><br/>
  Redirect, block, or find-and-replace URLs with zero latency using Chrome's native <code>declarativeNetRequest</code> API.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/Chrome-Extension-yellow?style=flat-square&logo=googlechrome" />
</p>

---

## ✨ Features

| Feature | Description |
|---|---|
| **→ Redirect** | Transparently route requests between environments using wildcards |
| **✕ Block** | Zero-latency request termination for trackers, ads, or unwanted scripts |
| **⇄ Find & Replace** | Granular text substitution for dynamic URL parameters and hostnames |
| **📌 Pinned Rules** | Pin up to **5 rules** for instant access from the popup menu |
| **⚡ Quick Add** | Add rules instantly from the popup without opening the options page |
| **🔍 Search** | Filter rules by name or URL pattern in the full dashboard |
| **Import / Export** | Backup and restore your full ruleset as a JSON file |

---

## 🚀 Installation

### Load Unpacked (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/wcfinfo-muthu/requestly.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked** and select the cloned `requestly/` folder

5. The extension icon will appear in your toolbar — pin it for quick access!

---

## 📋 Rule Format (Import / Export)

Rules are stored and exported as a JSON array. Each rule supports the following fields:

```json
[
  {
    "name": "Redirect staging to prod",
    "type": "redirect",
    "sourcePattern": "*://staging.myapp.com/*",
    "destination": "https://prod.myapp.com/",
    "enabled": true,
    "pinned": true
  },
  {
    "name": "Block ads",
    "type": "block",
    "sourcePattern": "*://ads.example.com/*",
    "enabled": true,
    "pinned": false
  },
  {
    "name": "Replace hostname",
    "type": "replace",
    "findText": "dev.myapp.com",
    "replaceText": "prod.myapp.com",
    "enabled": true,
    "pinned": false
  }
]
```

### Field Reference

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Display name for the rule |
| `type` | `"redirect"` \| `"block"` \| `"replace"` | Rule action type |
| `sourcePattern` | `string` | URL pattern to match. Use `*` as wildcard, `*://` for both HTTP & HTTPS |
| `destination` | `string` | Target URL for redirect rules |
| `findText` | `string` | Text to find in the URL (replace rules only) |
| `replaceText` | `string` | Replacement text (replace rules only) |
| `enabled` | `boolean` | Whether the rule is active |
| `pinned` | `boolean` | Whether the rule is pinned to the popup (max 5) |

---

## 🏗 Project Structure

```
requestly/
├── manifest.json        # Chrome Extension Manifest V3
├── background.js        # Service worker — declarativeNetRequest integration
├── rules.js             # Shared rule CRUD utilities (storage + DNR sync)
├── popup.html/css/js    # Extension popup UI (Quick Add + Latest/Pinned tabs)
├── options.html/css/js  # Full-page dashboard (rule table, import/export, about)
├── icons/               # App icons (16, 32, 48, 128px)
└── migrated_rules.json  # Example/migration ruleset (not loaded automatically)
```

---

## 🔧 Tech Stack

- **Manifest V3** — Service worker architecture
- **declarativeNetRequest** — Native Chrome request manipulation API (< 1ms latency)
- **chrome.storage.sync** — Cloud-synced rule persistence across devices
- **Vanilla JS** — Zero dependencies, fast startup
- **Space Grotesk + JetBrains Mono** — Premium developer typography

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
