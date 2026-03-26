import { getRules, buildDNRRules, doesRuleMatchUrl, toggleRule } from './rules.js';

const MAX_RULE_ID = 100000;

// ── Initialize on install ──────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const rules = await getRules();
  await syncDNRRules(rules);
  console.log('[URLRewriter] Extension installed. Rules synced:', rules.length);
});

// ── Re-sync whenever storage changes ──────────────────────────────────────
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync' && (changes.rules || changes.extensionEnabled)) {
    const rules = await getRules();
    const enabled = await getExtensionEnabled();
    await syncDNRRules(enabled ? rules : []);
    console.log('[URLRewriter] Rules updated. Active:', enabled ? rules.filter(r => r.enabled).length : 0);
  }
});

// ── Messages ──────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_ACTIVE_RULES') {
    (async () => {
      const rules = await getRules();
      const enabled = await getExtensionEnabled();
      if (!enabled) {
        sendResponse({ hasActiveRules: false });
        return;
      }
      const activeRules = rules.filter(r => doesRuleMatchUrl(r, message.url));
      const hasActive = activeRules.length > 0;
      sendResponse({ 
        hasActiveRules: hasActive, 
        rule: hasActive ? activeRules[0] : null,
        activeCount: activeRules.length 
      });
    })();
    return true; // async response
  }

  if (message.type === 'TOGGLE_RULE') {
    (async () => {
      await toggleRule(message.ruleId);
      sendResponse({ success: true });
    })();
    return true;
  }


  if (message.type === 'OPEN_OPTIONS_PAGE') {
    let url = 'options.html';
    if (message.url) {
      try {
        const domain = new URL(message.url).hostname;
        url += `?filter=${encodeURIComponent(domain)}`;
      } catch (e) {
        // ignore invalid urls
      }
    }
    chrome.tabs.create({ url: chrome.runtime.getURL(url) });
  }

  if (message.type === 'CAPTURE_TAB') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      chrome.tabs.create({ url: dataUrl });
    });
  }

  if (message.type === 'CAPTURE_FULL_TAB') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      chrome.tabs.create({ url: dataUrl });
    });
  }
});


// ── Sync Dynamic declarativeNetRequest rules ───────────────────────────────
async function syncDNRRules(userRules) {
  // Remove all existing dynamic rules first
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  const activeRules = userRules.filter(r => r.enabled);
  const dnrRules = buildDNRRules(activeRules);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: dnrRules,
  });
}

async function getExtensionEnabled() {
  return new Promise(resolve => {
    chrome.storage.sync.get({ extensionEnabled: true }, data => {
      resolve(data.extensionEnabled);
    });
  });
}
