// options.js — Options page logic
import {getRules, addRule, updateRule, deleteRule, toggleRule, saveRules, RULE_TYPES, webBridgeCall} from './rules.js';

// ── Web Environment Mock ───────────────────────────────────────────────────
if (typeof chrome === 'undefined' || !chrome.storage) {
    window.chrome = window.chrome || {};
    window.chrome.storage = {
        sync: {
            get: (keys, callback) => {
                const keysObj = typeof keys === 'string' ? { [keys]: null } : (Array.isArray(keys) ? keys.reduce((acc, k) => ({ ...acc, [k]: null }), {}) : keys);
                
                if (keysObj && keysObj.extensionEnabled !== undefined) {
                    webBridgeCall({ type: 'GET_ENABLED' }).then(res => {
                        callback({ extensionEnabled: res.extensionEnabled !== false });
                    });
                } else if (keysObj && keysObj.rules !== undefined) {
                    webBridgeCall({ type: 'GET_RULES' }).then(res => {
                        if (res.error) {
                            const localData = localStorage.getItem('requestly_rules_fallback');
                            callback({ rules: localData ? JSON.parse(localData) : [] });
                        } else {
                            callback({ rules: res.rules || [] });
                        }
                    });
                } else {
                    callback(keysObj);
                }
            },
            set: (data, callback) => {
                const type = data.rules ? 'SET_RULES_BULK' : (data.extensionEnabled !== undefined ? 'SET_ENABLED' : null);
                if (type) {
                    webBridgeCall({ type, ...data }).then(res => {
                        if (res.error && data.rules) {
                            localStorage.setItem('requestly_rules_fallback', JSON.stringify(data.rules));
                        }
                        if (callback) callback();
                    });
                } else if (callback) {
                    callback();
                }
            }
        }
    };

    // Update connection status UI
    webBridgeCall({ type: 'GET_ENABLED' }).then(res => {
        const indicator = document.getElementById('extStatus');
        const text = indicator?.querySelector('.status-text');
        if (indicator && !res.error) {
            indicator.classList.add('connected');
            if (text) text.textContent = 'Extension connected';
        } else if (text) {
            text.textContent = 'Demo Mode (Extension not detected)';
        }
    });
}

// ── Page Navigation ────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        const page = link.dataset.page;
        document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        link.classList.add('active');
        const pageTarget = document.getElementById(`page-${page}`);
        if (pageTarget) pageTarget.classList.add('active');
    });
});

// ── Master Toggle ──────────────────────────────────────────────────────────
const masterToggle = document.getElementById('masterToggle');
chrome.storage.sync.get({extensionEnabled: true}, ({extensionEnabled}) => {
    if (masterToggle) masterToggle.checked = extensionEnabled;
});
if (masterToggle) {
    masterToggle.addEventListener('change', () => {
        chrome.storage.sync.set({extensionEnabled: masterToggle.checked});
    });
}

// Sync UI if changed in another popup/tab
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync') {
            if (changes.extensionEnabled !== undefined && masterToggle) {
                masterToggle.checked = changes.extensionEnabled.newValue;
            }
            if (changes.rules !== undefined) {
                renderTable(document.getElementById('searchInput')?.value || '');
            }
        }
    });
}

// ── Modal State ────────────────────────────────────────────────────────────
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const editRuleId = document.getElementById('editRuleId');
const fieldName = document.getElementById('fieldName');
const fieldSource = document.getElementById('fieldSource');
const fieldDest = document.getElementById('fieldDestination');
const fieldFind = document.getElementById('fieldFind');
const fieldReplace = document.getElementById('fieldReplace');
const sourceField = document.getElementById('sourceField');
const destinationField = document.getElementById('destinationField');
const findField = document.getElementById('findField');
const replaceField = document.getElementById('replaceField');
const typeSelector = document.getElementById('typeSelector');
let currentType = RULE_TYPES.REDIRECT;

function openModal(rule = null) {
    if (!modalOverlay) return;
    editRuleId.value = rule ? rule.id : '';
    modalTitle.textContent = rule ? 'Edit Rule' : 'New Rule';
    fieldName.value = rule?.name || '';
    fieldSource.value = rule?.sourcePattern || '';
    fieldDest.value = rule?.destination || '';
    fieldFind.value = rule?.findText || '';
    fieldReplace.value = rule?.replaceText || '';
    setType(rule?.type || RULE_TYPES.REDIRECT);
    modalOverlay.classList.remove('hidden');
    fieldName.focus();
}

function closeModal() {
    if (modalOverlay) modalOverlay.classList.add('hidden');
}

function setType(type) {
    currentType = type;
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    if (sourceField) sourceField.classList.remove('hidden');
    if (destinationField) destinationField.classList.toggle('hidden', type !== RULE_TYPES.REDIRECT);
    if (findField) findField.classList.toggle('hidden', type !== RULE_TYPES.REPLACE);
    if (replaceField) replaceField.classList.toggle('hidden', type !== RULE_TYPES.REPLACE);
}

if (typeSelector) {
    typeSelector.addEventListener('click', e => {
        const btn = e.target.closest('.type-btn');
        if (btn) {
            e.preventDefault();
            setType(btn.dataset.type);
        }
    });
}

const openBtn = document.getElementById('openModalBtn');
if (openBtn) {
    openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
    });
}

document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
document.getElementById('cancelModalBtn')?.addEventListener('click', closeModal);
modalOverlay?.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
});

// ── Save Rule ──────────────────────────────────────────────────────────────
const saveRuleBtn = document.getElementById('saveRuleBtn');
if (saveRuleBtn) {
    saveRuleBtn.addEventListener('click', async () => {
        const id = editRuleId.value;
        const name = fieldName.value.trim() || fieldSource.value.trim().substring(0, 40) || 'Untitled';

        const data = {
            name,
            type: currentType,
            sourcePattern: fieldSource.value.trim(),
            destination: fieldDest.value.trim(),
            findText: fieldFind.value.trim(),
            replaceText: fieldReplace.value.trim(),
        };

        if (!data.sourcePattern) {
            fieldSource.focus();
            fieldSource.classList.add('error-shake');
            setTimeout(() => fieldSource.classList.remove('error-shake'), 600);
            return;
        }

        if (currentType === RULE_TYPES.REPLACE && !data.replaceText) {
            fieldReplace.focus();
            fieldReplace.classList.add('error-shake');
            setTimeout(() => fieldReplace.classList.remove('error-shake'), 600);
            return;
        }

        if (id) {
            await updateRule(Number(id), data);
        } else {
            await addRule({...data, enabled: true});
        }
        closeModal();
        await renderTable(document.getElementById('searchInput')?.value || '');
    });
}

// ── Rules Table ────────────────────────────────────────────────────────────
const rulesBody = document.getElementById('rulesBody');
const tableEmpty = document.getElementById('tableEmpty');
const searchInput = document.getElementById('searchInput');

async function renderTable(query = '') {
    if (!rulesBody) return;
    let rules = await getRules();
    if (query) {
        const q = query.toLowerCase();
        rules = rules.filter(r =>
            r.name?.toLowerCase().includes(q) ||
            r.sourcePattern?.toLowerCase().includes(q) ||
            r.destination?.toLowerCase().includes(q) ||
            r.findText?.toLowerCase().includes(q)
        );
    }

    rulesBody.innerHTML = '';

    if (rules.length === 0) {
        if (tableEmpty) tableEmpty.classList.remove('hidden');
        return;
    }
    if (tableEmpty) tableEmpty.classList.add('hidden');

    rules.forEach(rule => {
        const tr = document.createElement('tr');
        tr.className = rule.enabled ? '' : 'disabled-row';
        tr.dataset.id = rule.id;

        let sourceDisplay = rule.sourcePattern || '*';
        let destDisplay = rule.destination || '—';

        if (rule.type === RULE_TYPES.REPLACE) {
            if (rule.findText) {
                destDisplay = `${rule.findText} ➜ ${rule.replaceText || 'null'}`;
            } else {
                destDisplay = `➜ ${rule.replaceText || 'null'}`;
            }
        }

        const pinFill = rule.pinned ? 'currentColor' : 'none';

        tr.innerHTML = `
      <td>
        <label class="toggle">
          <input type="checkbox" ${rule.enabled ? 'checked' : ''}/>
          <span class="slider"></span>
        </label>
      </td>
      <td>${escapeHtml(rule.name)}</td>
      <td><span class="badge badge-${rule.type}">${badgeLabel(rule.type)}</span></td>
      <td><span class="monospace truncate" title="${escapeHtml(sourceDisplay)}">${escapeHtml(sourceDisplay)}</span></td>
      <td><span class="monospace truncate" title="${escapeHtml(destDisplay)}">${escapeHtml(destDisplay)}</span></td>
      <td>
        <div class="action-btns">
          <button class="icon-btn pin" title="${rule.pinned ? 'Unpin' : 'Pin to top'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${pinFill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
          <button class="icon-btn edit" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button class="icon-btn delete" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
      </td>
    `;

        tr.querySelector('input[type=checkbox]').addEventListener('change', async () => {
            await toggleRule(rule.id);
            await renderTable(searchInput?.value || '');
        });

        tr.querySelector('.pin').addEventListener('click', async () => {
            const allRules = await getRules();
            if (!rule.pinned && allRules.filter(r => r.pinned).length >= 5) {
                alert("You can only pin a maximum of 5 rules.");
                return;
            }
            await updateRule(rule.id, {pinned: !rule.pinned});
            await renderTable(searchInput?.value || '');
        });

        tr.querySelector('.edit').addEventListener('click', async () => {
            const all = await getRules();
            const r = all.find(x => x.id === rule.id);
            if (r) openModal(r);
        });

        tr.querySelector('.delete').addEventListener('click', async () => {
            if (!confirm(`Delete rule "${rule.name}"?`)) return;
            await deleteRule(rule.id);
            await renderTable(searchInput?.value || '');
        });

        rulesBody.appendChild(tr);
    });
}

if (searchInput) {
    searchInput.addEventListener('input', () => renderTable(searchInput.value));
}

// ── Bulk Delete ────────────────────────────────────────────────────────────
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', async () => {
        if (!confirm('Delete ALL rules? This cannot be undone.')) return;
        await saveRules([]);
        await renderTable(searchInput?.value || '');
    });
}

// ── Export ─────────────────────────────────────────────────────────────────
const exportBtn = document.getElementById('exportBtn');
if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
        const rules = await getRules();
        const json = JSON.stringify(rules, null, 2);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `url-rewriter-rules-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

// ── Import ─────────────────────────────────────────────────────────────────
const importFile = document.getElementById('importFile');
if (importFile) {
    importFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        const status = document.getElementById('importStatus');
        if (!file) return;

        if (status) {
            status.textContent = '⌛ Processing import...';
            status.style.color = 'var(--cyan)';
            status.classList.remove('hidden');
        }

        try {
            const text = await file.text();
            const imported = JSON.parse(text);
            if (!Array.isArray(imported)) throw new Error('Invalid format: Expected a JSON array of rules.');

            const existing = await getRules();
            const merged = [...existing, ...imported.map(rule => ({
                ...rule,
                id: Date.now() + Math.floor(Math.random() * 100000), // Ensure fresh IDs for safety
                enabled: rule.enabled !== undefined ? rule.enabled : true,
                createdAt: rule.createdAt || Date.now()
            }))];

            await saveRules(merged);
            
            if (status) {
                status.textContent = `✓ Successfully imported ${imported.length} rules.`;
                status.style.color = 'var(--green)';
                setTimeout(() => status.classList.add('hidden'), 4000);
            }
            await renderTable(searchInput?.value || '');
        } catch (err) {
            if (status) {
                status.style.color = '#ef4444';
                status.textContent = `✗ Import failed: ${err.message}`;
            }
            console.error('[ImportError]', err);
        }
        e.target.value = '';
    });
}

// ── Utilities ──────────────────────────────────────────────────────────────
function escapeHtml(str = '') {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function badgeLabel(type) {
    return {redirect: 'Redirect', block: 'Block', replace: 'Replace'}[type] || type;
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    closeModal();
    const params = new URLSearchParams(window.location.search);
    const filter = params.get('filter');
    if (filter && searchInput) {
        searchInput.value = filter;
    }

    // Attempt several renders as bridge initializes
    await renderTable(searchInput?.value || '');
    setTimeout(() => renderTable(searchInput?.value || ''), 100);
    setTimeout(() => renderTable(searchInput?.value || ''), 600);
});

// Debug
window.refreshRules = () => renderTable(searchInput?.value || '');
