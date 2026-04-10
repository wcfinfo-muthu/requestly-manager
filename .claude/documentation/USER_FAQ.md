# User FAQ - Frequently Asked Questions

**Date:** 2026-04-10

---

## 📌 Getting Started

### Q: What is Requestly?
**A:** Requestly is a Chrome Extension that lets you control and modify web requests without writing code. You can redirect URLs, block requests, modify headers, replace content, and mock API responses.

### Q: How do I install Requestly?
**A:** 
1. Open Chrome
2. Go to chrome://extensions/
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the Requestly folder

### Q: Is Requestly free?
**A:** Yes, Requestly is completely free and open source.

### Q: What browsers does it support?
**A:** Currently Chrome and Chromium-based browsers (Edge, Brave, etc.). Firefox version planned for future.

### Q: Do I need to be a developer to use it?
**A:** No! The UI is designed for non-technical users. Just enter URL patterns and actions.

---

## 🎯 Rules

### Q: What's the difference between rule types?
**A:**
- **Redirect** - Changes the request URL
- **Block** - Stops the request entirely
- **Replace** - Finds and replaces text in URLs
- **Headers** - Adds, removes, or modifies HTTP headers
- **Mock Response** - Returns a fake API response

### Q: How do I create a rule?
**A:**
1. Open Options page
2. Click "+ New Rule"
3. Fill in:
   - Name (what to call it)
   - Type (what to do)
   - Pattern (which URLs to match)
   - Action (where/what to change)
4. Click "Save Rule"

### Q: What's a "URL Pattern"?
**A:** A pattern that matches URLs you want to apply a rule to:
- **Exact:** `example.com` (contains)
- **Wildcard:** `*://example.com/*` (start with anything, ends with anything)
- **Regex:** `/^https:\/\/[a-z]+\.example\.com\/.*/` (advanced pattern matching)

### Q: Can I disable a rule temporarily?
**A:** Yes! Click the checkbox next to the rule. Unchecked = disabled.

### Q: How many rules can I have?
**A:** You can have up to ~200 rules (limited by Chrome storage: ~100KB for all data).

### Q: Can I organize rules?
**A:** You can pin 5 favorite rules to the top. Use search to filter rules.

### Q: What if two rules match the same URL?
**A:** Rules are applied in order. First matching rule wins.

### Q: Can I undo rule changes?
**A:** You can delete and recreate a rule, or use import/export to restore from backup.

---

## 🔍 URL Patterns

### Q: How do I match a specific domain?
**A:**
```
Exact match:      example.com
HTTPS only:       https://example.com/*
Any protocol:     *://example.com/*
Any subdomain:    *://*.example.com/*
```

### Q: How do I match paths?
**A:**
```
/api/users        (exact)
/api/*            (any path under /api)
/*                (any path)
/api/*/details    (match and capture middle part)
```

### Q: What's a wildcard `*`?
**A:** It matches any text (0 or more characters). You can use multiple `*` in one pattern.

### Q: How do I use regex?
**A:** Wrap pattern in `/`:
```
/^https:\/\/(api|dev)\.example\.com\/.*/
```
Use `$1`, `$2` to refer to captured groups in destination.

### Q: Can I match query strings?
**A:** Yes: `*://example.com/api?token=*`

### Q: How do I test if my pattern matches?
**A:** 
1. Create rule with pattern
2. Visit a URL
3. Check if rule applied
4. If not, adjust pattern
5. Reload page and try again

---

## 📤 Redirect Rules

### Q: How do I redirect to a different domain?
**A:**
```
Name:        "Redirect staging"
Type:        Redirect
Pattern:     *://staging.example.com/*
Destination: https://prod.example.com/
```

### Q: Can I redirect to a different path?
**A:** Yes:
```
Pattern:     *://example.com/old/*
Destination: https://example.com/new/
```

### Q: What's `$1`, `$2` in destination?
**A:** Capture groups from the pattern:
```
Pattern:     *://staging-$1.example.com/api/$2
             (matches anything, captures as $1, anything, captures as $2)

Destination: https://prod.example.com/api/$1/$2
             (substitutes captures back)
```

### Q: Can I redirect only certain paths?
**A:** Yes:
```
Pattern:     *://example.com/old-api/*
Destination: https://example.com/v2/
```

---

## 🚫 Block Rules

### Q: How do I block a domain?
**A:**
```
Type:     Block
Pattern:  *://ads.example.com/*
```

### Q: What happens when I block a request?
**A:** The request never reaches the server. Page continues normally.

### Q: Can I block only certain types of requests?
**A:** Currently blocks all matching requests. Content blocking comes in future update.

### Q: How do I whitelist exceptions to a block?
**A:** Create a redirect rule with higher priority (appears before block rule).

---

## 🔄 Replace Rules

### Q: How do I replace text in a URL?
**A:**
```
Type:         Replace
Pattern:      *://example.com/*
Find Text:    staging
Replace Text: prod
```

### Q: Can I use regex in replace?
**A:** Yes:
```
Find Text:    /(staging|dev)/
Replace Text: prod
```

### Q: What's the difference between find and pattern?
**A:**
- **Pattern** - Which URLs to apply rule to
- **Find** - What text to find in matching URLs

### Q: Can I replace in request body?
**A:** Yes, replacement works on URLs and request bodies.

---

## 📋 Header Rules

### Q: How do I add a custom header?
**A:**
```
Type:         Headers
Pattern:      *://api.example.com/*
Headers Add:  X-Custom: MyValue
```

### Q: Which headers can I modify?
**A:** Most custom headers. These can't be modified:
- Host
- Connection
- Content-Length
- Some security headers

### Q: How do I remove a header?
**A:**
```
Headers Remove: Cookie
                Cache-Control
```

### Q: Can I modify User-Agent?
**A:** Yes:
```
Headers Modify: User-Agent: Custom-Bot/1.0
```

### Q: Do headers affect all requests?
**A:** Yes, to matching URLs. Both requests and responses.

---

## 🎭 Mock Response Rules

### Q: How do I mock an API response?
**A:**
```
Type:            Mock Response
Pattern:         *://api.example.com/data
Response Status: 200
Response Body:   {"message": "mocked"}
```

### Q: What status codes can I use?
**A:** Any HTTP status code 100-599:
- 200 OK
- 201 Created
- 301 Redirect
- 400 Bad Request
- 404 Not Found
- 500 Server Error

### Q: Can I mock JSON?
**A:** Yes:
```json
{
  "success": true,
  "data": [
    {"id": 1, "name": "Item 1"}
  ]
}
```

### Q: Can I mock plain text responses?
**A:** Yes:
```
Response Body: Hello World!
```
(No curly braces)

### Q: What if my API returns different responses?
**A:** Create multiple mock rules with different patterns:
```
Pattern: *://api.example.com/users → {"users": []}
Pattern: *://api.example.com/posts → {"posts": []}
```

---

## 💾 Import & Export

### Q: How do I backup my rules?
**A:**
1. Open Options
2. Go to Import/Export
3. Click "Export JSON"
4. Save file somewhere safe

### Q: How do I restore from backup?
**A:**
1. Open Options
2. Go to Import/Export
3. Click "Choose File"
4. Select your backup
5. Confirm import

### Q: What format are exported rules?
**A:** Standard JSON:
```json
[
  {
    "id": 1,
    "name": "Rule 1",
    "type": "redirect",
    "sourcePattern": "*://staging.example.com/*",
    "destination": "https://prod.example.com/",
    "enabled": true
  }
]
```

### Q: Can I share rules with others?
**A:** Yes! Export and send the JSON file. They can import it.

### Q: What if I import duplicate rules?
**A:** Imported rules get new IDs. You'll have duplicates. Delete if unwanted.

---

## ☁️ Google Drive Sync

### Q: What is Google Drive Sync?
**A:** Automatically backs up your rules to Google Drive and syncs them across devices.

### Q: How do I enable sync?
**A:**
1. Open Options
2. Click "Sign in with Google"
3. Complete login
4. Rules automatically upload

### Q: Does sync happen automatically?
**A:** Yes, every 5 minutes by default. Change in Settings.

### Q: What happens if I change rules on two devices?
**A:** Conflict resolution strategy decides:
- **Merge** (default) - Combines rules
- **Local Wins** - Keeps local device rules
- **Remote Wins** - Uses Drive rules
- **Manual** - Asks you

### Q: Can I see what was synced?
**A:**
1. Open Options
2. Go to "Sync History"
3. See all sync operations and timestamps

### Q: How much storage does sync use?
**A:** Minimal. Average rule = 500 bytes. 200 rules = 100KB.

### Q: What if I don't trust Google?
**A:** Sync is optional. Just don't sign in. Rules still work locally.

### Q: Can I turn off auto-sync?
**A:**
1. Settings → Auto-Sync
2. Toggle OFF
3. Use "Sync Now" button for manual sync

### Q: What if sync fails?
**A:** Check:
1. Internet connection
2. Google Drive permissions
3. Storage quota
4. See Sync History for error details

### Q: Can I sync to a different cloud service?
**A:** Not yet, but planned for future updates.

---

## 🔐 Privacy & Security

### Q: Does Requestly see my data?
**A:** No. Everything runs locally on your device. No data sent anywhere.

### Q: Is my Google token safe?
**A:** Yes. Stored encrypted in Chrome secure storage. Never exposed.

### Q: Can others see my rules on shared device?
**A:** If sync is on, they sync to that Google account. Create separate account to prevent.

### Q: Does Requestly track me?
**A:** No tracking. Extension is open source. Audit the code yourself.

### Q: What permissions does it have?
**A:** See manifest.json:
- Network access (to intercept requests)
- Storage (for rules and settings)
- Google Drive (if sync enabled)

---

## 🚀 Performance

### Q: Does Requestly slow down my browser?
**A:** Minimal. Rule matching is < 1ms per request.

### Q: What if I have 1000 rules?
**A:** Works but slower. Storage quota limits to ~200 rules.

### Q: Should I delete old rules?
**A:** Yes. Keeps storage clean and performance optimal.

### Q: How do I optimize rule performance?
**A:**
- Use exact patterns instead of wildcard
- Avoid complex regex
- Disable rules you don't need
- Delete unused rules regularly

### Q: Does sync use a lot of bandwidth?
**A:** No. Rules are small (typically < 100KB).

---

## 🐛 Troubleshooting

### Q: Rules aren't working. What do I do?
**A:** See TROUBLESHOOTING.md or follow these steps:
1. Refresh page (Ctrl+R)
2. Check rule is enabled (checkbox)
3. Check pattern matches URL
4. Reload extension (chrome://extensions)

### Q: How do I report a bug?
**A:** Include:
- Exact steps to reproduce
- What you expected vs. what happened
- Screenshots
- Browser version
- Extension version

### Q: Where do I suggest features?
**A:** Check GitHub issues or create new feature request.

### Q: Is there a community forum?
**A:** Check GitHub discussions or issues section.

---

## 📱 Devices & Browsers

### Q: Works on Mac/Linux?
**A:** Yes, as long as using Chrome or Chromium browser.

### Q: Can I use it on mobile?
**A:** Not yet. Chrome extensions not available on mobile browsers.

### Q: Works on Chrome OS?
**A:** Yes, fully compatible.

### Q: Can I sync between devices?
**A:** Yes! Sign into same Google account on both devices.

---

## 💡 Tips & Tricks

### Q: How do I create a staging environment redirect?
**A:**
```
1. Create Redirect rule
2. Pattern: *://staging-*.example.com/*
3. Destination: https://prod.example.com/
4. Now all staging domains redirect to prod
```

### Q: How do I test API before going live?
**A:**
```
1. Create Mock Response rule
2. Pattern: *://api.example.com/endpoint
3. Response: {"status": "ok"}
4. Your app gets fake response
5. Test without real API
```

### Q: How do I block ads?
**A:**
```
1. Create Block rule
2. Pattern: *://ads.*.com/*
3. Pattern: *://*.doubleclick.net/*
4. Pattern: *://*.googleadservices.com/*
```

### Q: How do I inject authentication headers?
**A:**
```
1. Create Headers rule
2. Pattern: *://internal-api.example.com/*
3. Add Header: Authorization: Bearer TOKEN
```

### Q: How do I redirect mobile to desktop?
**A:**
```
1. Create Redirect rule
2. Pattern: *://m.example.com/*
3. Destination: https://example.com/
```

---

## ❓ Still Have Questions?

1. Check TROUBLESHOOTING.md
2. Check DEVELOPER_SETUP.md for technical details
3. Review example rules in this FAQ
4. Check GitHub issues
5. Open a discussion

---

**Last Updated:** 2026-04-10  
**Version:** 1.0.0
