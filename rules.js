// rules.js — Shared rule management utilities

export const RULE_TYPES = {
  REDIRECT: 'redirect',
  BLOCK: 'block',
  REPLACE: 'replace',
};

// ── Storage helpers ────────────────────────────────────────────────────────

export function getRules() {
  return new Promise(resolve => {
    chrome.storage.sync.get({ rules: [] }, data => resolve(data.rules));
  });
}

export function saveRules(rules) {
  return new Promise(resolve => {
    chrome.storage.sync.set({ rules }, resolve);
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
  rules[idx] = { ...rules[idx], ...updates };
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
  return updateRule(id, { enabled: !rule.enabled });
}

// ── Build declarativeNetRequest rules from user rules ──────────────────────

export function buildDNRRules(userRules) {
  const dnrRules = [];
  let priority = 1;

  for (const rule of userRules) {
    if (!rule.sourcePattern && rule.type !== RULE_TYPES.REPLACE) continue;

    const urlFilter = rule.sourcePattern ? wildcardToUrlFilter(rule.sourcePattern) : undefined;
    // resourceTypes are assigned statically based on the rule type
    const resourceTypes = rule.type === RULE_TYPES.REDIRECT ? ['main_frame'] : allResourceTypes();

    if (rule.type === RULE_TYPES.BLOCK) {
      dnrRules.push({
        id: toDNRId(rule.id),
        priority,
        action: { type: 'block' },
        condition: {
          urlFilter,
          resourceTypes,
        },
      });
    } else if (rule.type === RULE_TYPES.REDIRECT) {
      if (!rule.destination) continue;
      dnrRules.push({
        id: toDNRId(rule.id),
        priority,
        action: {
          type: 'redirect',
          redirect: { url: rule.destination },
        },
        condition: {
          urlFilter,
          resourceTypes,
        },
      });
    } else if (rule.type === RULE_TYPES.REPLACE) {
      // Replace uses regexSubstitution
      if (!rule.findText) continue;
      const regexFilter = escapeForRegex(rule.findText);
      dnrRules.push({
        id: toDNRId(rule.id),
        priority,
        action: {
          type: 'redirect',
          redirect: {
            regexSubstitution: rule.replaceText || '',
          },
        },
        condition: {
          regexFilter,
          resourceTypes,
        },
      });
    }
    priority++;
  }
  return dnrRules;
}
// ── DNR Helpers ────────────────────────────────────────────────────────────

function wildcardToUrlFilter(pattern) {
  // Chrome's urlFilter supports | for start-anchor and * for wildcard natively
  // Just pass through — user should use patterns like *://example.com/*
  return pattern;
}

function escapeForRegex(str) {
  return str.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
}

/**
 * Checks if a rule matches the given URL for content script indicator logic.
 */
export function doesRuleMatchUrl(rule, url) {
  if (!rule.enabled || !url) return false;

  if (rule.type === RULE_TYPES.REPLACE) {
    if (!rule.findText) return false;
    return url.includes(rule.findText);
  }

  if (!rule.sourcePattern) return false;

  // Convert wildcard pattern to a regex for checking current tab URL
  const pattern = rule.sourcePattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape special chars (not *)
    .replace(/\*/g, '.*'); // replace * with .*

  try {
    const re = new RegExp(`^${pattern}$`.replace('.*://', '(http|https)://'));
    // If user provided *:// we match both, otherwise match exact.
    // Also try without anchors if exact fail for better UX.
    const reLoose = new RegExp(pattern.replace('.*://', '(http|https)://'));
    return re.test(url) || reLoose.test(url);
  } catch (e) {
    return false;
  }
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
