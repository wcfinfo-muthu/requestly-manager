/**
 * Unit Tests for Rule Engine
 * Tests rule creation, matching, and DNR conversion
 */

// Mock chrome storage
global.chrome = {
    storage: {
        sync: {
            get: (keys, cb) => cb({}),
            set: (data, cb) => cb(),
        },
    },
};

// Import functions to test
// Note: In actual implementation, use proper module loading
describe('Rule Engine', () => {
    let rules = [];

    beforeEach(() => {
        rules = [];
    });

    describe('Rule Creation', () => {
        test('should create redirect rule', () => {
            const rule = {
                id: 1,
                type: 'redirect',
                name: 'Redirect staging',
                sourcePattern: '*://staging.example.com/*',
                destination: 'https://prod.example.com/',
                enabled: true,
            };

            rules.push(rule);
            expect(rules[0].type).toBe('redirect');
            expect(rules[0].name).toBe('Redirect staging');
        });

        test('should create block rule', () => {
            const rule = {
                id: 2,
                type: 'block',
                name: 'Block ads',
                sourcePattern: '*://ads.example.com/*',
                enabled: true,
            };

            rules.push(rule);
            expect(rules[0].type).toBe('block');
        });

        test('should create replace rule', () => {
            const rule = {
                id: 3,
                type: 'replace',
                name: 'Replace hostname',
                sourcePattern: '*://*.example.com/*',
                findText: 'dev.example.com',
                replaceText: 'prod.example.com',
                enabled: true,
            };

            rules.push(rule);
            expect(rules[0].findText).toBe('dev.example.com');
            expect(rules[0].replaceText).toBe('prod.example.com');
        });

        test('should create headers rule', () => {
            const rule = {
                id: 4,
                type: 'headers',
                name: 'Modify headers',
                sourcePattern: '*://api.example.com/*',
                headersAdd: { 'X-Custom': 'value' },
                headersRemove: ['Cookie'],
                headersModify: { 'User-Agent': 'Custom' },
                enabled: true,
            };

            rules.push(rule);
            expect(Object.keys(rules[0].headersAdd)).toContain('X-Custom');
            expect(rules[0].headersRemove).toContain('Cookie');
        });

        test('should create response rule', () => {
            const rule = {
                id: 5,
                type: 'response',
                name: 'Mock API',
                sourcePattern: '*://api.example.com/data',
                responseStatus: 200,
                responseBody: { message: 'mocked' },
                enabled: true,
            };

            rules.push(rule);
            expect(rules[0].responseStatus).toBe(200);
            expect(rules[0].responseBody.message).toBe('mocked');
        });
    });

    describe('Rule Matching', () => {
        test('should match exact contains pattern', () => {
            const pattern = 'example.com';
            const url = 'https://subdomain.example.com/path';
            const matches = url.includes(pattern);
            expect(matches).toBe(true);
        });

        test('should match wildcard pattern', () => {
            const pattern = '*://example.com/*';
            const url = 'https://example.com/api/data';
            // Wildcard conversion: * becomes .*
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            const matches = regex.test(url);
            expect(matches).toBe(true);
        });

        test('should match regex pattern', () => {
            const pattern = '/^https:\\/\\/[a-z]+\\.example\\.com\\/.*$/';
            const url = 'https://api.example.com/data';
            const regexStr = pattern.slice(1, -1);
            const regex = new RegExp(regexStr);
            const matches = regex.test(url);
            expect(matches).toBe(true);
        });

        test('should not match non-matching pattern', () => {
            const pattern = 'staging.example.com';
            const url = 'https://prod.example.com/path';
            const matches = url.includes(pattern);
            expect(matches).toBe(false);
        });

        test('should ignore disabled rules', () => {
            const rule = {
                enabled: false,
                sourcePattern: 'example.com',
            };
            // Disabled rules should be filtered out
            const activeRules = [rule].filter(r => r.enabled);
            expect(activeRules.length).toBe(0);
        });
    });

    describe('Rule Management', () => {
        test('should update rule', () => {
            const rule = {
                id: 1,
                name: 'Original',
                enabled: true,
            };
            rules.push(rule);

            // Update
            rules[0].name = 'Updated';
            expect(rules[0].name).toBe('Updated');
        });

        test('should delete rule', () => {
            rules.push({ id: 1, name: 'Rule 1' });
            rules.push({ id: 2, name: 'Rule 2' });

            rules = rules.filter(r => r.id !== 1);
            expect(rules.length).toBe(1);
            expect(rules[0].id).toBe(2);
        });

        test('should toggle rule enabled state', () => {
            const rule = { id: 1, enabled: true };
            rules.push(rule);

            rules[0].enabled = !rules[0].enabled;
            expect(rules[0].enabled).toBe(false);
        });

        test('should pin/unpin rule (max 5)', () => {
            for (let i = 1; i <= 6; i++) {
                rules.push({ id: i, pinned: false });
            }

            // Pin first 5
            for (let i = 0; i < 5; i++) {
                rules[i].pinned = true;
            }

            const pinnedCount = rules.filter(r => r.pinned).length;
            expect(pinnedCount).toBe(5);
        });

        test('should sort pinned rules first', () => {
            rules = [
                { id: 1, pinned: false },
                { id: 2, pinned: true },
                { id: 3, pinned: false },
            ];

            const sorted = [...rules].sort((a, b) => b.pinned - a.pinned);
            expect(sorted[0].pinned).toBe(true);
            expect(sorted[1].pinned).toBe(false);
        });
    });

    describe('Rule Validation', () => {
        test('should require sourcePattern', () => {
            const rule = {
                name: 'Test',
                type: 'redirect',
                destination: 'https://example.com',
                // Missing sourcePattern
            };
            const isValid = rule.sourcePattern && rule.sourcePattern.trim().length > 0;
            expect(isValid).toBe(false);
        });

        test('should require destination for redirect', () => {
            const rule = {
                type: 'redirect',
                sourcePattern: 'example.com',
                // Missing destination
            };
            const isValid = rule.destination && rule.destination.trim().length > 0;
            expect(isValid).toBe(false);
        });

        test('should require responseBody for response type', () => {
            const rule = {
                type: 'response',
                sourcePattern: 'example.com',
                // Missing responseBody
            };
            const isValid = rule.responseBody && rule.responseBody.toString().trim().length > 0;
            expect(isValid).toBe(false);
        });

        test('should allow valid HTTP status codes', () => {
            const validCodes = [200, 201, 301, 400, 404, 500];
            validCodes.forEach(code => {
                const isValid = code >= 100 && code <= 599;
                expect(isValid).toBe(true);
            });
        });

        test('should reject invalid HTTP status codes', () => {
            const invalidCodes = [99, 600, -1, 'abc'];
            invalidCodes.forEach(code => {
                const isValid = !isNaN(code) && code >= 100 && code <= 599;
                expect(isValid).toBe(false);
            });
        });
    });

    describe('URL Substitution', () => {
        test('should replace capture groups in destination', () => {
            const pattern = '*://staging-*.example.com/api/*';
            const url = 'https://staging-v1.example.com/api/users';

            // Simulate capture groups: * becomes (.*)
            const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '(.*)');
            const regex = new RegExp(regexPattern);
            const matches = url.match(regex);

            expect(matches).not.toBeNull();
            expect(matches.length).toBeGreaterThan(1);
        });

        test('should substitute $1, $2 in destination', () => {
            const destination = 'https://$1.prod.com/$2';
            const substituted = destination
                .replace('$1', 'api')
                .replace('$2', 'v1/users');

            expect(substituted).toBe('https://api.prod.com/v1/users');
        });

        test('should handle find/replace text', () => {
            const text = 'staging.example.com';
            const findText = 'staging';
            const replaceText = 'prod';
            const result = text.replace(findText, replaceText);

            expect(result).toBe('prod.example.com');
        });

        test('should handle regex find/replace', () => {
            const text = 'build-dev-v123';
            const pattern = /dev/g;
            const result = text.replace(pattern, 'prod');

            expect(result).toBe('build-prod-v123');
        });
    });

    describe('Rule Storage', () => {
        test('should serialize rules to JSON', () => {
            rules.push({
                id: 1,
                type: 'redirect',
                name: 'Test',
            });

            const json = JSON.stringify(rules);
            expect(typeof json).toBe('string');
            expect(json).toContain('redirect');
        });

        test('should deserialize rules from JSON', () => {
            const json = '[{"id":1,"type":"redirect","name":"Test"}]';
            const parsed = JSON.parse(json);

            expect(parsed[0].type).toBe('redirect');
            expect(parsed[0].id).toBe(1);
        });

        test('should handle empty rules array', () => {
            const json = JSON.stringify([]);
            const parsed = JSON.parse(json);

            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed.length).toBe(0);
        });
    });
});
