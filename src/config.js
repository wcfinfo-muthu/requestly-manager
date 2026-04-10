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

// Global attachment for content scripts and simple scripts
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG_DATA;
}

// Standard ES Module export
export const CONFIG = CONFIG_DATA;