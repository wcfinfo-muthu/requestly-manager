# Troubleshooting Guide

**Date:** 2026-04-10

---

## 🔍 Common Issues & Solutions

### Extension Not Working

**Problem:** Rules aren't being applied to web requests

**Solutions:**
1. ✅ Check extension is enabled
   - Click extension icon
   - Look for green "Extension Enabled" toggle
   - Toggle it OFF then ON

2. ✅ Verify rule is enabled
   - Open Options
   - Check checkbox next to rule is enabled
   - Rule row should not be grayed out

3. ✅ Reload pages
   - Press Ctrl+Shift+R (hard refresh)
   - Close and reopen tab

4. ✅ Check pattern matches URL
   - Pattern: `*://example.com/*`
   - URL: `https://example.com/api`
   - Should match ✓

5. ✅ Verify rule type is correct
   - Redirect → Changes URL
   - Block → Prevents request
   - Replace → Modifies content
   - Headers → Changes headers
   - Response → Mocks API

---

### Rules Not Saving

**Problem:** Changes lost after refresh or restart

**Solutions:**
1. ✅ Check storage is available
   - Open DevTools (F12)
   - Application → Storage → Chrome storage
   - Verify rules are there

2. ✅ Try localStorage fallback
   - DevTools Console:
   ```javascript
   localStorage.getItem('requestly_rules_fallback')
   ```
   - If nothing, data is being stored

3. ✅ Ensure extensions have storage permission
   - chrome://extensions/
   - Click "Details" on Requestly
   - Check "Storage" permission exists

4. ✅ Clear corrupted storage
   ```javascript
   // In DevTools Console:
   chrome.storage.sync.clear();
   location.reload();
   ```

---

### Google Sign-In Failed

**Problem:** Cannot log in with Google account

**Solutions:**
1. ✅ Verify OAuth credentials
   - manifest.json should have:
   ```json
   "oauth2": {
       "client_id": "YOUR_ID.apps.googleusercontent.com"
   }
   ```
   - If shows "YOUR_ID", update with real credentials

2. ✅ Check Google Cloud project
   - Go to Google Cloud Console
   - Verify project exists
   - Verify APIs enabled:
     - Google Drive API ✓
     - Google+ API ✓

3. ✅ Verify OAuth consent screen
   - Google Cloud Console → OAuth consent screen
   - Should be in "External" mode (or Internal)
   - Requestly should be listed as test app

4. ✅ Check scopes match
   - manifest.json should have:
   ```json
   "scopes": [
       "https://www.googleapis.com/auth/drive.file",
       "https://www.googleapis.com/auth/userinfo.email"
   ]
   ```

5. ✅ Clear cached credentials
   - Sign out completely
   - Clear Chrome cache
   - Try again

---

### Sync Not Working

**Problem:** Rules not syncing to Google Drive

**Solutions:**
1. ✅ Verify you're logged in
   - Open Options page
   - Should show your email and "Sync Now" button
   - If not, sign in first

2. ✅ Check internet connection
   - Verify you have active internet
   - Try accessing Google Drive directly

3. ✅ Check Drive permissions
   - Go to Google Account → Connected apps & sites
   - Find "Requestly"
   - Verify permission granted
   - If not, remove and re-authorize

4. ✅ Try manual sync
   - Click "Sync Now" button
   - Wait for status to change to "Synced" (green)
   - Check Sync History page

5. ✅ Check sync interval
   - Settings page → Auto-sync interval
   - Default is 5 minutes
   - Can take up to interval time for auto-sync

6. ✅ View sync errors
   - Go to Sync History page
   - Look for red error badges
   - Error message shows what went wrong

---

### Sync Conflict

**Problem:** Local and Drive rules differ

**Solutions:**
1. ✅ Choose conflict resolution strategy
   - Settings page → Conflict Resolution
   - Options:
     - **Merge** (default) - Combine both
     - **Local Wins** - Keep local only
     - **Remote Wins** - Use Drive rules
     - **Manual** - Ask each time

2. ✅ Manual conflict resolution
   - If using "Manual" strategy
   - Click "Sync Now" when conflict occurs
   - Review conflicting rules
   - Choose which version to keep

3. ✅ View what changed
   - Sync History page
   - Shows each sync operation
   - Rule count changed

4. ✅ Undo problematic sync
   - Change strategy to "Local Wins"
   - Click "Sync Now"
   - Reverts to local version

---

### Sync Status Shows Error

**Problem:** Last sync failed with error message

**Solutions:**
1. ✅ Check error message
   - Click sync status indicator
   - Read error message
   - Common errors:
     - "Token expired" → Sign out and back in
     - "Network error" → Check internet
     - "Permission denied" → Re-authorize Google

2. ✅ Retry sync
   - Click "Sync Now" button
   - Automatically retries with backoff
   - Should succeed on retry

3. ✅ Check sync history for details
   - Sync History page
   - Look for recent failed entries
   - Click to see full error

4. ✅ Sign out and back in
   - Settings → Sign out
   - Wait a few seconds
   - Sign in again
   - Retry sync

---

### Rules Not Matching URLs

**Problem:** Rule isn't triggering for matching URLs

**Solutions:**
1. ✅ Check pattern syntax
   - Wildcard: `*://example.com/*`
   - Exact: `example.com`
   - Regex: `/^https:\/\/api\.example\.com\/.*/`

2. ✅ Test pattern
   - Create simple test rule
   - Pattern: your URL
   - Visit that URL
   - Should trigger

3. ✅ Verify rule is enabled
   - Rule should have checkmark
   - Row should not be grayed out

4. ✅ Check for port numbers
   - If URL has port: `example.com:8080`
   - Pattern should include: `*://example.com:8080/*`

5. ✅ Case sensitivity
   - Patterns are case-sensitive
   - `Example.com` ≠ `example.com`
   - Use lowercase

6. ✅ Test in DevTools
   - Open DevTools (F12)
   - Network tab
   - Make request
   - Should show in network if rule fires

---

### Headers Rule Not Working

**Problem:** Custom headers not being added/removed

**Solutions:**
1. ✅ Verify syntax
   - Header name: `X-Custom-Header`
   - Header value: `value123`
   - No special characters

2. ✅ Check header scope
   - Add Headers → Injected into request
   - Remove Headers → Stripped from request
   - Some headers can't be modified

3. ✅ Common headers
   - Cannot modify: `Host`, `Connection`, `Content-Length`
   - Can modify: `User-Agent`, `Accept`, `Custom` headers

4. ✅ Verify in DevTools
   - DevTools → Network tab
   - Click request → Headers
   - Should show custom headers

---

### Mock Response Not Working

**Problem:** API not returning mocked response

**Solutions:**
1. ✅ Check pattern matches request
   - Pattern must match exact URL
   - Example: `*://api.example.com/data`

2. ✅ Verify response format
   - Status: `200` (number)
   - Body: Valid JSON or text
   - If JSON, must be valid

3. ✅ Test with simple pattern
   - Create test rule
   - Pattern: Full URL
   - Verify it triggers

4. ✅ Check response content type
   - DevTools → Network tab
   - Response should show as text/JSON
   - Content-Type header correct

5. ✅ Verify rule type is "Mock Response"
   - Type: Must be "Mock Response"
   - Check dropdown shows correct type

---

### Export/Import Not Working

**Problem:** Cannot export or import rules

**Solutions:**
1. ✅ Export issues
   - Click "Export JSON"
   - Should download file
   - If not, check browser download settings
   - File will be named: `url-rewriter-rules-TIMESTAMP.json`

2. ✅ Import issues
   - Click "Choose File"
   - Select `.json` file
   - Wait for "Successfully imported" message
   - New rules should appear

3. ✅ Invalid JSON
   - Error: "Invalid format"
   - File must be JSON array: `[{...}, {...}]`
   - Verify JSON is valid (use online validator)

4. ✅ File permissions
   - Ensure file is readable
   - Try copying file to Downloads folder
   - Try again

---

### UI Looks Broken

**Problem:** Settings/History pages not displaying correctly

**Solutions:**
1. ✅ Refresh page
   - Press F5 or Ctrl+R
   - Wait for page to load

2. ✅ Clear cache
   - DevTools → Application → Clear storage
   - Reload page

3. ✅ Check browser zoom
   - Press Ctrl+0 to reset zoom
   - Verify text is readable

4. ✅ Check screen resolution
   - UI responsive for:
     - Mobile: 375px wide
     - Tablet: 768px wide
     - Desktop: 1024px+ wide
   - Resize window to check

5. ✅ Try different browser profile
   - Chrome → Profile → Create new profile
   - Load extension in new profile
   - If works, old profile may be corrupted

---

### Performance Issues

**Problem:** Extension slowing down browser

**Solutions:**
1. ✅ Reduce auto-sync frequency
   - Settings → Auto-sync → Increase interval
   - Change from 5 to 15 minutes
   - Reduces background activity

2. ✅ Reduce number of rules
   - Delete unused rules
   - Archive old rules
   - Keep active rules only

3. ✅ Optimize rule patterns
   - Avoid complex regex
   - Use specific patterns (not `*://*/*`)
   - Exact patterns faster than wildcards

4. ✅ Disable features not needed
   - Settings → Turn off "Version History"
   - Turn off "Auto-sync"
   - Reduces background processing

5. ✅ Check rule execution time
   - DevTools → Network tab
   - Should see < 1ms overhead
   - If higher, rule pattern may be inefficient

---

### Storage Full

**Problem:** Cannot add more rules (quota exceeded)

**Solutions:**
1. ✅ Check storage quota
   - chrome.storage.sync: ~100KB
   - Average rule: ~500 bytes
   - Maximum rules: ~200

2. ✅ Delete unnecessary rules
   - Settings → Rules page
   - Delete old/unused rules
   - Frees up space

3. ✅ Export backup then clear
   - Export rules first
   - Delete all rules
   - Re-import only needed ones
   - Ensures clean storage

4. ✅ Use localStorage fallback
   - If sync storage full
   - Extension falls back to localStorage
   - May lose sync to Drive
   - Still works locally

---

### Lost Rules

**Problem:** Rules disappeared after update/restart

**Solutions:**
1. ✅ Check sync status
   - Open Options
   - Check Sync History
   - Rules may have been synced to Drive

2. ✅ Restore from Google Drive
   - If logged in, rules may be on Drive
   - Sign in and sync down
   - Rules should reappear

3. ✅ Check backup file
   - If you exported previously
   - Open import/export page
   - Import from backup file

4. ✅ Check localStorage fallback
   - DevTools → Application → Local Storage
   - Look for `requestly_rules_fallback`
   - If empty, rules may be truly lost

5. ✅ Check recent browser history
   - DevTools → Network → XHR
   - May see rules being saved
   - Timestamp shows when

---

## 📞 Getting Help

### Before Contacting Support

1. ✅ Check this guide first
2. ✅ Review Sync History for errors
3. ✅ Clear cache and reload
4. ✅ Update to latest version
5. ✅ Try in fresh Chrome profile

### How to Report Issues

**Include:**
- Exact error message
- Steps to reproduce
- Screenshots of issue
- Browser version
- Extension version (manifest.json)
- Chrome OS or OS version
- Whether using Google Sync

### Debug Information to Collect

```javascript
// In DevTools Console:
chrome.storage.sync.get(null, (data) => {
    console.log('Storage:', data);
});

chrome.runtime.sendMessage({type: 'GET_RULES'}, console.log);
chrome.runtime.sendMessage({type: 'GET_SYNC_STATE'}, console.log);
```

---

## 🆘 Emergency Procedures

### Factory Reset

**Warning:** Deletes all rules and settings

```javascript
// In DevTools Console:
chrome.storage.sync.clear();
localStorage.clear();
location.reload();
```

### Restore from Drive

```javascript
// Assumes you've synced before
// 1. Sign in with Google
// 2. Settings → Conflict Resolution: "Remote Wins"
// 3. Click "Sync Now"
// 4. Rules restore from Drive
```

### Manual Rule Restoration

1. Go to Google Drive (drive.google.com)
2. Look for "Requestly Rules"
3. Download rules.json
4. Open Options → Import/Export
5. Click "Import"
6. Select downloaded file

---

## 📊 Health Check

Run this to verify extension is healthy:

```javascript
// In DevTools Console:
async function healthCheck() {
    console.log('=== Requestly Health Check ===');
    
    // Check extension
    chrome.runtime.sendMessage({type: 'GET_RULES'}, (res) => {
        console.log('✓ Extension running:', !!res);
        console.log('  Rules count:', res.rules?.length || 0);
    });
    
    // Check storage
    chrome.storage.sync.get(null, (data) => {
        console.log('✓ Storage available:', !!data);
        console.log('  Storage keys:', Object.keys(data).length);
    });
    
    // Check sync
    chrome.runtime.sendMessage({type: 'GET_SYNC_STATE'}, (res) => {
        console.log('✓ Sync available:', !!res);
        console.log('  Status:', res.syncState?.status || 'N/A');
    });
}

healthCheck();
```

---

**Last Updated:** 2026-04-10  
**Status:** Complete
