import {getRules, buildDNRRules, doesRuleMatchUrl, toggleRule} from './rules.js';
import {CONFIG} from './config.js';

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
    // ── Web App Bridge Handlers ──
    if (message.type === 'GET_RULES') {
        (async () => {
            const rules = await getRules();
            sendResponse({rules});
        })();
        return true;
    }
    if (message.type === 'SET_RULES') {
        chrome.storage.sync.set({rules: message.rules}, () => sendResponse({success: true}));
        return true;
    }
    if (message.type === 'SET_RULES_BULK') {
        chrome.storage.sync.set({rules: message.rules}, () => sendResponse({success: true}));
        return true;
    }
    if (message.type === 'GET_ENABLED') {
        (async () => {
            const extensionEnabled = await getExtensionEnabled();
            sendResponse({extensionEnabled});
        })();
        return true;
    }
    if (message.type === 'SET_ENABLED') {
        chrome.storage.sync.set({extensionEnabled: message.enabled}, () => sendResponse({success: true}));
        return true;
    }

    if (message.type === 'OPEN_OPTIONS_PAGE') {
        // Use central config for the base URL
        let baseUrl = CONFIG.MANAGER_URL;
        let url = baseUrl;

        if (message.url) {
            try {
                const domain = new URL(message.url).hostname;
                url += `?filter=${encodeURIComponent(domain)}`;
            } catch (e) {
                // ignore invalid urls
            }
        }
        chrome.tabs.create({url: url});
        sendResponse({success: true});
        return true;
    }

    if (message.type === 'CAPTURE_TAB') {
        const windowId = sender.tab ? sender.tab.windowId : null;
        chrome.tabs.captureVisibleTab(windowId, {format: 'png'}, (dataUrl) => {
            if (chrome.runtime.lastError) {
                console.error('[URLRewriter] Capture failed:', chrome.runtime.lastError.message);
                return;
            }
            downloadScreenshot(dataUrl);
            sendResponse({success: true});
        });
        return true;
    }

    if (message.type === 'INIT_FULL_PAGE_CAPTURE') {
        const tabId = sender.tab ? sender.tab.id : null;
        if (!tabId) {
             chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs[0]) {
                    const activeTabId = tabs[0].id;
                    chrome.tabs.sendMessage(activeTabId, {type: 'PREPARE_FULL_PAGE'}, (response) => {
                        if (response && response.success) {
                            captureNextChunk(activeTabId, tabs[0].windowId);
                        }
                    });
                }
            });
        } else {
            chrome.tabs.sendMessage(tabId, {type: 'PREPARE_FULL_PAGE'}, (response) => {
                if (response && response.success) {
                    captureNextChunk(tabId, sender.tab.windowId);
                }
            });
        }
        sendResponse({success: true});
        return true;
    }

    if (message.type === 'CHECK_ACTIVE_RULES') {
        (async () => {
            const rules = await getRules();
            const enabled = await getExtensionEnabled();
            if (!enabled) {
                sendResponse({hasActiveRules: false});
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
            sendResponse({success: true});
        })();
        return true;
    }

    function captureNextChunk(tabId, windowId) {
        chrome.tabs.captureVisibleTab(windowId, {format: 'png'}, (dataUrl) => {
            chrome.tabs.sendMessage(tabId, {type: 'PROCESS_CHUNK', dataUrl}, (res) => {
                if (res && !res.done) {
                    captureNextChunk(tabId, windowId);
                } else if (res && res.done) {
                    downloadScreenshot(res.dataUrl, 'full-page');
                }
            });
        });
    }

    function downloadScreenshot(dataUrl, prefix = 'visible') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
        const filename = `requestly-${prefix}-${timestamp}.png`;

        chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: false
        }, () => {
            if (chrome.runtime.lastError) {
                console.error('[URLRewriter] Download failed:', chrome.runtime.lastError.message);
                chrome.tabs.create({url: dataUrl});
            }
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
        chrome.storage.sync.get({extensionEnabled: true}, data => {
            resolve(data.extensionEnabled);
        });
    });
}
