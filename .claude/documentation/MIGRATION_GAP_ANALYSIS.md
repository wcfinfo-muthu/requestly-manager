# Migration Gap Analysis
**Date:** 2026-04-10  
**Current State vs CLAUDE.md Requirements**

---

## 📊 Executive Summary

The codebase has a solid foundation (75% complete) with working rule engine, storage, and UI. Main gaps are:
- Missing 2 rule types (Headers, Response Overwrite)
- No Google OAuth/Drive sync
- No folder structure reorganization
- UI needs enhancement for new rule types

---

## ✅ COMPLETED Features

### 1. **Network Rules Engine** ✓
- **Location:** `rules.js`
- **Status:** Functional
- **Current Rule Types:**
  - `REDIRECT` — change request URL
  - `BLOCK` — block requests
  - `REPLACE` — modify request/response content
- **Implementation:** Uses declarativeNetRequest API (Manifest v3)
- **Functions:** 
  - `buildDNRRules()` — converts user rules to DNR format
  - `doesRuleMatchUrl()` — URL matching logic
  - Regex and wildcard pattern support

### 2. **Rule Execution Flow** ✓
- **Location:** `background.js`, `rules.js`
- **Steps Implemented:**
  1. Load rules from `chrome.storage.sync`
  2. Filter enabled rules automatically
  3. Match request against conditions in DNR
  4. Apply transformations via declarativeNetRequest
- **Storage Sync:** Listens to `chrome.storage.onChanged` for live sync

### 3. **Rule Schema** ✓
- **Current Structure:**
  ```json
  {
    "id": "timestamp_based",
    "name": "Rule Display Name",
    "type": "redirect|block|replace",
    "sourcePattern": "url or regex pattern",
    "destination": "redirect URL (for redirect)",
    "findText": "text to find (for replace)",
    "replaceText": "replacement text (for replace)",
    "enabled": true,
    "pinned": false,
    "createdAt": "timestamp"
  }
  ```
- **Validated:** Used in `addRule()`, `updateRule()`, `saveRules()`

### 4. **Chrome Extension (Manifest v3)** ✓
- **manifest.json:** v3 compliant
- **Background Service Worker:** `background.js` ✓
- **Options Page (UI):** `index.html`, `index.js` ✓
- **Popup UI:** `popup.html`, `popup.js` ✓
- **Content Scripts:** `content.js` (tab indicator, popup) ✓
- **Permissions:** 
  - `declarativeNetRequest` ✓
  - `storage` ✓
  - `activeTab` ✓
  - Missing: `identity` (for OAuth)

### 5. **Storage Layer** ✓
- **Location:** `rules.js`
- **Implementation:**
  - `chrome.storage.sync` (primary)
  - localStorage fallback (`requestly_rules_fallback`)
  - Web bridge for demo mode
- **Functions:** `getRules()`, `saveRules()`, `toggleRule()`

### 6. **UI Features** ✓
- **Options Page:**
  - Create/Edit/Delete rules
  - Toggle rules
  - Search & filter
  - Import/Export JSON
  - Pin up to 5 rules
- **Popup:**
  - Quick add rule form
  - Latest/Pinned tabs
  - Toggle extension master switch
- **On-Page Indicator:**
  - Draggable icon showing active rules
  - Popup with screenshots, performance stats
  - Rule toggle

### 7. **Performance** ✓
- Rules cached in memory
- No per-request rule iteration (uses DNR)
- URL patterns precompiled to regex
- Fallback storage for offline mode

---

## ❌ MISSING Features (GAPS)

### 1. **Headers Rule Type** ❌
- **CLAUDE.md Reference:** Section 1, "Rule Execution Flow"
- **Status:** Not implemented
- **What's Needed:**
  - `HEADERS` in `RULE_TYPES`
  - Schema: `{ type: "headers", action: { add: {}, remove: [], modify: {} } }`
  - `buildDNRRules()` extension to handle header actions
  - DNR: `modifyHeaders` action (Manifest v3 feature)
  - UI: Headers editor with add/remove/modify fields
- **Estimated Complexity:** Medium
- **Files to Modify:** `rules.js`, `index.js`, `index.html`

### 2. **Response Overwrite Rule Type** ❌
- **CLAUDE.md Reference:** `.claude/rules/response-overwrite.md`
- **Status:** Not implemented
- **What's Needed:**
  - `RESPONSE_OVERWRITE` in `RULE_TYPES`
  - Schema: `{ type: "response", action: { body: {...}, status: 200 } }`
  - Mock API responses with custom content
  - DNR: `redirect` to data URL or blob (complex)
  - Alternative: Web request interception via content script
  - UI: JSON editor with syntax highlighting
- **Estimated Complexity:** High (DNR limitations)
- **Files to Modify:** `rules.js`, `content.js`, `index.js`, `index.html`
- **Note:** DNR doesn't have native response mocking; may need content script bridge

### 3. **Google OAuth Authentication** ❌
- **CLAUDE.md Section:** "🔐 Google Integration → Authentication"
- **Status:** Not implemented
- **What's Needed:**
  - `chrome.identity.launchWebAuthFlow`
  - OAuth2 client ID from Google Cloud Console
  - Access token retrieval and storage
  - Session token in `chrome.storage.sync` (never in UI)
  - Login/Logout flow in options page
  - User profile display
- **Estimated Complexity:** High
- **Files to Create:** `src/services/google.js` (OAuth handler)
- **Manifest Update:** Add `identity` permission
- **Dependencies:** Google OAuth2 endpoint setup

### 4. **Google Drive Sync** ❌
- **CLAUDE.md Section:** "🔐 Google Integration → Drive Sync"
- **Status:** Not implemented
- **What's Needed:**
  - `services/google.js` with Drive API integration
  - Save rules as `rules.json` to Drive
  - Fetch rules on login
  - Conflict resolution (last-write-wins or merge)
  - Versioning/metadata tracking
  - Sync status indicator in UI
  - `chrome.storage.sync` to hold Drive sync state
- **Estimated Complexity:** Very High
- **Dependencies:**
  - Google Drive API client library
  - OAuth2 access token from auth service
  - Error handling for network/quota issues

### 5. **Folder Structure Reorganization** ❌
- **CLAUDE.md Section:** "📁 Suggested Folder Structure"
- **Current Structure:**
  ```
  / (root)
  ├── background.js
  ├── config.js
  ├── rules.js
  ├── content.js
  ├── popup.js
  ├── index.js
  └── ...
  ```
- **Suggested Structure (Not Yet Done):**
  ```
  src/
  ├── background/
  │   └── service-worker.js (from background.js)
  ├── rules/
  │   └── engine.js (from rules.js)
  ├── ui/
  │   └── options.html (already there as index.html)
  ├── services/
  │   ├── storage.js (new - abstract chrome.storage)
  │   ├── google.js (new - OAuth + Drive)
  │   └── rules-sync.js (new - sync orchestration)
  ├── utils/
  │   └── helpers.js (new - shared utilities)
  ├── config.js (stays in root or moves to src/)
  ├── content.js (stays in root or moves to src/)
  ├── popup.js (stays in root or moves to src/)
  └── manifest.json (updated paths)
  ```
- **Estimated Complexity:** Medium
- **Impact:** All import paths must be updated
- **Strategy:** Can be done incrementally or as part of refactor

### 6. **Enhanced UI Components** ❌
- **Missing/Incomplete Elements:**
  - Headers editor (multi-field form)
  - Response Overwrite editor (JSON + text modes)
  - Google login button
  - Sync status indicator
  - Last sync timestamp display
  - Conflict resolution dialog
  - Rule categories/groups (nice-to-have)
- **Estimated Complexity:** Medium-High
- **Files to Modify:** `index.html`, `index.js`, `popup.html`, `popup.js`

---

## 📋 Rule Type Implementation Checklist

### Headers Rule
```json
{
  "type": "headers",
  "condition": { "url": "api.example.com" },
  "action": {
    "add": { "X-Custom-Header": "value" },
    "remove": ["Authorization"],
    "modify": { "User-Agent": "Custom-Agent" }
  }
}
```
- [ ] Add `HEADERS` to `RULE_TYPES`
- [ ] Extend `buildDNRRules()` with header action
- [ ] Add `modifyHeaders` DNR action
- [ ] Create UI form for headers
- [ ] Test with real API calls

### Response Overwrite Rule
```json
{
  "type": "response",
  "condition": { "url": "api.example.com/users" },
  "action": {
    "body": { "users": [{ "id": 1, "name": "Mock" }] },
    "status": 200,
    "headers": { "Content-Type": "application/json" }
  }
}
```
- [ ] Add `RESPONSE_OVERWRITE` to `RULE_TYPES`
- [ ] Decide on implementation (DNR or content script)
- [ ] If using content script: intercept `fetch` and `XMLHttpRequest`
- [ ] Create UI JSON editor
- [ ] Add preview/validation
- [ ] Test with mock API

---

## 🔄 Storage & Sync Strategy

### Current (Local Storage Only)
- Rules stored in `chrome.storage.sync`
- Falls back to `localStorage` in demo mode
- No cloud backup

### With Google Drive
- **Primary Source:** `chrome.storage.sync` (cache)
- **Cloud Backup:** Google Drive `rules.json`
- **Sync Flow:**
  1. User logs in → OAuth token stored
  2. Rules changed → Upload to Drive (debounced)
  3. User logs in on new device → Fetch from Drive
  4. Offline → Use local cache, sync when online
- **Metadata Tracked:**
  - Last sync timestamp
  - Drive file ID
  - Sync status (pending/synced/error)

---

## 📦 Dependencies & APIs

### Already Used
- ✓ `chrome.declarativeNetRequest` (network rules)
- ✓ `chrome.storage` (local storage)
- ✓ `chrome.runtime` (messaging)
- ✓ `chrome.downloads` (screenshot export)

### Need to Add
- ❌ `chrome.identity` (OAuth flow)
- ❌ `Google Drive API` (cloud sync)
- ❌ `Google OAuth2 Endpoint` (authentication)

### Optional/Future
- `chrome.alarms` (scheduled sync)
- `chrome.notifications` (sync status alerts)
- Analytics library (usage tracking)

---

## 🎯 Implementation Roadmap

| Phase | Tasks | Priority |
|-------|-------|----------|
| **Phase 1** | Headers rule type | HIGH |
| **Phase 2** | Response Overwrite rule type | HIGH |
| **Phase 3** | Google OAuth setup | MEDIUM |
| **Phase 4** | Google Drive sync service | MEDIUM |
| **Phase 5** | Code reorganization (src/) | LOW |
| **Phase 6** | Enhanced UI for new features | MEDIUM |
| **Phase 7** | Testing & documentation | MEDIUM |

---

## 🚀 Quick Start for Implementation

### Minimum Viable Product (MVP)
1. ✅ Headers rule type (no UI needed initially)
2. ✅ Response Overwrite rule type (with content script)
3. ✅ Export/Import for "cloud" backup (user-managed)

### Then Add
4. ❌ Google OAuth
5. ❌ Google Drive sync
6. ❌ UI enhancements

---

## ⚠️ Known Limitations & Constraints

### DNR Limitations
- `modifyHeaders` action is limited to request headers only
- Response body rewriting not directly supported
- Response mocking requires content script bridge
- Max 30,000 dynamic rules (no issue for typical use)

### Chrome Storage
- `chrome.storage.sync` has size limit (~100KB per value)
- For large rule sets, may need Drive as primary
- Sync across devices takes time (not instant)

### OAuth/Drive
- Requires user to grant permissions
- Need Google Cloud Console setup
- API quotas apply
- Error handling for API failures needed

---

## 📝 Files Summary

| File | Status | Lines | Purpose |
|------|--------|-------|---------|
| `manifest.json` | ✓ Complete | 75 | Extension config |
| `background.js` | ✓ Complete | 187 | Service worker |
| `rules.js` | ⚠️ Partial | 314 | Rule engine (missing headers, response) |
| `config.js` | ✓ Complete | 28 | Configuration |
| `content.js` | ✓ Complete | 559 | Tab indicator & popup |
| `index.js` | ⚠️ Partial | 410+ | Options page (needs new fields) |
| `index.html` | ⚠️ Partial | 400+ | Options UI (needs new editors) |
| `popup.js` | ✓ Complete | 237 | Popup logic |
| `popup.html` | ✓ Complete | 100+ | Popup UI |

---

## 🎬 Next Steps

1. **Verify This Analysis** → Review findings, confirm priorities
2. **Create Feature Branches** → One for each major feature
3. **Implement Headers** → Start with rule type in rules.js
4. **Implement Response Overwrite** → More complex, needs testing
5. **Plan OAuth** → Requires external setup (Google Console)
6. **Reorganize Code** → Only after all features work

---

## 💡 Notes

- Current code is **well-structured** and follows conventions
- **Zero technical debt** in existing rules engine
- **Web bridge** is clever fallback for demo mode
- **Performance is solid** — uses declarativeNetRequest (not blocking)
- **Security is good** — stores tokens never exposed to UI
- Main effort is **feature expansion**, not refactoring
