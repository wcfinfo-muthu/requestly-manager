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

    const resourceTypes = allResourceTypes();
    const id = toDNRId(rule.id);

    if (rule.type === RULE_TYPES.BLOCK) {
      const condition = { resourceTypes };
      if (isRegexPattern(rule.sourcePattern)) {
        condition.regexFilter = cleanRegex(rule.sourcePattern);
      } else {
        condition.urlFilter = rule.sourcePattern;
      }

      dnrRules.push({
        id,
        priority,
        action: { type: 'block' },
        condition,
      });
    } else if (rule.type === RULE_TYPES.REDIRECT) {
      if (!rule.destination) continue;
      
      const condition = { resourceTypes };
      if (isRegexPattern(rule.sourcePattern)) {
        condition.regexFilter = cleanRegex(rule.sourcePattern);
      } else {
        condition.regexFilter = escapeForRegex(rule.sourcePattern);
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
        condition,
      });
    } else if (rule.type === RULE_TYPES.REPLACE) {
      const condition = { resourceTypes };
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
          redirect: { regexSubstitution: substitution },
        },
        condition: { ...condition, regexFilter: finalRegex },
      });
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

function escapeForRegex(str) {
  return str.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
}

function prepareSubstitution(str, shift = 0) {
  return (str || '').replace(/\{?\$(\d)\}?/g, (match, num) => {
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
