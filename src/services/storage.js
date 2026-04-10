// services/storage.js — Chrome storage abstraction layer

/**
 * Storage service that handles chrome.storage.sync with localStorage fallback
 * Provides a clean API for storing and retrieving extension data
 */

export const StorageService = {
    /**
     * Get rules from storage
     * @returns {Promise<Array>} Array of rule objects
     */
    async getRules() {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get({rules: []}, data => {
                    resolve(data.rules || []);
                });
            } else {
                // Fallback to localStorage
                try {
                    const data = localStorage.getItem('requestly_rules_fallback');
                    resolve(data ? JSON.parse(data) : []);
                } catch (e) {
                    resolve([]);
                }
            }
        });
    },

    /**
     * Save rules to storage
     * @param {Array} rules - Array of rule objects
     * @returns {Promise<void>}
     */
    async saveRules(rules) {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set({rules}, () => {
                    // Also save to localStorage as fallback
                    try {
                        localStorage.setItem('requestly_rules_fallback', JSON.stringify(rules));
                    } catch (e) {
                        // Ignore localStorage errors
                    }
                    resolve();
                });
            } else {
                // Fallback to localStorage
                try {
                    localStorage.setItem('requestly_rules_fallback', JSON.stringify(rules));
                } catch (e) {
                    console.error('Failed to save rules:', e);
                }
                resolve();
            }
        });
    },

    /**
     * Get extension enabled state
     * @returns {Promise<boolean>}
     */
    async getExtensionEnabled() {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get({extensionEnabled: true}, data => {
                    resolve(data.extensionEnabled !== false);
                });
            } else {
                // Fallback to localStorage
                try {
                    const data = localStorage.getItem('requestly_extension_enabled');
                    resolve(data !== 'false');
                } catch (e) {
                    resolve(true);
                }
            }
        });
    },

    /**
     * Set extension enabled state
     * @param {boolean} enabled - Whether extension is enabled
     * @returns {Promise<void>}
     */
    async setExtensionEnabled(enabled) {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set({extensionEnabled: enabled}, () => {
                    try {
                        localStorage.setItem('requestly_extension_enabled', String(enabled));
                    } catch (e) {
                        // Ignore localStorage errors
                    }
                    resolve();
                });
            } else {
                // Fallback to localStorage
                try {
                    localStorage.setItem('requestly_extension_enabled', String(enabled));
                } catch (e) {
                    console.error('Failed to save extension state:', e);
                }
                resolve();
            }
        });
    },

    /**
     * Listen for storage changes
     * @param {Function} callback - Called when storage changes
     */
    onChanged(callback) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'sync') {
                    callback(changes);
                }
            });
        }
    },
};
