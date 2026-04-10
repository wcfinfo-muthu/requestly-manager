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
    // Local options page
    MANAGER_URL: getManagerUrl(),

    // Security: Only allow communication with these origins
    ALLOWED_ORIGINS: [
        'https://wcfinfo-muthu.github.io',
        'http://wcfinfo-muthu.github.io'
    ],

    // Versioning
    VERSION: '1.0.0'
};

// Export for Modules (background, popup, index)
if (typeof exports !== 'undefined' || (typeof module !== 'undefined' && module.exports)) {
    // This is for environments that support exports (not standard in browsers without bundlers)
}

// Global attachment for content scripts and simple scripts
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG_DATA;
}

// Standard ES Module export
export const CONFIG = CONFIG_DATA;