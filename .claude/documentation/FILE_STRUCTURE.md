# File Structure Reorganization
**Completed:** 2026-04-10

## Overview
Reorganized project structure to follow CLAUDE.md recommendations, improving code organization, modularity, and scalability.

---

## New Structure

```
requestly/
├── src/
│   ├── background/
│   │   └── service-worker.js        # Extension background service worker
│   ├── rules/
│   │   └── engine.js                # Rule engine and DNR builder
│   ├── services/
│   │   ├── storage.js               # Chrome storage abstraction
│   │   └── google.js                # (future) Google OAuth + Drive
│   ├── ui/
│   │   ├── options.html             # Settings/Rules manager UI
│   │   ├── options.js               # Settings page logic
│   │   ├── options.css              # Settings styles
│   │   ├── popup.html               # Popup UI
│   │   ├── popup.js                 # Popup logic
│   │   └── popup.css                # Popup styles
│   ├── config.js                    # Configuration constants
│   └── content.js                   # Content script (tab indicator + mocking)
├── manifest.json                     # (updated paths)
├── config.js                         # (kept in root for backward compat)
├── rules.js                          # (kept in root for backward compat)
├── background.js                     # (kept in root for backward compat)
├── content.js                        # (kept in root for backward compat)
├── index.html, index.js, index.css   # (kept in root for backward compat)
├── popup.html, popup.js, popup.css   # (kept in root for backward compat)
├── icons/
│   └── *.png                         # Extension icons
├── .claude/                          # Claude project configuration
└── .git/                             # Git repository

```

---

## File Migration Map

| Old Location | New Location | Notes |
|---|---|---|
| `rules.js` | `src/rules/engine.js` | Rule engine - no imports |
| `config.js` | `src/config.js` | Config constants |
| `background.js` | `src/background/service-worker.js` | Updated imports |
| `content.js` | `src/content.js` | Content script |
| `index.js` | `src/ui/options.js` | Updated imports |
| `index.html` | `src/ui/options.html` | Updated paths |
| `index.css` | `src/ui/options.css` | No changes |
| `popup.js` | `src/ui/popup.js` | Updated imports |
| `popup.html` | `src/ui/popup.html` | Updated paths |
| `popup.css` | `src/ui/popup.css` | No changes |
| — | `src/services/storage.js` | NEW: Storage abstraction |
| — | `src/services/google.js` | NEW: (future) OAuth + Drive |

---

## Import Path Updates

### src/background/service-worker.js
```javascript
// OLD:
import {getRules, buildDNRRules, doesRuleMatchUrl, toggleRule} from './rules.js';
import {CONFIG} from './config.js';

// NEW:
import {getRules, buildDNRRules, doesRuleMatchUrl, toggleRule} from '../rules/engine.js';
import {CONFIG} from '../config.js';
```

### src/ui/options.js
```javascript
// OLD:
import {getRules, addRule, updateRule, deleteRule, toggleRule, saveRules, RULE_TYPES, webBridgeCall} from './rules.js';

// NEW:
import {getRules, addRule, updateRule, deleteRule, toggleRule, saveRules, RULE_TYPES, webBridgeCall} from '../rules/engine.js';
```

### src/ui/popup.js
```javascript
// OLD:
import {getRules, addRule, deleteRule, toggleRule, updateRule, RULE_TYPES} from './rules.js';
import {CONFIG} from './config.js';

// NEW:
import {getRules, addRule, deleteRule, toggleRule, updateRule, RULE_TYPES} from '../rules/engine.js';
import {CONFIG} from '../config.js';
```

---

## Manifest.json Updates

```json
{
  "background": {
    "service_worker": "src/background/service-worker.js"
  },
  "options_ui": {
    "page": "src/ui/options.html"
  },
  "action": {
    "default_popup": "src/ui/popup.html"
  },
  "content_scripts": [{
    "js": [
      "src/config.js",
      "src/content.js"
    ]
  }]
}
```

---

## Icon Path Updates

### HTML Files
Icons moved from `icons/` to `../../icons/` (relative to src/ui/ folder):
```html
<!-- OLD: -->
<img src="icons/app48.png" />

<!-- NEW: -->
<img src="../../icons/app48.png" />
```

Updated in:
- `src/ui/options.html` (2 references)
- `src/ui/popup.html` (1 reference)

---

## Backward Compatibility

Original files remain in root directory for backward compatibility:
- `config.js`
- `rules.js`
- `background.js`
- `content.js`
- `index.js`, `index.html`, `index.css`
- `popup.js`, `popup.html`, `popup.css`

These can be removed after confirming the extension works with the new structure.

---

## Testing Checklist

- [ ] Extension loads without errors
- [ ] Options page opens at `src/ui/options.html`
- [ ] Popup opens at `src/ui/popup.html`
- [ ] Background service worker communicates correctly
- [ ] Content script loads on all pages
- [ ] Rules sync and execute properly
- [ ] Headers rule type works
- [ ] Response Overwrite rule type works
- [ ] Icons display correctly (relative paths)

---

## Next Steps

1. **Test Extension**: Load unpacked extension and verify all paths work
2. **Remove Backward Compat Files**: Delete original files after testing
3. **Create Storage Service Integration**: Update rules.js to use StorageService (optional refactor)
4. **Plan OAuth Service**: Prepare src/services/google.js for OAuth + Drive sync
5. **Documentation**: Update developer setup guide for new structure

---

## Benefits of New Structure

✅ **Better Organization**: Each module has a single responsibility
✅ **Scalability**: Easy to add new services (OAuth, analytics, etc.)
✅ **Modularity**: Clear separation between UI, business logic, and services
✅ **Maintainability**: Follows CLAUDE.md architecture guidelines
✅ **Testing**: Easier to mock and test services independently
✅ **Future Growth**: Foundation ready for team expansion and complex features
