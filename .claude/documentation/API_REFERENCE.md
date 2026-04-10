# API Reference

**Date:** 2026-04-10  
**Version:** 1.0.0

---

## 📋 Overview

This document describes the public APIs available for extending and using the Requestly extension.

---

## 🎯 Rule Engine API

### `getRules()`

**Description:** Fetch all rules from storage

```javascript
const rules = await getRules();
```

**Returns:** `Promise<Array>` - Array of rule objects

**Example:**
```javascript
const rules = await getRules();
rules.forEach(rule => {
    console.log(`${rule.name} (${rule.type})`);
});
```

---

### `saveRules(rules)`

**Description:** Save rules to storage

```javascript
await saveRules(rules);
```

**Parameters:**
- `rules` (Array) - Array of rule objects

**Returns:** `Promise<void>`

**Example:**
```javascript
const rules = [...existingRules, newRule];
await saveRules(rules);
```

---

### `addRule(ruleData)`

**Description:** Create a new rule

```javascript
const rule = await addRule(ruleData);
```

**Parameters:**
- `ruleData` (Object) - Rule properties (name, type, sourcePattern, etc.)

**Returns:** `Promise<Object>` - Created rule with auto-generated ID

**Example:**
```javascript
const rule = await addRule({
    name: 'Redirect staging',
    type: 'redirect',
    sourcePattern: '*://staging.example.com/*',
    destination: 'https://prod.example.com/',
    enabled: true,
});
console.log(rule.id);
```

---

### `updateRule(id, data)`

**Description:** Update an existing rule

```javascript
await updateRule(ruleId, updates);
```

**Parameters:**
- `id` (Number) - Rule ID
- `data` (Object) - Properties to update

**Returns:** `Promise<void>`

**Example:**
```javascript
await updateRule(1, {
    enabled: false,
    name: 'Updated name',
});
```

---

### `deleteRule(id)`

**Description:** Delete a rule

```javascript
await deleteRule(ruleId);
```

**Parameters:**
- `id` (Number) - Rule ID

**Returns:** `Promise<void>`

**Example:**
```javascript
await deleteRule(42);
```

---

### `toggleRule(id)`

**Description:** Toggle rule enabled/disabled state

```javascript
await toggleRule(ruleId);
```

**Parameters:**
- `id` (Number) - Rule ID

**Returns:** `Promise<void>`

**Example:**
```javascript
await toggleRule(5);
```

---

### `buildDNRRules(rules)`

**Description:** Convert user rules to DNR (Declarative Net Request) format

```javascript
const dnrRules = buildDNRRules(userRules);
```

**Parameters:**
- `rules` (Array) - Array of user rules

**Returns:** `Array` - DNR-formatted rules

**Example:**
```javascript
const dnrRules = buildDNRRules(userRules);
await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: dnrRules,
});
```

---

### `doesRuleMatchUrl(rule, url)`

**Description:** Check if a rule matches a URL

```javascript
const matches = doesRuleMatchUrl(rule, url);
```

**Parameters:**
- `rule` (Object) - Rule object
- `url` (String) - URL to test

**Returns:** `Boolean` - True if rule matches

**Example:**
```javascript
const rule = await getRules().then(rules => rules[0]);
if (doesRuleMatchUrl(rule, 'https://example.com/api')) {
    console.log('Rule matches!');
}
```

---

## 🔄 Sync Service API

### `SyncService.initialize()`

**Description:** Initialize sync service

```javascript
await SyncService.initialize();
```

**Returns:** `Promise<void>`

**Side Effects:**
- Loads sync options from storage
- Checks authentication status
- Performs initial sync if authenticated
- Starts auto-sync if enabled

---

### `SyncService.syncUp()`

**Description:** Upload local rules to Google Drive

```javascript
await SyncService.syncUp();
```

**Returns:** `Promise<void>`

**Throws:** Error if upload fails

**Example:**
```javascript
try {
    await SyncService.syncUp();
    console.log('Sync complete');
} catch (error) {
    console.error('Sync failed:', error.message);
}
```

---

### `SyncService.syncDown()`

**Description:** Download rules from Google Drive

```javascript
await SyncService.syncDown();
```

**Returns:** `Promise<void>`

**Behavior:**
- Fetches rules from Drive
- Detects conflicts with local rules
- Applies conflict resolution strategy
- Saves merged rules locally

---

### `SyncService.forceSync()`

**Description:** Force immediate sync (up and down)

```javascript
await SyncService.forceSync();
```

**Returns:** `Promise<void>`

**Example:**
```javascript
// Force sync from UI
document.getElementById('syncBtn').addEventListener('click', async () => {
    try {
        await SyncService.forceSync();
        updateSyncUI();
    } catch (error) {
        showError(error.message);
    }
});
```

---

### `SyncService.getSyncState()`

**Description:** Get current sync state

```javascript
const syncState = SyncService.getSyncState();
```

**Returns:** `Object` with properties:
- `status` (String) - 'idle', 'syncing', 'synced', 'error', 'conflict'
- `lastSyncTime` (Number) - Unix timestamp
- `lastError` (String) - Error message if status is 'error'
- `conflictCount` (Number) - Number of conflicts

**Example:**
```javascript
const state = SyncService.getSyncState();
console.log(`Last synced: ${new Date(state.lastSyncTime)}`);
```

---

### `SyncService.getSyncHistory()`

**Description:** Get sync operation history

```javascript
const history = await SyncService.getSyncHistory();
```

**Returns:** `Promise<Array>` - Array of sync history entries

**History Entry Structure:**
```javascript
{
    action: 'SYNC_UP',          // 'SYNC_UP' or 'SYNC_DOWN'
    timestamp: 1712818400000,   // Unix timestamp
    ruleCount: 15,              // Number of rules
    rulesHash: 'a1b2c3d4',      // Hash of rules
    error: null,                // Error message if failed
}
```

**Example:**
```javascript
const history = await SyncService.getSyncHistory();
history.slice(0, 10).forEach(entry => {
    console.log(`${entry.action} at ${new Date(entry.timestamp)}`);
});
```

---

### `SyncService.startAutoSync()`

**Description:** Start automatic sync timer

```javascript
SyncService.startAutoSync();
```

**Returns:** `void`

**Note:** Automatically started on initialization if enabled

---

### `SyncService.stopAutoSync()`

**Description:** Stop automatic sync timer

```javascript
SyncService.stopAutoSync();
```

**Returns:** `void`

---

### `SyncService.loadOptions()`

**Description:** Load sync options from storage

```javascript
await SyncService.loadOptions();
```

**Returns:** `Promise<void>`

**Loads:**
- `autoSync` - Enable/disable auto-sync
- `autoSyncInterval` - Sync interval in milliseconds
- `conflictStrategy` - Conflict resolution strategy
- `enableVersionHistory` - Track sync history

---

### `SyncService.saveOptions()`

**Description:** Save sync options to storage

```javascript
await SyncService.saveOptions();
```

**Returns:** `Promise<void>`

**Example:**
```javascript
SyncService.options.autoSyncInterval = 10 * 60 * 1000; // 10 minutes
await SyncService.saveOptions();
```

---

## 🔐 Google Auth API

### `GoogleAuth.login()`

**Description:** Initiate Google OAuth login flow

```javascript
await GoogleAuth.login();
```

**Returns:** `Promise<Object>` - Token object

**Side Effects:**
- Opens Google OAuth consent screen
- Stores token in chrome.storage.sync
- Notifies SyncService of login

**Example:**
```javascript
document.getElementById('loginBtn').addEventListener('click', async () => {
    try {
        await GoogleAuth.login();
        console.log('Logged in!');
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
});
```

---

### `GoogleAuth.logout()`

**Description:** Sign out from Google

```javascript
await GoogleAuth.logout();
```

**Returns:** `Promise<void>`

**Side Effects:**
- Clears token from storage
- Stops sync
- Notifies SyncService of logout

---

### `GoogleAuth.isAuthenticated()`

**Description:** Check if user is logged in

```javascript
const isAuth = await GoogleAuth.isAuthenticated();
```

**Returns:** `Promise<Boolean>` - True if authenticated

**Example:**
```javascript
if (await GoogleAuth.isAuthenticated()) {
    showSyncUI();
} else {
    showLoginUI();
}
```

---

### `GoogleAuth.getUserProfile()`

**Description:** Get logged-in user's profile

```javascript
const profile = await GoogleAuth.getUserProfile();
```

**Returns:** `Promise<Object>` - Profile with `email` and `name`

**Example:**
```javascript
const profile = await GoogleAuth.getUserProfile();
console.log(`Logged in as: ${profile.email}`);
```

---

### `GoogleAuth.getTokens()`

**Description:** Get current OAuth tokens

```javascript
const tokens = await GoogleAuth.getTokens();
```

**Returns:** `Promise<Object>` - Token object

**Note:** For internal use only. Never expose tokens in UI.

---

### `GoogleAuth.refreshToken()`

**Description:** Refresh expired access token

```javascript
await GoogleAuth.refreshToken();
```

**Returns:** `Promise<Object>` - New token

**Note:** Automatically called when token expires

---

## 🚀 Storage API

### `chrome.storage.sync.get(keys, callback)`

**Description:** Retrieve data from synced storage

```javascript
chrome.storage.sync.get(['rules', 'settings'], (data) => {
    console.log(data.rules);
});
```

**Parameters:**
- `keys` (String|Array|Object) - Keys to retrieve
- `callback` (Function) - Callback with results

---

### `chrome.storage.sync.set(data, callback)`

**Description:** Save data to synced storage

```javascript
chrome.storage.sync.set({ rules: [...] }, () => {
    console.log('Saved');
});
```

**Parameters:**
- `data` (Object) - Key-value pairs to save
- `callback` (Function) - Callback when complete

---

### `Storage.getRules()` (Abstraction Layer)

**Description:** Get rules (abstraction)

```javascript
const rules = await Storage.getRules();
```

**Returns:** `Promise<Array>`

---

### `Storage.saveRules(rules)` (Abstraction Layer)

**Description:** Save rules (abstraction)

```javascript
await Storage.saveRules(rules);
```

**Returns:** `Promise<void>`

---

## 📨 Message API

### Message Format

```javascript
chrome.runtime.sendMessage({
    type: 'MESSAGE_TYPE',
    ...otherData
}, (response) => {
    // Handle response
});
```

### Available Messages

#### GET_RULES
```javascript
chrome.runtime.sendMessage({ type: 'GET_RULES' }, (response) => {
    console.log(response.rules);
});
```

#### SET_RULES
```javascript
chrome.runtime.sendMessage({
    type: 'SET_RULES',
    rules: [...]
}, (response) => {
    console.log('Saved:', response.success);
});
```

#### GET_SYNC_STATE
```javascript
chrome.runtime.sendMessage({ type: 'GET_SYNC_STATE' }, (response) => {
    console.log(response.syncState);
});
```

#### FORCE_SYNC
```javascript
chrome.runtime.sendMessage({ type: 'FORCE_SYNC' }, (response) => {
    if (response.success) console.log('Synced');
});
```

#### GET_SYNC_HISTORY
```javascript
chrome.runtime.sendMessage({ type: 'GET_SYNC_HISTORY' }, (response) => {
    console.log(response.history);
});
```

#### UPDATE_SYNC_OPTIONS
```javascript
chrome.runtime.sendMessage({
    type: 'UPDATE_SYNC_OPTIONS',
    options: { autoSync: false }
}, (response) => {
    console.log('Updated:', response.success);
});
```

---

## 🎯 Rule Object Structure

```javascript
{
    id: 1,                              // Unique identifier
    type: 'redirect',                   // redirect|block|replace|headers|response
    name: 'My Rule',                    // Display name
    sourcePattern: '*://example.com/*', // URL pattern
    destination: 'https://prod.com/',   // For redirect
    findText: 'old',                    // For replace
    replaceText: 'new',                 // For replace
    headersAdd: {},                     // Headers to add
    headersRemove: [],                  // Headers to remove
    headersModify: {},                  // Headers to modify
    responseStatus: 200,                // For response
    responseBody: '{}',                 // For response
    enabled: true,                      // Active or not
    pinned: false,                      // Pinned to popup
    createdAt: 1234567890,              // Creation timestamp
    updatedAt: 1234567890,              // Last update timestamp
}
```

---

## 🔗 Events

### SYNC_STATE_CHANGED

Broadcast when sync state changes

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SYNC_STATE_CHANGED') {
        console.log('Sync state:', message.syncState);
    }
});
```

---

## 🔄 Conflict Resolution Strategies

```javascript
// LOCAL_WINS - Keep local rules
SyncService.options.conflictStrategy = 'local';

// REMOTE_WINS - Use Drive rules
SyncService.options.conflictStrategy = 'remote';

// MERGE - Intelligently combine
SyncService.options.conflictStrategy = 'merge';

// MANUAL - Ask user
SyncService.options.conflictStrategy = 'manual';
```

---

## 📊 Rule Types

### Redirect
Redirect requests to different URL

```javascript
{
    type: 'redirect',
    sourcePattern: '*://staging.example.com/*',
    destination: 'https://prod.example.com/$1',
}
```

### Block
Block matching requests

```javascript
{
    type: 'block',
    sourcePattern: '*://ads.example.com/*',
}
```

### Replace
Find and replace in URL

```javascript
{
    type: 'replace',
    sourcePattern: '*://*.example.com/*',
    findText: 'staging',
    replaceText: 'prod',
}
```

### Headers
Add, remove, or modify headers

```javascript
{
    type: 'headers',
    sourcePattern: '*://api.example.com/*',
    headersAdd: { 'X-Custom': 'value' },
    headersRemove: ['Cookie'],
    headersModify: { 'User-Agent': 'Custom' },
}
```

### Response
Mock API responses

```javascript
{
    type: 'response',
    sourcePattern: '*://api.example.com/data',
    responseStatus: 200,
    responseBody: { message: 'mocked' },
}
```

---

## 🚨 Error Handling

### Common Errors

**NotAuthenticated**
```
Error: Not authenticated
// User must login first
```

**TokenExpired**
```
Error: Token refresh failed
// Automatically retried, user may need to re-login
```

**NetworkError**
```
Error: Failed to download rules
// Check internet connection and retry
```

**ConflictDetected**
```
Status: CONFLICT
// Apply chosen conflict resolution strategy
```

---

## ✅ Examples

### Complete Sync Example

```javascript
async function performSync() {
    try {
        // Check auth
        const isAuth = await GoogleAuth.isAuthenticated();
        if (!isAuth) {
            await GoogleAuth.login();
        }

        // Get current state
        const before = SyncService.getSyncState();
        console.log('Before:', before.status);

        // Force sync
        await SyncService.forceSync();

        // Get new state
        const after = SyncService.getSyncState();
        console.log('After:', after.status);

        // Get history
        const history = await SyncService.getSyncHistory();
        console.log('Last sync:', history[0]);
    } catch (error) {
        console.error('Sync failed:', error);
    }
}
```

### Create and Sync Rule

```javascript
async function createAndSync(ruleData) {
    // Create rule
    const rule = await addRule(ruleData);
    console.log('Created rule:', rule.id);

    // Force sync
    if (await GoogleAuth.isAuthenticated()) {
        await SyncService.forceSync();
        console.log('Synced to Drive');
    }
}
```

---

**Last Updated:** 2026-04-10  
**Status:** Complete
