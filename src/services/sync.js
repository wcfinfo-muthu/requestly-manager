// services/sync.js — Google Drive Rules Sync Service
// Handles automatic sync of rules between local storage and Google Drive

import { GoogleAuth, GoogleDrive } from './google.js';

/**
 * Sync Status Constants
 */
export const SYNC_STATUS = {
    IDLE: 'idle',
    SYNCING: 'syncing',
    SYNCED: 'synced',
    ERROR: 'error',
    CONFLICT: 'conflict',
};

/**
 * Conflict Resolution Strategies
 */
export const CONFLICT_STRATEGY = {
    LOCAL_WINS: 'local',      // Keep local rules, ignore Drive
    REMOTE_WINS: 'remote',    // Use Drive rules, overwrite local
    MERGE: 'merge',           // Merge both rule sets
    MANUAL: 'manual',         // Ask user to resolve
};

/**
 * Sync Service
 * Manages synchronization between local storage and Google Drive
 */
export const SyncService = {
    // Current sync state
    syncState: {
        status: SYNC_STATUS.IDLE,
        lastSyncTime: null,
        lastError: null,
        conflictCount: 0,
    },

    // Sync options
    options: {
        autoSync: true,
        autoSyncInterval: 5 * 60 * 1000, // 5 minutes
        conflictStrategy: CONFLICT_STRATEGY.MERGE,
        enableVersionHistory: true,
    },

    // Auto-sync timer
    autoSyncTimer: null,

    /**
     * Initialize sync service
     * Sets up auto-sync and listens for changes
     */
    async initialize() {
        try {
            console.log('[SyncService] Initializing...');

            // Load sync options from storage
            await this.loadOptions();

            // Check if user is authenticated
            const isAuthenticated = await GoogleAuth.isAuthenticated();
            if (!isAuthenticated) {
                console.log('[SyncService] User not authenticated, waiting for login');
                return;
            }

            // On first init, sync down from Drive
            await this.syncDown();

            // Start auto-sync if enabled
            if (this.options.autoSync) {
                this.startAutoSync();
            }

            // Listen for local rule changes
            this.setupStorageListener();

            console.log('[SyncService] Initialized successfully');
        } catch (error) {
            console.error('[SyncService] Initialization error:', error);
            this.updateSyncState(SYNC_STATUS.ERROR, error.message);
        }
    },

    /**
     * Load sync options from storage
     */
    async loadOptions() {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get('sync_options', data => {
                    if (data.sync_options) {
                        this.options = { ...this.options, ...data.sync_options };
                    }
                    resolve();
                });
            } else {
                // Fallback to localStorage
                try {
                    const stored = localStorage.getItem('sync_options');
                    if (stored) {
                        this.options = { ...this.options, ...JSON.parse(stored) };
                    }
                } catch (e) {
                    // Ignore
                }
                resolve();
            }
        });
    },

    /**
     * Save sync options to storage
     */
    async saveOptions() {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set({ sync_options: this.options }, () => {
                    try {
                        localStorage.setItem('sync_options', JSON.stringify(this.options));
                    } catch (e) {
                        // Ignore
                    }
                    resolve();
                });
            } else {
                // Fallback to localStorage
                try {
                    localStorage.setItem('sync_options', JSON.stringify(this.options));
                } catch (e) {
                    console.error('Failed to save sync options:', e);
                }
                resolve();
            }
        });
    },

    /**
     * Setup listener for local storage changes
     */
    setupStorageListener() {
        if (typeof chrome === 'undefined' || !chrome.storage) return;

        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'sync' && changes.rules && this.options.autoSync) {
                // Debounce the sync to avoid too many uploads
                clearTimeout(this.syncUpTimer);
                this.syncUpTimer = setTimeout(() => {
                    this.syncUp();
                }, 2000); // Wait 2 seconds before syncing up
            }
        });
    },

    /**
     * Start automatic sync timer
     */
    startAutoSync() {
        if (this.autoSyncTimer) {
            clearInterval(this.autoSyncTimer);
        }

        console.log('[SyncService] Starting auto-sync every', this.options.autoSyncInterval / 1000, 'seconds');

        // Run sync immediately
        this.syncUp();

        // Then run periodically
        this.autoSyncTimer = setInterval(() => {
            this.syncUp();
        }, this.options.autoSyncInterval);
    },

    /**
     * Stop automatic sync
     */
    stopAutoSync() {
        if (this.autoSyncTimer) {
            clearInterval(this.autoSyncTimer);
            this.autoSyncTimer = null;
            console.log('[SyncService] Auto-sync stopped');
        }
    },

    /**
     * Sync rules down from Google Drive
     * Downloads Drive version and merges with local
     */
    async syncDown() {
        try {
            this.updateSyncState(SYNC_STATUS.SYNCING);
            console.log('[SyncService] Syncing down from Drive...');

            const isAuthenticated = await GoogleAuth.isAuthenticated();
            if (!isAuthenticated) {
                console.log('[SyncService] Not authenticated, skipping sync down');
                return;
            }

            // Get Drive rules
            const driveRules = await GoogleDrive.downloadRules();
            if (!driveRules) {
                console.log('[SyncService] No rules found on Drive');
                this.updateSyncState(SYNC_STATUS.SYNCED);
                return;
            }

            // Get local rules
            const localRules = await this.getRules();

            // Check for conflicts
            const conflict = this.detectConflict(localRules, driveRules);

            if (conflict && this.options.conflictStrategy === CONFLICT_STRATEGY.MANUAL) {
                this.updateSyncState(SYNC_STATUS.CONFLICT, 'Conflict detected - user action needed');
                console.log('[SyncService] Conflict detected:', conflict);
                return;
            }

            // Resolve conflict based on strategy
            const mergedRules = this.resolveConflict(localRules, driveRules, conflict);

            // Save merged rules
            await this.saveRules(mergedRules);

            // Track version
            await this.trackVersion('SYNC_DOWN', mergedRules);

            this.updateSyncState(SYNC_STATUS.SYNCED);
            console.log('[SyncService] Sync down completed');
        } catch (error) {
            console.error('[SyncService] Sync down error:', error);
            // Track error in history
            await this.trackVersion('SYNC_DOWN', [], error);
            this.updateSyncState(SYNC_STATUS.ERROR, error.message);
            throw error;
        }
    },

    /**
     * Sync rules up to Google Drive
     * Uploads local version to Drive
     */
    async syncUp() {
        try {
            this.updateSyncState(SYNC_STATUS.SYNCING);
            console.log('[SyncService] Syncing up to Drive...');

            const isAuthenticated = await GoogleAuth.isAuthenticated();
            if (!isAuthenticated) {
                console.log('[SyncService] Not authenticated, skipping sync up');
                return;
            }

            // Get local rules
            const localRules = await this.getRules();

            // Upload to Drive
            await GoogleDrive.uploadRules(localRules);

            // Track version
            await this.trackVersion('SYNC_UP', localRules);

            this.updateSyncState(SYNC_STATUS.SYNCED);
            console.log('[SyncService] Sync up completed');
        } catch (error) {
            console.error('[SyncService] Sync up error:', error);
            // Track error in history
            await this.trackVersion('SYNC_UP', [], error);
            this.updateSyncState(SYNC_STATUS.ERROR, error.message);
            throw error;
        }
    },

    /**
     * Detect conflicts between local and Drive rules
     */
    detectConflict(localRules, driveRules) {
        if (!Array.isArray(localRules) || !Array.isArray(driveRules)) {
            return null;
        }

        // Build rule maps for comparison
        const localMap = new Map(localRules.map(r => [r.id, r]));
        const driveMap = new Map(driveRules.map(r => [r.id, r]));

        const conflicts = [];

        // Check for modified rules
        for (const [id, driveRule] of driveMap) {
            const localRule = localMap.get(id);
            if (localRule) {
                // Rule exists in both places
                if (JSON.stringify(localRule) !== JSON.stringify(driveRule)) {
                    conflicts.push({
                        type: 'MODIFIED',
                        id,
                        local: localRule,
                        drive: driveRule,
                    });
                }
            }
        }

        // Check for deleted rules
        for (const id of localMap.keys()) {
            if (!driveMap.has(id)) {
                conflicts.push({
                    type: 'DELETED_IN_DRIVE',
                    id,
                });
            }
        }

        // Check for new rules in Drive
        for (const id of driveMap.keys()) {
            if (!localMap.has(id)) {
                conflicts.push({
                    type: 'NEW_IN_DRIVE',
                    id,
                    drive: driveMap.get(id),
                });
            }
        }

        return conflicts.length > 0 ? conflicts : null;
    },

    /**
     * Resolve conflicts based on configured strategy
     */
    resolveConflict(localRules, driveRules, conflicts) {
        if (!conflicts) {
            return localRules;
        }

        const strategy = this.options.conflictStrategy;

        if (strategy === CONFLICT_STRATEGY.LOCAL_WINS) {
            return localRules;
        }

        if (strategy === CONFLICT_STRATEGY.REMOTE_WINS) {
            return driveRules;
        }

        if (strategy === CONFLICT_STRATEGY.MERGE) {
            return this.mergeRules(localRules, driveRules, conflicts);
        }

        // Default to merge
        return this.mergeRules(localRules, driveRules, conflicts);
    },

    /**
     * Merge rules from local and Drive
     */
    mergeRules(localRules, driveRules, conflicts) {
        const merged = new Map();

        // Start with local rules
        for (const rule of localRules) {
            merged.set(rule.id, rule);
        }

        // Add Drive rules that don't exist locally
        for (const rule of driveRules) {
            if (!merged.has(rule.id)) {
                merged.set(rule.id, rule);
            }
        }

        // For conflicts, prefer the one with newer timestamp
        if (conflicts) {
            for (const conflict of conflicts) {
                if (conflict.type === 'MODIFIED') {
                    const localTime = conflict.local.createdAt || 0;
                    const driveTime = conflict.drive.createdAt || 0;

                    if (driveTime > localTime) {
                        merged.set(conflict.id, conflict.drive);
                    }
                }
            }
        }

        return Array.from(merged.values());
    },

    /**
     * Track sync version history
     */
    async trackVersion(action, rules, error = null) {
        if (!this.options.enableVersionHistory) return;

        try {
            const history = {
                action,
                timestamp: Date.now(),
                ruleCount: rules?.length || 0,
                rulesHash: rules ? this.hashRules(rules) : null,
                error: error ? error.toString() : null,
            };

            return new Promise(resolve => {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                    chrome.storage.sync.get('sync_history', data => {
                        const versions = (data.sync_history || []).slice(-99); // Keep last 100
                        versions.push(history);
                        chrome.storage.sync.set({ sync_history: versions }, resolve);
                    });
                } else {
                    // Fallback to localStorage
                    try {
                        const stored = localStorage.getItem('sync_history') || '[]';
                        const versions = JSON.parse(stored).slice(-99);
                        versions.push(history);
                        localStorage.setItem('sync_history', JSON.stringify(versions));
                    } catch (e) {
                        // Ignore
                    }
                    resolve();
                }
            });
        } catch (error) {
            console.error('[SyncService] Track version error:', error);
        }
    },

    /**
     * Get sync history
     */
    async getSyncHistory() {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get('sync_history', data => {
                    resolve(data.sync_history || []);
                });
            } else {
                // Fallback to localStorage
                try {
                    const stored = localStorage.getItem('sync_history') || '[]';
                    resolve(JSON.parse(stored));
                } catch (e) {
                    resolve([]);
                }
            }
        });
    },

    /**
     * Simple hash function for rules array
     */
    hashRules(rules) {
        const str = JSON.stringify(rules);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    },

    /**
     * Get rules from local storage
     */
    async getRules() {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get('rules', data => {
                    resolve(data.rules || []);
                });
            } else {
                // Fallback to localStorage
                try {
                    const stored = localStorage.getItem('requestly_rules_fallback') || '[]';
                    resolve(JSON.parse(stored));
                } catch (e) {
                    resolve([]);
                }
            }
        });
    },

    /**
     * Save rules to local storage
     */
    async saveRules(rules) {
        return new Promise(resolve => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set({ rules }, () => {
                    try {
                        localStorage.setItem('requestly_rules_fallback', JSON.stringify(rules));
                    } catch (e) {
                        // Ignore
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
     * Update sync state and notify listeners
     */
    updateSyncState(status, error = null) {
        this.syncState.status = status;
        this.syncState.lastError = error;
        if (status === SYNC_STATUS.SYNCED) {
            this.syncState.lastSyncTime = new Date();
        }

        // Broadcast state change
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
                type: 'SYNC_STATE_CHANGED',
                syncState: this.syncState,
            }).catch(() => {
                // Receiver not available
            });
        }
    },

    /**
     * Get current sync state
     */
    getSyncState() {
        return { ...this.syncState };
    },

    /**
     * Force sync (up and down)
     */
    async forceSync() {
        try {
            console.log('[SyncService] Force sync initiated');
            await this.syncDown();
            await this.syncUp();
            console.log('[SyncService] Force sync completed');
        } catch (error) {
            console.error('[SyncService] Force sync error:', error);
            throw error;
        }
    },

    /**
     * Handle user login - start sync
     */
    async onUserLogin() {
        console.log('[SyncService] User logged in, starting sync...');
        await this.initialize();
    },

    /**
     * Handle user logout - stop sync
     */
    async onUserLogout() {
        console.log('[SyncService] User logged out, stopping sync...');
        this.stopAutoSync();
        this.updateSyncState(SYNC_STATUS.IDLE);
    },
};
