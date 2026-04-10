# 🧠 Claude System File — Chrome Extension (Requestly Clone)

## 🎯 Project Goal

Build a powerful Chrome Extension similar to Requestly that allows developers to intercept and modify network requests using a rule-based system, with cloud sync via Google.

---

## 🚀 Core Features

### 1. Network Rules Engine

Support the following rule types:

* Redirect (change request URL)
* Replace (modify request/response content)
* Headers (add/remove/update headers)
* Response Overwrite (mock API responses)

---

### 2. Rule Execution Flow

1. Load rules from storage
2. Filter enabled rules
3. Match request against conditions
4. Apply rule transformation
5. Return modified request/response

---

## 📦 Rule Schema

```json
{
  "id": "rule_1",
  "type": "redirect",
  "condition": {
    "url": "api.example.com",
    "method": "GET"
  },
  "action": {
    "redirectUrl": "mock.example.com"
  },
  "enabled": true
}
```

---

## 🏗️ Architecture

### Chrome Extension (Manifest v3)

* **Background Service Worker**

  * Handles rules execution
  * Listens to network events
  * Applies transformations

* **Options Page (UI)**

  * Create/Edit/Delete rules
  * Toggle rules
  * Trigger sync

* **Storage Layer**

  * chrome.storage.local
  * In-memory cache for performance

---

## 🔧 APIs & Technologies

* Chrome APIs:

  * `chrome.declarativeNetRequest`
  * `chrome.storage`
  * `chrome.identity`

* Google APIs:

  * OAuth2 (Login)
  * Google Drive API (Sync rules)

---

## 🔐 Google Integration

### Authentication

* Use `chrome.identity.launchWebAuthFlow`
* Retrieve access token
* Store token securely (never expose in UI)

### Drive Sync

* Save rules as `rules.json`
* Upload to Google Drive
* Fetch and restore rules on login

---

## ⚡ Performance Guidelines

* Cache rules in memory
* Avoid iterating all rules per request
* Precompile URL match patterns (RegExp)
* Prefer `declarativeNetRequest` over `webRequest`

---

## 📁 Suggested Folder Structure

```
src/
 ├── background/
 │    └── service-worker.js
 ├── rules/
 │    └── engine.js
 ├── ui/
 │    └── options.html
 ├── services/
 │    ├── storage.js
 │    └── google.js
```

---

## 🧩 Coding Guidelines

* Use ES6 modules
* Keep functions small & reusable
* Separate UI from business logic
* Use async/await for all async operations
* Maintain clean JSON-based rule definitions

---

## 🛡️ Security Considerations

* Never expose OAuth tokens in frontend
* Limit Google API scopes
* Validate all rule inputs
* Prevent malicious script injection

---

## 📈 Future Enhancements

* Rule import/export
* Rule sharing via link
* Team sync (multi-user)
* Rule debugging logs
* UI like DevTools panel

---

## 🧠 Claude Behavior Instructions

When generating code:

* Always follow Manifest v3 standards
* Prefer declarative approaches
* Keep code modular and production-ready
* Avoid unnecessary dependencies
* Include comments for clarity

When suggesting improvements:

* Focus on performance
* Ensure scalability
* Keep developer experience simple

---

## ✅ Success Criteria

* Rules execute correctly in real-time
* UI is intuitive and fast
* Google sync works reliably
* Extension passes Chrome Web Store policies
* Codebase is maintainable and scalable

---

🔥 This file defines how Claude should think, generate, and assist in building this extension.