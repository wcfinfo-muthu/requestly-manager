// popup.js — Popup UI logic
import { getRules, addRule, deleteRule, toggleRule, updateRule, RULE_TYPES } from './rules.js';

const $ = id => document.getElementById(id);

const masterToggle = $('masterToggle');
const quickSource = $('quickSource');
const quickType = $('quickType');
const quickDestination = $('quickDestination');
const quickFind = $('quickFind');
const quickReplace = $('quickReplace');
const sourceGroup = $('sourceGroup');
const destinationGroup = $('destinationGroup');
const replaceGroup = $('replaceGroup');
const addRuleBtn = $('addRuleBtn');
const rulesList = $('rulesList');
const emptyState = $('emptyState');
const rulesCount = $('rulesCount');
const openOptionsBtn = $('openOptionsBtn');

let currentTab = 'latest';
const tabLatest = $('tabLatest');
const tabPinned = $('tabPinned');

tabLatest.addEventListener('click', () => {
  currentTab = 'latest';
  tabLatest.classList.add('active');
  tabPinned.classList.remove('active');
  renderRules();
});

tabPinned.addEventListener('click', () => {
  currentTab = 'pinned';
  tabPinned.classList.add('active');
  tabLatest.classList.remove('active');
  renderRules();
});

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  chrome.storage.sync.get({ extensionEnabled: true }, ({ extensionEnabled }) => {
    masterToggle.checked = extensionEnabled;
  });

  await renderRules();
}

// ── Master toggle ──────────────────────────────────────────────────────────
masterToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ extensionEnabled: masterToggle.checked });
});

// Sync UI if changed in another popup/tab
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.extensionEnabled !== undefined) {
    if (masterToggle) masterToggle.checked = changes.extensionEnabled.newValue;
  }
});


// ── Rule type switcher ─────────────────────────────────────────────────────
quickType.addEventListener('change', updateFormFields);

function updateFormFields() {
  const type = quickType.value;
  sourceGroup.classList.toggle('hidden', type === RULE_TYPES.REPLACE);
  destinationGroup.classList.toggle('hidden', type === RULE_TYPES.REPLACE || type === RULE_TYPES.BLOCK);
  replaceGroup.classList.toggle('hidden', type !== RULE_TYPES.REPLACE);
}

// ── Add rule ────────────────────────────────────────────────────────────────
addRuleBtn.addEventListener('click', async () => {
  const source = quickSource.value.trim();
  const type = quickType.value;
  const dest = quickDestination.value.trim();
  const find = quickFind.value.trim();
  const rep = quickReplace.value.trim();

  if (type !== RULE_TYPES.REPLACE && !source) {
    quickSource.focus();
    quickSource.classList.add('error-shake');
    setTimeout(() => quickSource.classList.remove('error-shake'), 600);
    return;
  }

  if (type === RULE_TYPES.REDIRECT && !dest) {
    quickDestination.focus();
    return;
  }

  if (type === RULE_TYPES.REPLACE && !find) {
    quickFind.focus();
    quickFind.classList.add('error-shake');
    setTimeout(() => quickFind.classList.remove('error-shake'), 600);
    return;
  }

  // Generate a short display name
  const sourceToUse = type === RULE_TYPES.REPLACE ? find : source;
  const name = sourceToUse.length > 30 ? sourceToUse.substring(0, 30) + '…' : sourceToUse;

  await addRule({
    name,
    type,
    sourcePattern: source,
    destination: dest,
    findText: find,
    replaceText: rep,
    enabled: true,
  });

  // Clear form
  quickSource.value = '';
  quickDestination.value = '';
  quickFind.value = '';
  quickReplace.value = '';

  await renderRules();
});

// Allow Enter key to submit quick add
quickSource.addEventListener('keydown', e => { if (e.key === 'Enter') addRuleBtn.click(); });
quickDestination.addEventListener('keydown', e => { if (e.key === 'Enter') addRuleBtn.click(); });

// ── Render rules ────────────────────────────────────────────────────────────
async function renderRules() {
  const allRules = await getRules();

  let rules = [];
  if (currentTab === 'latest') {
    rules = [...allRules].reverse().slice(0, 5);
  } else {
    rules = allRules.filter(r => r.pinned).reverse().slice(0, 5);
  }

  rulesCount.textContent = `${rules.length} rule${rules.length !== 1 ? 's' : ''}`;

  // Remove existing cards (keep emptyState)
  Array.from(rulesList.querySelectorAll('.rule-card')).forEach(el => el.remove());

  if (rules.length === 0) {
    emptyState.style.display = '';
    return;
  }
  emptyState.style.display = 'none';

  rules.forEach(rule => {
    const li = document.createElement('li');
    li.className = `rule-card${rule.enabled ? '' : ' disabled'}`;
    li.dataset.id = rule.id;

    // Star/Pin filled if pinned
    const pinFill = rule.pinned ? 'currentColor' : 'none';

    li.innerHTML = `
      <label class="rule-toggle master-toggle" title="Enable / Disable">
        <input type="checkbox" ${rule.enabled ? 'checked' : ''} />
        <span class="slider"></span>
      </label>
      <div class="rule-body">
        <div class="rule-header">
          <div class="rule-name">${escapeHtml(rule.name)}</div>
          <span class="rule-badge badge-${rule.type}">${badgeLabel(rule.type)}</span>
        </div>
        <div class="rule-meta">
          <span class="rule-source">${escapeHtml(rule.sourcePattern)}</span>
        </div>
      </div>
      <div class="rule-actions">
        <button class="icon-btn pin" title="${rule.pinned ? 'Unpin' : 'Pin to top'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${pinFill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
        <button class="icon-btn delete" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </div>
    `;

    // Toggle enable
    li.querySelector('input[type=checkbox]').addEventListener('change', async () => {
      await toggleRule(rule.id);
      await renderRules();
    });

    // Toggle pin
    li.querySelector('.pin').addEventListener('click', async () => {
      // If pinning, block if already at max 5
      if (!rule.pinned && allRules.filter(r => r.pinned).length >= 5) {
        alert("You can only pin a maximum of 5 rules.");
        return;
      }
      await updateRule(rule.id, { pinned: !rule.pinned });
      await renderRules();
    });

    // Delete
    li.querySelector('.delete').addEventListener('click', async () => {
      li.style.opacity = '0';
      li.style.transform = 'translateX(8px)';
      li.style.transition = 'all 0.2s';
      await new Promise(r => setTimeout(r, 200));
      await deleteRule(rule.id);
      await renderRules();
    });

    rulesList.appendChild(li);
  });
}

// ── Open options ─────────────────────────────────────────────────────────────
openOptionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ── Utilities ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function badgeLabel(type) {
  return { redirect: 'Redirect', block: 'Block', replace: 'Replace' }[type] || type;
}

init();
