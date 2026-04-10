# Google OAuth 2.0 Setup Guide
**For Requestly Chrome Extension**

This guide explains how to set up Google OAuth 2.0 authentication and Google Drive sync for the Requestly extension.

---

## 📋 Prerequisites

- Google account
- Google Cloud Console project
- Extension ID (generated after first load)

---

## 🔧 Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a Project** → **New Project**
3. Name it: `Requestly` (or your preference)
4. Click **Create**

---

## 🔑 Step 2: Enable Required APIs

In your Google Cloud project:

1. Navigate to **APIs & Services** → **Library**
2. Search for and enable these APIs:
   - **Google Drive API** - For storing/syncing rules
   - **Google Identity Services** - For authentication

### To enable:
- Search API name in library
- Click the result
- Click **Enable**

---

## 🎯 Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (unless you have a Google Workspace account)
3. Click **Create**
4. Fill in required fields:
   - **App name:** `Requestly`
   - **User support email:** Your email
   - **Developer contact:** Your email
5. Click **Save and Continue**
6. Add **Scopes:** (Click **Add or Remove Scopes**)
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/userinfo.email`
7. Click **Update**
8. Click **Save and Continue** → **Back to Dashboard**

---

## 📝 Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Select **Chrome Extension** as application type
4. For now, leave **URIs** blank (we'll update after getting extension ID)
5. Click **Create**

You'll get a **Client ID** - copy this!

---

## 🔗 Step 5: Get Your Extension ID

1. In Chrome, go to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Load your extension as unpacked folder (select the `requestly/` directory)
4. Copy the **ID** shown for the extension

---

## ✏️ Step 6: Update OAuth Credentials URI

1. Back to [Google Cloud Console](https://console.cloud.google.com/)
2. Go to **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 Client ID and click **Edit**
4. Under **Authorized redirect URIs**, add:
   ```
   https://[YOUR_EXTENSION_ID].chromiumapp.org/
   ```
   Replace `[YOUR_EXTENSION_ID]` with your actual extension ID from Step 5
5. Click **Save**

---

## 🔌 Step 7: Configure Extension

### Option A: Direct Update (Development)

1. Open `manifest.json` in your editor
2. Find the `oauth2` section:
   ```json
   "oauth2": {
       "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com"
   }
   ```
3. Replace `YOUR_CLIENT_ID` with your actual Client ID from Step 5
4. Save the file

### Option B: Environment Variable (Production)

Create a `.env.local` file in the root directory:
```
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

Then update `src/services/google.js`:
```javascript
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_HERE';
```

---

## 🧪 Step 8: Test the Extension

1. Reload the extension in `chrome://extensions/`
2. Go to extension Options page
3. You should see **Sign in with Google** button in the sidebar
4. Click it and follow Google's OAuth flow
5. After successful login:
   - Button changes to **Sign out**
   - User email is displayed
   - Sync status shows "Synced"

---

## 📦 Using Google Drive Sync

Once authenticated, the extension can:

### Save Rules to Drive
```javascript
import { GoogleDrive } from './services/google.js';

const rules = await getRules();
await GoogleDrive.uploadRules(rules);
```

### Download Rules from Drive
```javascript
const rules = await GoogleDrive.downloadRules();
if (rules) {
    await saveRules(rules);
}
```

---

## 🛡️ Security Best Practices

### Token Storage
- **Never** store tokens in local storage unencrypted
- **Always** use `chrome.storage.sync` (encrypted by browser)
- Tokens are automatically revoked on logout

### Scope Limitations
- We request only `drive.file` scope (not full Drive access)
- Extension can only access files it creates
- User can revoke permissions anytime in Google Account settings

### Client Secret
⚠️ **Never** hardcode client secret in the extension!
- Client secret should only exist on backend server
- For now, token exchange happens client-side (acceptable for extension)
- For production, implement server-side token exchange

---

## 🐛 Troubleshooting

### "Login popup closes immediately"
- Check that redirect URI in Google Cloud matches extension ID
- Verify extension ID in `chrome://extensions/`

### "Invalid Client ID"
- Verify Client ID format: `XXXXXXX.apps.googleusercontent.com`
- Check it's the same in manifest.json and Google Cloud Console

### "Insufficient permissions"
- Make sure both OAuth consent screen scopes are added
- Re-authenticate to request new permissions

### "Sync failed / Network error"
- Check internet connection
- Verify Google Drive API is enabled in Cloud Console
- Check browser console for detailed error messages

---

## 📚 Environment-Specific Configs

### Development
```json
{
  "client_id": "dev-xxx.apps.googleusercontent.com",
  "redirect_uri": "chrome-extension://abc123xyz/"
}
```

### Testing
```json
{
  "client_id": "test-xxx.apps.googleusercontent.com",
  "redirect_uri": "chrome-extension://def456uvw/"
}
```

### Production
```json
{
  "client_id": "prod-xxx.apps.googleusercontent.com",
  "redirect_uri": "chrome-extension://ghi789rst/"
}
```

---

## 🔄 Refreshing Tokens

The extension automatically refreshes tokens when they expire:

```javascript
// Automatic (happens in background)
const profile = await GoogleAuth.getUserProfile(); // Refreshes if needed

// Manual refresh
const newTokens = await GoogleAuth.refreshToken();
```

---

## 🚀 Next Steps

1. ✅ Configure Google OAuth (this guide)
2. ⏳ Implement Google Drive sync service
3. ⏳ Add sync scheduling (automatic backup)
4. ⏳ Implement conflict resolution (merge strategies)

---

## 📞 Support

For issues with Google OAuth:
- Check [Google OAuth docs](https://developers.google.com/identity/protocols/oauth2)
- Review Chrome Extension [identity API docs](https://developer.chrome.com/docs/extensions/reference/identity/)
- Check browser console for detailed error messages

For issues with the extension:
- Check `chrome://extensions/` for errors
- Review background service worker logs in DevTools

---

**Last Updated:** 2026-04-10
