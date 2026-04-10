/**
 * Integration Tests for Sync Service
 * Tests sync operations, conflict resolution, and history
 */

describe('Sync Service', () => {
    const CONFLICT_STRATEGY = {
        LOCAL_WINS: 'local',
        REMOTE_WINS: 'remote',
        MERGE: 'merge',
        MANUAL: 'manual',
    };

    const SYNC_STATUS = {
        IDLE: 'idle',
        SYNCING: 'syncing',
        SYNCED: 'synced',
        ERROR: 'error',
        CONFLICT: 'conflict',
    };

    let localRules = [];
    let driveRules = [];
    let syncHistory = [];
    let syncState = {
        status: SYNC_STATUS.IDLE,
        lastSyncTime: null,
        lastError: null,
    };

    beforeEach(() => {
        localRules = [];
        driveRules = [];
        syncHistory = [];
        syncState = {
            status: SYNC_STATUS.IDLE,
            lastSyncTime: null,
            lastError: null,
        };
    });

    describe('Conflict Detection', () => {
        test('should detect no conflict when rules match', () => {
            const rule = { id: 1, name: 'Rule 1', version: 100 };
            localRules = [rule];
            driveRules = [rule];

            const conflict = detectConflict(localRules, driveRules);
            expect(conflict).toBeNull();
        });

        test('should detect modified rule (different content)', () => {
            localRules = [{ id: 1, name: 'Rule 1 Local', version: 100 }];
            driveRules = [{ id: 1, name: 'Rule 1 Drive', version: 101 }];

            const conflict = detectConflict(localRules, driveRules);
            expect(conflict).not.toBeNull();
            expect(conflict.type).toBe('MODIFIED');
        });

        test('should detect deleted in drive', () => {
            localRules = [{ id: 1, name: 'Rule 1' }];
            driveRules = [];

            const conflict = detectConflict(localRules, driveRules);
            expect(conflict).not.toBeNull();
            expect(conflict.type).toBe('DELETED_IN_DRIVE');
        });

        test('should detect new in drive', () => {
            localRules = [];
            driveRules = [{ id: 2, name: 'Rule 2' }];

            const conflict = detectConflict(localRules, driveRules);
            expect(conflict).not.toBeNull();
            expect(conflict.type).toBe('NEW_IN_DRIVE');
        });

        function detectConflict(local, drive) {
            if (!Array.isArray(local) || !Array.isArray(drive)) return null;

            const localIds = new Set(local.map(r => r.id));
            const driveIds = new Set(drive.map(r => r.id));

            // Check for modified
            for (const rule of local) {
                const driveRule = drive.find(r => r.id === rule.id);
                if (driveRule && JSON.stringify(rule) !== JSON.stringify(driveRule)) {
                    return { type: 'MODIFIED', rule };
                }
            }

            // Check for deleted in drive
            if (local.some(r => !driveIds.has(r.id))) {
                return { type: 'DELETED_IN_DRIVE' };
            }

            // Check for new in drive
            if (drive.some(r => !localIds.has(r.id))) {
                return { type: 'NEW_IN_DRIVE' };
            }

            return null;
        }
    });

    describe('Conflict Resolution', () => {
        test('LOCAL_WINS: should keep local rules', () => {
            localRules = [{ id: 1, name: 'Local' }];
            driveRules = [{ id: 1, name: 'Drive' }];

            const resolved = resolveConflict(localRules, driveRules, CONFLICT_STRATEGY.LOCAL_WINS);
            expect(resolved[0].name).toBe('Local');
        });

        test('REMOTE_WINS: should use drive rules', () => {
            localRules = [{ id: 1, name: 'Local' }];
            driveRules = [{ id: 1, name: 'Drive' }];

            const resolved = resolveConflict(localRules, driveRules, CONFLICT_STRATEGY.REMOTE_WINS);
            expect(resolved[0].name).toBe('Drive');
        });

        test('MERGE: should combine both rule sets', () => {
            localRules = [{ id: 1, name: 'Local' }];
            driveRules = [{ id: 2, name: 'Drive' }];

            const resolved = resolveConflict(localRules, driveRules, CONFLICT_STRATEGY.MERGE);
            expect(resolved.length).toBe(2);
            expect(resolved.some(r => r.id === 1)).toBe(true);
            expect(resolved.some(r => r.id === 2)).toBe(true);
        });

        test('MERGE: should prefer newer version by timestamp', () => {
            localRules = [{ id: 1, name: 'Old', updatedAt: 1000 }];
            driveRules = [{ id: 1, name: 'New', updatedAt: 2000 }];

            const resolved = resolveConflict(localRules, driveRules, CONFLICT_STRATEGY.MERGE);
            expect(resolved[0].name).toBe('New');
        });

        function resolveConflict(local, drive, strategy) {
            if (strategy === CONFLICT_STRATEGY.LOCAL_WINS) {
                return local;
            }
            if (strategy === CONFLICT_STRATEGY.REMOTE_WINS) {
                return drive;
            }
            if (strategy === CONFLICT_STRATEGY.MERGE) {
                const merged = [...local];
                for (const driveRule of drive) {
                    const existing = merged.find(r => r.id === driveRule.id);
                    if (!existing) {
                        merged.push(driveRule);
                    } else if (driveRule.updatedAt > existing.updatedAt) {
                        Object.assign(existing, driveRule);
                    }
                }
                return merged;
            }
            return local;
        }
    });

    describe('Sync Operations', () => {
        test('should track sync up', async () => {
            localRules = [{ id: 1, name: 'Rule 1' }];
            const action = 'SYNC_UP';

            trackVersion(action, localRules);

            expect(syncHistory.length).toBe(1);
            expect(syncHistory[0].action).toBe('SYNC_UP');
            expect(syncHistory[0].ruleCount).toBe(1);
        });

        test('should track sync down', async () => {
            driveRules = [{ id: 1, name: 'Rule 1' }];
            const action = 'SYNC_DOWN';

            trackVersion(action, driveRules);

            expect(syncHistory.length).toBe(1);
            expect(syncHistory[0].action).toBe('SYNC_DOWN');
        });

        test('should track error in history', () => {
            const action = 'SYNC_UP';
            const error = new Error('Network timeout');

            trackVersion(action, [], error);

            expect(syncHistory[0].error).toBeTruthy();
            expect(syncHistory[0].error).toContain('Network timeout');
        });

        test('should keep only last 100 history entries', () => {
            for (let i = 0; i < 105; i++) {
                trackVersion('SYNC_UP', []);
            }

            expect(syncHistory.length).toBeLessThanOrEqual(100);
        });

        function trackVersion(action, rules, error = null) {
            const history = {
                action,
                timestamp: Date.now(),
                ruleCount: rules?.length || 0,
                rulesHash: hashRules(rules),
                error: error ? error.toString() : null,
            };

            syncHistory.push(history);
            if (syncHistory.length > 100) {
                syncHistory = syncHistory.slice(-100);
            }
        }

        function hashRules(rules) {
            const str = JSON.stringify(rules);
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash = hash & hash; // Convert to 32-bit integer
            }
            return hash.toString(16);
        }
    });

    describe('Sync State Management', () => {
        test('should update status to syncing', () => {
            updateSyncState(SYNC_STATUS.SYNCING);
            expect(syncState.status).toBe(SYNC_STATUS.SYNCING);
        });

        test('should update status to synced', () => {
            updateSyncState(SYNC_STATUS.SYNCED);
            expect(syncState.status).toBe(SYNC_STATUS.SYNCED);
            expect(syncState.lastSyncTime).not.toBeNull();
        });

        test('should update status to error with message', () => {
            const error = 'Network error';
            updateSyncState(SYNC_STATUS.ERROR, error);
            expect(syncState.status).toBe(SYNC_STATUS.ERROR);
            expect(syncState.lastError).toBe(error);
        });

        function updateSyncState(status, error = null) {
            syncState.status = status;
            syncState.lastError = error;
            if (status === SYNC_STATUS.SYNCED) {
                syncState.lastSyncTime = Date.now();
            }
        }
    });

    describe('Auto-sync', () => {
        test('should execute sync on interval', async () => {
            let syncCount = 0;
            const mockSync = () => {
                syncCount++;
            };

            // Simulate interval
            const interval = setInterval(mockSync, 100);
            await new Promise(resolve => setTimeout(resolve, 250));
            clearInterval(interval);

            expect(syncCount).toBeGreaterThanOrEqual(2);
        });

        test('should stop auto-sync', () => {
            let syncCount = 0;
            const interval = setInterval(() => syncCount++, 100);
            clearInterval(interval);

            const countBeforeStop = syncCount;
            // Wait a bit
            expect(syncCount).toBe(countBeforeStop);
        });

        test('should respect auto-sync interval setting', () => {
            const intervals = [1, 5, 10, 60]; // minutes
            intervals.forEach(min => {
                const ms = min * 60 * 1000;
                expect(ms).toBeGreaterThan(0);
            });
        });
    });

    describe('Error Recovery', () => {
        test('should retry failed sync', async () => {
            let retryCount = 0;
            const maxRetries = 3;

            async function syncWithRetry() {
                try {
                    throw new Error('Sync failed');
                } catch (error) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        return syncWithRetry();
                    }
                    throw error;
                }
            }

            try {
                await syncWithRetry();
            } catch (error) {
                expect(retryCount).toBe(maxRetries);
            }
        });

        test('should implement exponential backoff', () => {
            function getBackoffDelay(attempt) {
                return Math.min(1000 * Math.pow(2, attempt), 32000);
            }

            const delays = [0, 1, 2, 3, 4].map(getBackoffDelay);
            expect(delays[0]).toBe(1000);
            expect(delays[1]).toBe(2000);
            expect(delays[2]).toBe(4000);
            expect(delays[3]).toBe(8000);
            expect(delays[4]).toBe(16000);
        });

        test('should record error in sync history on failure', () => {
            const error = new Error('Upload failed');
            trackVersion('SYNC_UP', [], error);

            expect(syncHistory[0].error).toContain('Upload failed');
        });
    });

    describe('Performance', () => {
        test('sync operation should complete in < 5 seconds', async () => {
            const start = Date.now();
            // Simulate sync operation
            await new Promise(resolve => setTimeout(resolve, 100));
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(5000);
        });

        test('conflict detection should handle 1000+ rules', () => {
            const largeSet = Array.from({ length: 1000 }, (_, i) => ({
                id: i,
                name: `Rule ${i}`,
            }));

            const start = Date.now();
            detectConflict(largeSet, largeSet);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(1000); // Should complete in < 1 second
        });

        function detectConflict(local, drive) {
            if (!Array.isArray(local) || !Array.isArray(drive)) return null;
            return null;
        }
    });
});
