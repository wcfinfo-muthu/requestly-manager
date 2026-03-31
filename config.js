// config.js — Centralized environment configuration
const CONFIG_DATA = {
    // URL for the hosted Rule Manager (GitHub Pages site)
    MANAGER_URL: 'https://wcfinfo-muthu.github.io/requestly-manager',
    
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
