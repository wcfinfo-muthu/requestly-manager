// rules/engine.js — Shared rule management utilities

export const RULE_TYPES = {
    REDIRECT: 'redirect',
    BLOCK: 'block',
    REPLACE: 'replace',
    HEADERS: 'headers',
    RESPONSE: 'response',
};

// ── Storage helpers ────────────────────────────────────────────────────────

function webBridgeCall(payload) {
    return new Promise(resolve => {
        if (typeof window === 'undefined') {
            resolve({});
            return;
        }

        // Check if running in extension context (chrome-extension:// URL)
        const isExtensionContext = typeof chrome !== 'undefined' &&
                                   window.location.protocol === 'chrome-extension:';

        // Use native chrome.runtime.sendMessage in extension context
        if (isExtensionContext && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage(payload, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('[Engine] Message error:', chrome.runtime.lastError.message);
                    resolve({ error: chrome.runtime.lastError.message });
                } else {
                    resolve(response || {});
                }
            });
            return;
        }

        // Use postMessage for web pages
        const id = Date.now() + Math.random().toString();
        const listener = (event) => {
            if (event.source !== window || !event.data || event.data.source !== 'REQUESTLY_EXT') return;
            if (event.data.id === id) {
                window.removeEventListener('message', listener);
                resolve(event.data.response || {});
            }
        };
        window.addEventListener('message', listener);
        window.postMessage({ source: 'REQUESTLY_WEB', id, ...payload }, '*');

        // Timeout in case extension is not installed
        setTimeout(() => {
            window.removeEventListener('message', listener);
            resolve({ error: 'Timeout', rules: [] });
        }, 1500);
    });
}

// Export for use in options.js mock
export { webBridgeCall };

export function getRules() {
    return new Promise(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get({rules: []}, data => resolve(data.rules || []));
        } else {
            webBridgeCall({ type: 'GET_RULES' }).then(res => {
                if (res && res.error && typeof localStorage !== 'undefined') {
                    const localData = localStorage.getItem('requestly_rules_fallback');
                    resolve(localData ? JSON.parse(localData) : []);
                } else {
                    resolve(res.rules || []);
                }
            });
        }
    });
}

export function saveRules(rules) {
    return new Promise(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({rules}, resolve);
        } else {
            // Use the bulk handler for reliability over the bridge
            webBridgeCall({ type: 'SET_RULES_BULK', rules }).then(res => {
                if (res && res.error && typeof localStorage !== 'undefined') {
                    localStorage.setItem('requestly_rules_fallback', JSON.stringify(rules));
                }
                resolve();
            });
        }
    });
}

export function generateId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

export async function addRule(rule) {
    const rules = await getRules();
    const newRule = {
        id: generateId(),
        name: rule.name || 'Untitled Rule',
        type: rule.type || RULE_TYPES.REDIRECT,
        sourcePattern: rule.sourcePattern || '',
        destination: rule.destination || '',
        findText: rule.findText || '',
        replaceText: rule.replaceText || '',
        headersAdd: rule.headersAdd || {},
        headersRemove: rule.headersRemove || [],
        headersModify: rule.headersModify || {},
        responseBody: rule.responseBody !== undefined ? rule.responseBody : '',
        responseStatus: rule.responseStatus || 200,
        responseHeaders: rule.responseHeaders || {},
        enabled: rule.enabled !== undefined ? rule.enabled : true,
        pinned: rule.pinned !== undefined ? rule.pinned : false,
        createdAt: Date.now(),
    };
    rules.push(newRule);
    await saveRules(rules);
    return newRule;
}

export async function updateRule(id, updates) {
    const rules = await getRules();
    const idx = rules.findIndex(r => r.id === id);
    if (idx === -1) return null;
    rules[idx] = {...rules[idx], ...updates};
    await saveRules(rules);
    return rules[idx];
}

export async function deleteRule(id) {
    const rules = await getRules();
    const filtered = rules.filter(r => r.id !== id);
    await saveRules(filtered);
}

export async function toggleRule(id) {
    const rules = await getRules();
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    return updateRule(id, {enabled: !rule.enabled});
}

// ── Build declarativeNetRequest rules from user rules ──────────────────────

export function buildDNRRules(userRules) {
    const dnrRules = [];
    let priority = 1;

    for (const rule of userRules) {
        if (!rule.sourcePattern && rule.type !== RULE_TYPES.REPLACE && rule.type !== RULE_TYPES.HEADERS) continue;

        const id = toDNRId(rule.id);
        const resourceTypes = (rule.type === RULE_TYPES.REDIRECT) ? ['main_frame'] : allResourceTypes();

        if (rule.type === RULE_TYPES.BLOCK) {
            const condition = {resourceTypes};
            if (isRegexPattern(rule.sourcePattern)) {
                condition.regexFilter = cleanRegex(rule.sourcePattern);
            } else {
                condition.regexFilter = escapeForRegex(rule.sourcePattern, false);
            }

            dnrRules.push({
                id,
                priority,
                action: {type: 'block'},
                condition,
            });
        } else if (rule.type === RULE_TYPES.REDIRECT) {
            if (!rule.destination) continue;

            const condition = {resourceTypes};
            let finalRegex = '';

            if (isRegexPattern(rule.sourcePattern)) {
                finalRegex = cleanRegex(rule.sourcePattern);
            } else {
                const hasWildcard = rule.sourcePattern.includes('*');
                // Capture wildcards so $1, $2 work
                const escapedValue = escapeForRegex(rule.sourcePattern, hasWildcard);
                // Only anchor if it's a "Wildcard" pattern, else it's a loose "Contains"
                finalRegex = hasWildcard ? `^${escapedValue}$`.replace('.*://', '(http|https)://') : escapedValue;
            }

            dnrRules.push({
                id,
                priority,
                action: {
                    type: 'redirect',
                    redirect: {
                        regexSubstitution: prepareSubstitution(rule.destination),
                    },
                },
                condition: {...condition, regexFilter: finalRegex},
            });
        } else if (rule.type === RULE_TYPES.REPLACE) {
            const condition = {resourceTypes};
            let finalRegex = '';
            let substitution = '';

            const sourceRegex = isRegexPattern(rule.sourcePattern)
                ? cleanRegex(rule.sourcePattern)
                : escapeForRegex(rule.sourcePattern);

            if (!rule.findText) {
                // Full replace: Source -> Replace
                finalRegex = sourceRegex.startsWith('^') ? sourceRegex : '^' + sourceRegex;
                if (!finalRegex.endsWith('$')) finalRegex += '$';
                substitution = prepareSubstitution(rule.replaceText, 0);
            } else {
                // Substring replace: Source (scope) -> Find (target) -> Replace
                // Find Text only supports plain text and * wildcards (escaped as literal)
                const findAsLiteral = escapeForRegex(rule.findText);

                // Ensure source doesn't have an end-anchor
                const baseSource = sourceRegex.replace(/\$$/, '');

                // Match: prefix (Group 1) -> target -> suffix (Group 2)
                // We use non-greedy matching .*? for the prefix
                finalRegex = `^((?:${baseSource}).*?)${findAsLiteral}(.*)$`;

                // Substitute: \1 (prefix), ReplaceText, \2 (suffix)
                substitution = `\\1${prepareSubstitution(rule.replaceText, 0)}\\2`;
            }

            dnrRules.push({
                id,
                priority,
                action: {
                    type: 'redirect',
                    redirect: {regexSubstitution: substitution},
                },
                condition: {...condition, regexFilter: finalRegex},
            });
        } else if (rule.type === RULE_TYPES.HEADERS) {
            const condition = {resourceTypes};
            let finalRegex = '';

            if (isRegexPattern(rule.sourcePattern)) {
                finalRegex = cleanRegex(rule.sourcePattern);
            } else {
                const hasWildcard = rule.sourcePattern.includes('*');
                const escapedValue = escapeForRegex(rule.sourcePattern, hasWildcard);
                finalRegex = hasWildcard ? `^${escapedValue}$`.replace('.*://', '(http|https)://') : escapedValue;
            }

            // Build modifyHeaders action
            const requestHeaders = [];

            // Add new headers
            if (rule.headersAdd && typeof rule.headersAdd === 'object') {
                for (const [header, value] of Object.entries(rule.headersAdd)) {
                    if (header.trim()) {
                        requestHeaders.push({
                            header: header.trim(),
                            operation: 'set',
                            value: String(value)
                        });
                    }
                }
            }

            // Remove headers
            if (rule.headersRemove && Array.isArray(rule.headersRemove)) {
                for (const header of rule.headersRemove) {
                    if (header.trim()) {
                        requestHeaders.push({
                            header: header.trim(),
                            operation: 'remove'
                        });
                    }
                }
            }

            // Modify headers (overwrite existing)
            if (rule.headersModify && typeof rule.headersModify === 'object') {
                for (const [header, value] of Object.entries(rule.headersModify)) {
                    if (header.trim()) {
                        requestHeaders.push({
                            header: header.trim(),
                            operation: 'set',
                            value: String(value)
                        });
                    }
                }
            }

            // Only add rule if there are headers to modify
            if (requestHeaders.length > 0) {
                dnrRules.push({
                    id,
                    priority,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders,
                    },
                    condition: {...condition, regexFilter: finalRegex},
                });
            }
        }
        priority++;
    }
    return dnrRules;
}

// ── DNR Helpers ────────────────────────────────────────────────────────────

function isRegexPattern(str) {
    return typeof str === 'string' && str.startsWith('/') && str.endsWith('/');
}

function cleanRegex(str) {
    return str.slice(1, -1);
}

function wildcardToUrlFilter(pattern) {
    return pattern;
}

function escapeForRegex(str, captureWildcards = false) {
    const escaped = str.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return captureWildcards ? escaped.replace(/\*/g, '(.*)') : escaped.replace(/\*/g, '.*');
}

function prepareSubstitution(str, shift = 0) {
    // Broadly supports {$1}, ${1}, or $1
    return (str || '').replace(/(?:\$\{?|\{\$?|\$)(\d+)\}?/g, (match, num) => {
        return '\\' + (parseInt(num) + shift);
    });
}

/**
 * Checks if a rule matches the given URL for content script indicator logic.
 */
export function doesRuleMatchUrl(rule, url) {
    if (!rule.enabled || !url) return false;

    let pattern = '';
    let isRegex = false;

    if (!rule.sourcePattern) return false;
    pattern = rule.sourcePattern;
    isRegex = isRegexPattern(pattern);

    // 1. Precise Match
    let exactMatch = false;

    if (isRegex) {
        try {
            const re = new RegExp(cleanRegex(pattern));
            exactMatch = re.test(url);
        } catch (e) {
            exactMatch = false;
        }
    } else {
        const regexStr = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');

        try {
            const re = new RegExp(`^${regexStr}$`.replace('.*://', '(http|https)://'));
            const reLoose = new RegExp(regexStr.replace('.*://', '(http|https)://'));
            exactMatch = re.test(url) || reLoose.test(url);
        } catch (e) {
            exactMatch = false;
        }
    }

    if (exactMatch) return true;

    // 2. Loose Domain Fallback (for sub-resource rules targeted at the current tab)
    try {
        const host = new URL(url).hostname;
        if (host) {
            // Clean up pattern to compare without slashes or escapes
            const cleanPat = pattern.replace(/\\/g, '');

            // Use boundary-aware check for the hostname
            // This ensures we only match if the hostname is a distinct part of the pattern
            const escapedHost = host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const hostRegex = new RegExp('(^|[^a-z0-9.-])' + escapedHost + '($|[^a-z0-9.-])', 'i');

            if (hostRegex.test(cleanPat)) return true;
        }
    } catch (e) {
        // Ignore invalid URLs
    }

    return false;
}

function toDNRId(ruleId) {
    // DNR rule IDs must be positive integers <= 2^31-1
    // We take a stable modulo to avoid collisions from timestamp-based IDs
    return (ruleId % 2147483000) + 1;
}

function allResourceTypes() {
    return [
        'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
        'font', 'object', 'xmlhttprequest', 'ping', 'csp_report',
        'media', 'websocket', 'other',
    ];
}

// ── Response Interception Helper ───────────────────────────────────
// Export response rules for content script to use
export function getResponseRules() {
    return new Promise(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get({rules: []}, data => {
                const responseRules = (data.rules || [])
                    .filter(r => r.enabled && r.type === RULE_TYPES.RESPONSE);
                resolve(responseRules);
            });
        } else {
            getRules().then(rules => {
                const responseRules = rules.filter(r => r.enabled && r.type === RULE_TYPES.RESPONSE);
                resolve(responseRules);
            });
        }
    });
}

export function matchesResponseRule(url, rule) {
    if (!rule.sourcePattern || !url) return false;

    const pattern = rule.sourcePattern;
    const isRegex = isRegexPattern(pattern);

    if (isRegex) {
        try {
            const re = new RegExp(cleanRegex(pattern));
            return re.test(url);
        } catch (e) {
            return false;
        }
    } else {
        const regexStr = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');

        try {
            const re = new RegExp(regexStr);
            return re.test(url);
        } catch (e) {
            return false;
        }
    }
}