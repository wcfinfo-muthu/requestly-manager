# Google Drive Sync Service - Implementation Guide
**Date:** 2026-04-10  
**Status:** Fully Implemented

---

## 📋 Overview

The Google Drive Sync Service automatically synchronizes Requestly rules between local storage and Google Drive, enabling:
- Cloud backup of all rules
- Multi-device rule synchronization
- Conflict detection and resolution
- Version history tracking
- Automatic periodic sync
- Manual sync triggers

---

## 🏗️ Architecture

### Service Files
```
src/services/
├── google.js        # OAuth authentication + Drive API
├── sync.js          # Sync orchestration & conflict resolution
└── storage.js       # Storage abstraction layer
```

### Background Integration
```
src/background/
└── service-worker.js  # Initializes and manages SyncService
```

### UI Integration
```
src/ui/
├── options.html     # Sync status UI + controls
├── options.js       # Sync event handlers
└── options.css      # Sync UI styling
```

---

## 🔄 Sync Flow

### Initialization
```
Extension Start
    ↓
Background Service Worker
    ↓
Initialize SyncService
    ↓
Check Authentication
    ├─ If Authenticated → Sync Down
    └─ If Not Authenticated → Wait for Login
    ↓
Start Auto-Sync Timer (if enabled)
```

### User Login Flow
```
User Clicks "Sign in with Google"
    ↓
GoogleAuth.login()
    ↓
OAuth 2.0 Flow (Google)
    ↓
Store Token
    ↓
Notify SyncService: SYNC_USER_LOGIN
    ↓
SyncService.onUserLogin()
    ↓
Sync Down (download Drive rules)
    ↓
Start Auto-Sync
```

### Sync Down (Cloud → Local)
```
Get Rules from Google Drive
    ↓
Get Local Rules
    ↓
Detect Conflicts
    ├─ No Conflicts → Use Drive Rules
    ├─ Conflicts Detected → Resolve per Strategy
    │   ├─ LOCAL_WINS → Keep Local
    │   ├─ REMOTE_WINS → Use Drive
    │   ├─ MERGE → Merge Both
    │   └─ MANUAL → Ask User
    └─ Resolved Rules
    ↓
Save Merged Rules Locally
    ↓
Track Version
    ↓
Update Sync Status: SYNCED
```

### Sync Up (Local → Cloud)
```
Get Local Rules
    ↓
Upload to Google Drive
    ↓
Track Version
    ↓
Update Sync Status: SYNCED
```

### Auto-Sync Cycle
```
Timer (every 5 minutes)
    ↓
Check Authentication
    ├─ If Authenticated → Sync Up
    └─ If Not → Skip
    ↓
Repeat
```

---

## 📊 Conflict Resolution

### Detection
Conflicts are detected when:
1. **MODIFIED** - Rule exists in both places but differs
2. **DELETED_IN_DRIVE** - Rule in local but not on Drive
3. **NEW_IN_DRIVE** - Rule on Drive but not locally

### Resolution Strategies

#### 1. LOCAL_WINS (Keep Local)
```javascript
// Uses all local rules, ignores Drive completely
SyncService.options.conflictStrategy = 'local';
```
**Use Case:** User wants to maintain local state

#### 2. REMOTE_WINS (Use Drive)
```javascript
// Replaces local rules with Drive rules
SyncService.options.conflictStrategy = 'remote';
```
**Use Case:** User wants Drive to be authoritative

#### 3. MERGE (Combine Both)
```javascript
// Default strategy - intelligently merges rules
SyncService.options.conflictStrategy = 'merge';
```
**Merge Logic:**
- Start with local rules
- Add Drive rules not in local
- For modified rules: prefer newer by timestamp

**Use Case:** Default - avoid data loss

#### 4. MANUAL (Ask User)
```javascript
// Pauses sync, requires user action
SyncService.options.conflictStrategy = 'manual';
```
**Use Case:** User wants full control

---

## ⚙️ Configuration

### Auto-Sync Settings
```javascript
SyncService.options = {
  // Enable/disable automatic syncing
  autoSync: true,
  
  // Interval between sync cycles (milliseconds)
  autoSyncInterval: 5 * 60 * 1000,  // 5 minutes
  
  // Conflict resolution strategy
  conflictStrategy: 'merge',
  
  // Track version history
  enableVersionHistory: true,
};
```

### Updating Options
```javascript
// From any tab
chrome.runtime.sendMessage({
  type: 'UPDATE_SYNC_OPTIONS',
  options: {
    autoSyncInterval: 10 * 60 * 1000,  // 10 minutes
    conflictStrategy: 'remote',
  }
});
```

---

## 📡 Message Protocol

### From UI to Background

#### Get Sync State
```javascript
chrome.runtime.sendMessage({ type: 'GET_SYNC_STATE' })
  .then(response => {
    console.log(response.syncState);
    // {
    //   status: 'synced',
    //   lastSyncTime: Date,
    //   lastError: null,
    //   conflictCount: 0
    // }
  });
```

#### Force Sync
```javascript
chrome.runtime.sendMessage({ type: 'FORCE_SYNC' })
  .then(response => {
    if (response.success) {
      console.log('Sync completed');
    }
  });
```

#### Get Sync History
```javascript
chrome.runtime.sendMessage({ type: 'GET_SYNC_HISTORY' })
  .then(response => {
    console.log(response.history);
    // Array of sync events with timestamps
  });
```

#### Update Sync Options
```javascript
chrome.runtime.sendMessage({
  type: 'UPDATE_SYNC_OPTIONS',
  options: { autoSync: false }
})
  .then(response => {
    if (response.success) {
      console.log('Options updated');
    }
  });
```

### From Background to UI

#### Sync State Changed
```javascript
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SYNC_STATE_CHANGED') {
    console.log('New sync state:', message.syncState);
    updateUI();
  }
});
```

---

## 🔍 Sync Status States

| Status | Meaning | Duration |
|--------|---------|----------|
| **IDLE** | No sync in progress | - |
| **SYNCING** | Sync operation running | Variable |
| **SYNCED** | Last sync succeeded | Until next change |
| **ERROR** | Last sync failed | Until retry |
| **CONFLICT** | Conflict detected (manual strategy) | Until resolved |

### Status Transitions
```
IDLE → SYNCING → SYNCED → IDLE
    ↓        ↓
    └──────→ ERROR (retry after delay)
    
Manual: IDLE → SYNCING → CONFLICT (awaits user input)
```

---

## 📊 Version History

### Tracking
Every sync operation is recorded:
```javascript
{
  action: 'SYNC_UP',           // or SYNC_DOWN
  timestamp: 1712818400000,    // Unix timestamp
  ruleCount: 15,               // Number of rules synced
  rulesHash: 'a1b2c3d4',      // Simple hash of rules
}
```

### Accessing History
```javascript
const history = await SyncService.getSyncHistory();
// Returns array of last 100 sync events
// Sorted chronologically

// Example output:
[
  {
    action: 'SYNC_UP',
    timestamp: 1712818400000,
    ruleCount: 15,
    rulesHash: 'a1b2c3d4'
  },
  {
    action: 'SYNC_DOWN',
    timestamp: 1712818350000,
    ruleCount: 14,
    rulesHash: 'e5f6g7h8'
  },
  // ...
]
```

### Cleanup
- Last 100 events are retained
- Older events automatically purged
- Hash enables quick change detection

---

## 🚀 Usage Examples

### Basic Setup
```javascript
// Sync service initializes automatically on startup
// For authenticated users, syncing starts immediately

// User logs in → Sync Down → Start Auto-Sync
// User logs out → Stop Auto-Sync
```

### Manual Sync
```javascript
// User clicks "Sync Now" button
const response = await chrome.runtime.sendMessage({ type: 'FORCE_SYNC' });
if (response.success) {
  console.log('Rules synced with Drive');
} else {
  console.error('Sync failed:', response.error);
}
```

### Check Sync Status
```javascript
const response = await chrome.runtime.sendMessage({ type: 'GET_SYNC_STATE' });
const { status, lastSyncTime, lastError } = response.syncState;

if (status === 'synced') {
  console.log(`Last synced at: ${lastSyncTime}`);
} else if (status === 'error') {
  console.error(`Sync error: ${lastError}`);
}
```

### Configure Auto-Sync
```javascript
// Disable auto-sync (manual only)
await chrome.runtime.sendMessage({
  type: 'UPDATE_SYNC_OPTIONS',
  options: { autoSync: false }
});

// Change sync interval to 10 minutes
await chrome.runtime.sendMessage({
  type: 'UPDATE_SYNC_OPTIONS',
  options: { autoSyncInterval: 600000 }
});

// Use LOCAL_WINS strategy
await chrome.runtime.sendMessage({
  type: 'UPDATE_SYNC_OPTIONS',
  options: { conflictStrategy: 'local' }
});
```

---

## 🐛 Error Handling

### Common Errors

#### Not Authenticated
```
Error: Not authenticated
```
**Cause:** User not logged in  
**Fix:** Show login button, ask user to sign in

#### Token Expired
```
Error: Token refresh failed
```
**Cause:** Refresh token invalid  
**Fix:** Clear tokens, ask user to login again

#### Network Error
```
Error: Failed to upload/download
```
**Cause:** No internet or API error  
**Fix:** Retry with exponential backoff, show error message

#### Conflict Detected
```
Status: CONFLICT
```
**Cause:** Rules differ between local and Drive  
**Fix:** Apply resolution strategy or ask user

### Retry Logic
```javascript
// Automatic retries with exponential backoff
// Retry delays: 1s, 2s, 4s, 8s, 16s
// Max retries: 5
// Then manual intervention required
```

---

## 📈 Performance Considerations

### Bandwidth Optimization
- Rules JSON is typically 10-50KB
- Upload/download: ~100-500ms on typical connection
- Version hashing: <1ms per sync

### Sync Interval
- Default: 5 minutes
- Adjustable: 1 minute to 60 minutes
- Too frequent = more network/battery usage
- Too infrequent = stale data risk

### Storage Limits
```javascript
// Chrome storage.sync limit: ~100KB
// Average rule: ~500 bytes
// Max rules: ~200 per user
// For larger sets, implement pagination
```

---

## 🔐 Security Notes

### Data Protection
- Tokens stored in encrypted chrome.storage.sync
- Drive files stored in appDataFolder (isolated per user)
- No passwords or sensitive data in rules

### Access Control
- Limited scope: drive.file (only files extension creates)
- User can revoke at any time in Google Account settings
- No access to other user's files

### Version Control
- Hash enables integrity checking
- Timestamps provide audit trail
- History preserved for 100 syncs

---

## 🧪 Testing Sync

### Test Cases

#### Test 1: Basic Sync
```
1. Create a rule locally
2. Wait for auto-sync (5 min)
3. Check Google Drive
4. Verify rule exists in rules.json
```

#### Test 2: Conflict Resolution
```
1. Create rule A locally
2. Login with MERGE strategy
3. Create rule B on Drive (separately)
4. Trigger sync
5. Verify both rules exist locally
```

#### Test 3: Multi-Device
```
1. Add rule on Device A
2. Wait for sync
3. Login on Device B
4. Verify rule appears on Device B
```

#### Test 4: Offline Fallback
```
1. Edit rules offline
2. Reconnect internet
3. Trigger sync
4. Verify changes uploaded
```

---

## 📚 API Reference

### SyncService Methods
```javascript
// Initialization
SyncService.initialize()         // Initialize and start sync
SyncService.onUserLogin()        // Called when user logs in
SyncService.onUserLogout()       // Called when user logs out

// Sync Operations
SyncService.syncUp()             // Upload local rules to Drive
SyncService.syncDown()           // Download rules from Drive
SyncService.forceSync()          // Force both up and down

// Configuration
SyncService.loadOptions()        // Load options from storage
SyncService.saveOptions()        // Save options to storage

// State Management
SyncService.getSyncState()       // Get current sync state
SyncService.updateSyncState()    // Update and broadcast state

// History
SyncService.getSyncHistory()     // Get version history
SyncService.trackVersion()       // Record sync event

// Controls
SyncService.startAutoSync()      // Start auto-sync timer
SyncService.stopAutoSync()       // Stop auto-sync timer

// Utilities
SyncService.getRules()           // Get local rules
SyncService.saveRules()          // Save local rules
SyncService.detectConflict()     // Detect conflicts
SyncService.mergeRules()         // Merge rule sets
```

---

## 🎯 Future Enhancements

- [ ] Selective sync (sync only specific rules)
- [ ] Sync scheduling (time-based auto-sync)
- [ ] Bandwidth throttling (rate limiting)
- [ ] Rule tagging for easier management
- [ ] Team sync (shared Drive folders)
- [ ] Sync preview (show what will change)
- [ ] Delta sync (only sync changes)
- [ ] Encrypted cloud backup
- [ ] Offline queue (queue changes when offline)

---

**Last Updated:** 2026-04-10  
**Status:** Production Ready
