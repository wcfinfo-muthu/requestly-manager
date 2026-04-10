// config.js — Centralized environment configuration

// Helper to safely get local URL
function getManagerUrl() {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
            return chrome.runtime.getURL('src/ui/options.html');
        }
    } catch (e) {
        console.error('[Config] Failed to get local manager URL:', e);
    }
    return null;  // No fallback - use local only
}

const CONFIG_DATA = {
    // MANAGER_URL: getManagerUrl()
    MANAGER_URL: 'https://wcfinfo-muthu.github.io/requestly-manager',
};