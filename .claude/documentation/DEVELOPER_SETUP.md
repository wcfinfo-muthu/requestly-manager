# Developer Setup Guide

**Date:** 2026-04-10

---

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- npm or yarn
- Chrome browser
- Git

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd requestly

# Install dependencies
npm install

# Run tests
npm test

# Build (if applicable)
npm run build
```

---

## 🔧 Development Setup

### 1. Load Extension in Chrome

```bash
# 1. Open Chrome
# 2. Go to chrome://extensions/
# 3. Enable "Developer mode" (toggle top right)
# 4. Click "Load unpacked"
# 5. Select the project root folder
```

### 2. Configure Google OAuth

**Required for sync features**

```bash
# 1. Go to Google Cloud Console
#    https://console.cloud.google.com/

# 2. Create new project:
#    - Project name: "Requestly Dev"
#    - Click Create

# 3. Enable APIs:
#    - Go to APIs & Services
#    - Click "Enable APIs and Services"
#    - Search for "Google Drive API"
#    - Click Enable
#    - Repeat for "Google+ API"

# 4. Create OAuth 2.0 credentials:
#    - Click "Create Credentials"
#    - Type: OAuth 2.0 Client ID
#    - Application type: Desktop application
#    - Click Create
#    - Copy the Client ID

# 5. Add to extension:
#    - Open manifest.json
#    - Find "oauth2" section
#    - Replace "YOUR_CLIENT_ID.apps.googleusercontent.com"
#    - Save file

# 6. Reload extension:
#    - Go to chrome://extensions/
#    - Click reload icon next to Requestly
```

### 3. Verify Installation

```javascript
// In Chrome DevTools Console (on any page):
chrome.runtime.sendMessage({type: 'GET_RULES'}, (response) => {
    console.log('Rules:', response.rules);
});

// Or use keyboard shortcut:
// Ctrl+Shift+J (Windows/Linux) or Cmd+Option+J (Mac)
```

---

## 📁 Project Structure

```
requestly/
├── src/
│   ├── background/
│   │   └── service-worker.js      # Extension entry point
│   ├── rules/
│   │   ├── engine.js              # Rule management
│   │   └── __tests__/
│   │       └── engine.test.js      # Rule tests
│   ├── services/
│   │   ├── google.js              # OAuth & Drive API
│   │   ├── sync.js                # Sync orchestration
│   │   ├── storage.js             # Storage abstraction
│   │   └── __tests__/
│   │       └── sync.test.js        # Sync tests
│   ├── ui/
│   │   ├── options.html           # Settings page
│   │   ├── options.js             # Settings logic
│   │   ├── options.css            # Settings styles
│   │   ├── popup.html             # Popup UI
│   │   ├── popup.js               # Popup logic
│   │   └── popup.css              # Popup styles
│   ├── config.js                  # Configuration
│   └── content.js                 # Content script
├── icons/                         # App icons
├── manifest.json                  # Extension manifest
├── jest.config.js                 # Jest configuration
├── package.json                   # NPM config
└── README.md                      # Project README
```

---

## 🧪 Running Tests

### Unit Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test engine.test.js

# Run with coverage
npm test -- --coverage

# Watch mode (re-run on changes)
npm test -- --watch
```

### Expected Coverage

- Statements: 70%+
- Branches: 70%+
- Functions: 70%+
- Lines: 70%+

### Test Examples

```javascript
// Example test in engine.test.js
test('should create redirect rule', () => {
    const rule = {
        type: 'redirect',
        name: 'Redirect staging',
        sourcePattern: '*://staging.example.com/*',
        destination: 'https://prod.example.com/',
    };
    
    expect(rule.type).toBe('redirect');
});
```

---

## 🐛 Debugging

### View Service Worker Logs

```bash
# 1. Go to chrome://extensions/
# 2. Click "Service Worker" link under Requestly
# 3. Check Console for logs prefixed with [URLRewriter], [SyncService], [GoogleAuth]
```

### Enable Debug Logging

Add to `src/background/service-worker.js`:

```javascript
const DEBUG = true;

if (DEBUG) {
    console.log('[URLRewriter] Rule applied:', rule);
}
```

### Inspect Storage

In Chrome DevTools Console:

```javascript
// View all storage
chrome.storage.sync.get(null, (items) => {
    console.log('Storage:', items);
});

// View specific key
chrome.storage.sync.get('rules', (data) => {
    console.log('Rules:', data.rules);
});

// View localStorage fallback
console.log('LocalStorage:', {
    rules: localStorage.getItem('requestly_rules_fallback'),
    history: localStorage.getItem('sync_history'),
});
```

### Test Messages

Send messages from DevTools Console:

```javascript
// Get all rules
chrome.runtime.sendMessage({type: 'GET_RULES'}, console.log);

// Get sync state
chrome.runtime.sendMessage({type: 'GET_SYNC_STATE'}, console.log);

// Force sync
chrome.runtime.sendMessage({type: 'FORCE_SYNC'}, (res) => {
    console.log('Sync result:', res);
});

// Get sync history
chrome.runtime.sendMessage({type: 'GET_SYNC_HISTORY'}, (res) => {
    console.log('Sync history:', res.history);
});
```

---

## 📝 Making Changes

### Adding a New Rule Type

1. Update `RULE_TYPES` in `src/rules/engine.js`:

```javascript
export const RULE_TYPES = {
    REDIRECT: 'redirect',
    BLOCK: 'block',
    REPLACE: 'replace',
    HEADERS: 'headers',
    RESPONSE: 'response',
    YOUR_TYPE: 'yourtype',  // Add here
};
```

2. Add conversion in `buildDNRRules()`:

```javascript
function buildDNRRules(userRules) {
    return userRules.map(rule => {
        // ... existing code ...
        
        case RULE_TYPES.YOUR_TYPE:
            // Implement conversion
            break;
    });
}
```

3. Add UI in `src/ui/options.html`:

```html
<button type="button" class="type-btn" data-type="yourtype">
    🎯 Your Type
</button>
```

4. Update `setType()` in `src/ui/options.js`:

```javascript
if (yourTypeField) {
    yourTypeField.classList.toggle('hidden', type !== RULE_TYPES.YOUR_TYPE);
}
```

5. Add tests in `src/rules/__tests__/engine.test.js`

6. Update this guide

---

### Modifying Sync Behavior

1. Edit `src/services/sync.js`:

```javascript
SyncService.options = {
    autoSync: true,
    autoSyncInterval: 5 * 60 * 1000,  // Change here
    conflictStrategy: 'merge',         // Or here
    enableVersionHistory: true,        // Or here
};
```

2. Test changes:

```bash
npm test -- sync.test.js
```

3. Reload extension in Chrome

4. Test in UI: Settings → Configure options

---

### Adding a New Storage Key

1. Update storage abstraction in `src/services/storage.js`:

```javascript
export const Storage = {
    async getMyData() {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined' && chrome.storage.sync) {
                chrome.storage.sync.get('my_key', data => {
                    resolve(data.my_key);
                });
            } else {
                resolve(localStorage.getItem('my_key'));
            }
        });
    },
    
    async setMyData(value) {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined' && chrome.storage.sync) {
                chrome.storage.sync.set({my_key: value}, resolve);
            } else {
                localStorage.setItem('my_key', JSON.stringify(value));
                resolve();
            }
        });
    },
};
```

2. Use in services:

```javascript
const data = await Storage.getMyData();
```

---

## 🔄 Git Workflow

### Create Feature Branch

```bash
# Update main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/my-feature

# Make changes
# ...

# Commit
git add .
git commit -m "feat: add my feature"

# Push
git push origin feature/my-feature

# Create Pull Request
```

### Commit Message Format

```
feat: add new feature
fix: fix bug
refactor: refactor code
test: add tests
docs: update documentation
```

---

## 📦 Building for Release

### Pre-Release Checklist

```bash
# 1. Run all tests
npm test -- --coverage

# 2. Check code style
npm run lint

# 3. Update version
# Edit manifest.json: "version": "1.0.1"

# 4. Update CHANGELOG.md

# 5. Create release commit
git add .
git commit -m "chore: release v1.0.1"
git tag v1.0.1

# 6. Push
git push origin main
git push origin v1.0.1
```

### Chrome Web Store Submission

```bash
# 1. Create distribution package
# - Zip entire project (excluding node_modules, .git)
# - Name: requestly-v1.0.1.zip

# 2. Go to Chrome Web Store Developer Dashboard
# https://chrome.google.com/webstore/devconsole

# 3. Upload .zip file
# - Click "Upload new package"
# - Select zip file
# - Review manifest and content

# 4. Fill in store listing
# - Title, description, screenshots
# - See CHROME_WEB_STORE_LISTING.md

# 5. Submit for review
# - Click "Publish"
# - Wait for review (typically 2-4 hours)
```

---

## 🎯 Code Style

### JavaScript

- Use ES6+ syntax (const, arrow functions, async/await)
- 4-space indentation
- Use meaningful variable names
- Add JSDoc comments for public functions

```javascript
/**
 * Fetch all rules from storage
 * @returns {Promise<Array>} Array of rule objects
 */
export async function getRules() {
    // Implementation
}
```

### CSS

- Use CSS custom properties for colors/spacing
- Mobile-first responsive design
- Consistent naming with kebab-case

```css
:root {
    --bg: #0f1115;
    --accent: #ffffff;
}

.my-component {
    background: var(--bg);
    color: var(--accent);
}
```

### HTML

- Semantic markup
- ARIA labels for accessibility
- Data attributes for JS selectors

```html
<button data-action="delete" aria-label="Delete rule">
    Delete
</button>
```

---

## 🚀 Performance Tips

### Rule Execution
- Minimize regex patterns
- Pre-compile regex at startup
- Use exact matches when possible

### Sync Operations
- Batch updates before syncing
- Implement debouncing for frequent changes
- Use hash comparison before syncing

### UI
- Virtualize large lists (500+ items)
- Lazy load UI components
- Debounce search input

---

## 🔐 Security Best Practices

1. **Never expose tokens in UI**
   ```javascript
   // ✗ Bad
   console.log(token);
   localStorage.setItem('token', token);
   
   // ✓ Good
   chrome.storage.sync.set({token}); // Encrypted
   ```

2. **Validate all inputs**
   ```javascript
   if (!sourcePattern || sourcePattern.trim().length === 0) {
       throw new Error('Source pattern required');
   }
   ```

3. **Escape HTML in DOM**
   ```javascript
   function escapeHtml(str) {
       return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
   }
   ```

4. **Limit API scopes**
   ```json
   "scopes": [
       "https://www.googleapis.com/auth/drive.file",
       "https://www.googleapis.com/auth/userinfo.email"
   ]
   ```

---

## 📚 Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest v3 Guide](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Google Drive API](https://developers.google.com/drive/api)
- [Jest Testing](https://jestjs.io/)

---

## 🆘 Troubleshooting

### Extension Not Loading
```bash
# 1. Check manifest.json syntax (JSON errors)
# 2. Verify all file paths exist
# 3. Check console for errors:
#    - chrome://extensions/
#    - Click "Details" on Requestly
#    - Scroll to "Errors"
```

### Tests Failing
```bash
# 1. Check Node.js version: node -v (should be 16+)
# 2. Reinstall dependencies: npm ci
# 3. Clear Jest cache: npm test -- --clearCache
# 4. Run single test: npm test -- <filename>
```

### Sync Not Working
```bash
# 1. Verify OAuth credentials in manifest.json
# 2. Check Service Worker logs
# 3. Verify Google Drive API enabled in console
# 4. Check network in DevTools
# 5. Try force refresh: chrome://extensions/ → reload
```

### Storage Not Working
```bash
# 1. Check Storage permissions in manifest.json
# 2. Verify storage.sync available: chrome.storage.sync exists
# 3. Check DevTools Storage tab
# 4. Try localStorage fallback: localStorage.getItem('requestly_rules_fallback')
```

---

**Last Updated:** 2026-04-10  
**Status:** Complete
