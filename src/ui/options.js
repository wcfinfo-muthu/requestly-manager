// options.js — Options page logic
import {getRules, addRule, updateRule, deleteRule, toggleRule, saveRules, RULE_TYPES, webBridgeCall} from '../rules/engine.js';

// ── Web Environment Mock ───────────────────────────────────────────────────
// This mock only applies in web environments (non-extension pages)
// In extension context, native chrome.storage.sync is available and used directly
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

}

// ── Connection Check (works in both web and extension environments) ─────────
let connectionRetries = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Check if background service worker is connected
 * Includes timeout, retry logic, and detailed error handling
 */
async function checkExtensionConnection() {
    const indicator = document.getElementById('extStatus');
    const text = indicator?.querySelector('.status-text');

    if (!indicator || !text) return;

    try {
        // Send message with timeout (2 seconds)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 2000)
        );

        const messagePromise = webBridgeCall({ type: 'GET_ENABLED' });
        const response = await Promise.race([messagePromise, timeoutPromise]);

        // Success: Extension is connected
        if (response && !response.error) {
            indicator.classList.remove('disconnected');
            indicator.classList.add('connected');
            text.textContent = '✓ Extension active';
            connectionRetries = 0; // Reset retry counter
            console.log('[Options] ✓ Extension active');
        } else {
            throw new Error(response?.error || 'No response from extension');
        }
    } catch (error) {
        console.warn(`[Options] Connection check failed (attempt ${connectionRetries + 1}/${MAX_RETRIES}):`, error.message);

        // Try to reconnect with exponential backoff
        if (connectionRetries < MAX_RETRIES) {
            connectionRetries++;
            const delay = RETRY_DELAY * connectionRetries;
            console.log(`[Options] Retrying in ${delay}ms...`);
            setTimeout(checkExtensionConnection, delay);
        } else {
            // After max retries, show disconnected state
            indicator.classList.remove('connected');
            indicator.classList.add('disconnected');
            text.textContent = '✗ Extension disconnected';
            console.error('[Options] ✗ Extension connection failed after 3 retries');
        }
    }
}

// Check connection on page load
document.addEventListener('DOMContentLoaded', checkExtensionConnection);

// Periodically verify connection (every 10 seconds)
setInterval(checkExtensionConnection, 10000);

// Also check when page becomes visible
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        checkExtensionConnection();
    }
});

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
const headersField = document.getElementById('headersField');
const responseField = document.getElementById('responseField');
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

    // Reset headers form
    renderHeadersEditor(rule?.headersAdd || {}, rule?.headersRemove || [], rule?.headersModify || {});

    // Reset response form
    if (responseField) {
        const bodyField = responseField.querySelector('[name="responseBody"]');
        const statusField = responseField.querySelector('[name="responseStatus"]');
        if (bodyField) bodyField.value = typeof rule?.responseBody === 'string' ? rule.responseBody : JSON.stringify(rule?.responseBody || '', null, 2);
        if (statusField) statusField.value = rule?.responseStatus || 200;
    }

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
    if (headersField) headersField.classList.toggle('hidden', type !== RULE_TYPES.HEADERS);
    if (responseField) responseField.classList.toggle('hidden', type !== RULE_TYPES.RESPONSE);
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

// ── Headers Editor Helper ──────────────────────────────────────────────────
function renderHeadersEditor(headersAdd = {}, headersRemove = [], headersModify = {}) {
    if (!headersField) return;

    const container = headersField.querySelector('.headers-editor-container') || document.createElement('div');
    container.className = 'headers-editor-container';

    let html = `
        <div class="headers-section">
            <h4>Add Headers</h4>
            <div class="headers-list" data-type="add">
    `;

    // Render add headers
    for (const [key, value] of Object.entries(headersAdd)) {
        html += `
            <div class="header-row">
                <input type="text" class="header-name" value="${escapeHtml(key)}" placeholder="Header name">
                <input type="text" class="header-value" value="${escapeHtml(value)}" placeholder="Header value">
                <button class="btn-remove-header" type="button">✕</button>
            </div>
        `;
    }
    html += `
                <button class="btn-add-header" type="button" data-type="add">+ Add Header</button>
            </div>
        </div>

        <div class="headers-section">
            <h4>Remove Headers</h4>
            <div class="headers-list" data-type="remove">
    `;

    // Render remove headers
    for (const headerName of headersRemove) {
        html += `
            <div class="header-row">
                <input type="text" class="header-name" value="${escapeHtml(headerName)}" placeholder="Header name">
                <button class="btn-remove-header" type="button">✕</button>
            </div>
        `;
    }
    html += `
                <button class="btn-add-header" type="button" data-type="remove">+ Remove Header</button>
            </div>
        </div>

        <div class="headers-section">
            <h4>Modify Headers</h4>
            <div class="headers-list" data-type="modify">
    `;

    // Render modify headers
    for (const [key, value] of Object.entries(headersModify)) {
        html += `
            <div class="header-row">
                <input type="text" class="header-name" value="${escapeHtml(key)}" placeholder="Header name">
                <input type="text" class="header-value" value="${escapeHtml(value)}" placeholder="Header value">
                <button class="btn-remove-header" type="button">✕</button>
            </div>
        `;
    }
    html += `
                <button class="btn-add-header" type="button" data-type="modify">+ Modify Header</button>
            </div>
        </div>
    `;

    container.innerHTML = html;

    if (!headersField.contains(container)) {
        headersField.innerHTML = '';
        headersField.appendChild(container);
    } else {
        headersField.querySelector('.headers-editor-container').innerHTML = container.innerHTML;
    }

    // Attach event listeners
    container.querySelectorAll('.btn-add-header').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const type = btn.dataset.type;
            const list = btn.closest('.headers-list');
            const newRow = document.createElement('div');
            newRow.className = 'header-row';
            newRow.innerHTML = `
                <input type="text" class="header-name" placeholder="Header name">
                <input type="text" class="${type === 'remove' ? 'hidden' : 'header-value'}" ${type === 'remove' ? '' : ''} placeholder="Header value">
                <button class="btn-remove-header" type="button">✕</button>
            `;
            list.insertBefore(newRow, btn);
            newRow.querySelector('.header-name').focus();
        });
    });

    container.querySelectorAll('.btn-remove-header').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            btn.closest('.header-row').remove();
        });
    });
}

function getHeadersData() {
    const headersAdd = {};
    const headersRemove = [];
    const headersModify = {};

    if (!headersField) return { headersAdd, headersRemove, headersModify };

    // Collect add headers
    const addList = headersField.querySelector('[data-type="add"]');
    if (addList) {
        addList.querySelectorAll('.header-row').forEach(row => {
            const name = row.querySelector('.header-name')?.value.trim();
            const value = row.querySelector('.header-value')?.value.trim();
            if (name) headersAdd[name] = value || '';
        });
    }

    // Collect remove headers
    const removeList = headersField.querySelector('[data-type="remove"]');
    if (removeList) {
        removeList.querySelectorAll('.header-row').forEach(row => {
            const name = row.querySelector('.header-name')?.value.trim();
            if (name) headersRemove.push(name);
        });
    }

    // Collect modify headers
    const modifyList = headersField.querySelector('[data-type="modify"]');
    if (modifyList) {
        modifyList.querySelectorAll('.header-row').forEach(row => {
            const name = row.querySelector('.header-name')?.value.trim();
            const value = row.querySelector('.header-value')?.value.trim();
            if (name) headersModify[name] = value || '';
        });
    }

    return { headersAdd, headersRemove, headersModify };
}

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

        // Collect headers data if headers rule type
        if (currentType === RULE_TYPES.HEADERS) {
            const headersData = getHeadersData();
            data.headersAdd = headersData.headersAdd;
            data.headersRemove = headersData.headersRemove;
            data.headersModify = headersData.headersModify;

            // Validate at least one header operation
            const hasAnyHeader = Object.keys(headersData.headersAdd).length > 0 ||
                                headersData.headersRemove.length > 0 ||
                                Object.keys(headersData.headersModify).length > 0;
            if (!hasAnyHeader) {
                alert('Please add at least one header operation.');
                return;
            }
        }

        // Collect response data if response rule type
        if (currentType === RULE_TYPES.RESPONSE) {
            const bodyField = responseField?.querySelector('[name="responseBody"]');
            const statusField = responseField?.querySelector('[name="responseStatus"]');

            if (!bodyField?.value.trim()) {
                alert('Please enter a response body.');
                bodyField?.focus();
                return;
            }

            const status = parseInt(statusField?.value || '200');
            if (isNaN(status) || status < 100 || status > 599) {
                alert('Response status must be a valid HTTP status code (100-599).');
                statusField?.focus();
                return;
            }

            try {
                // Try to parse as JSON if it looks like JSON
                const body = bodyField.value.trim();
                if (body.startsWith('{') || body.startsWith('[')) {
                    data.responseBody = JSON.parse(body);
                } else {
                    data.responseBody = body;
                }
            } catch (e) {
                data.responseBody = bodyField.value.trim();
            }

            data.responseStatus = status;
            data.responseHeaders = {};
        }

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
        } else if (rule.type === RULE_TYPES.HEADERS) {
            const addCount = Object.keys(rule.headersAdd || {}).length;
            const removeCount = (rule.headersRemove || []).length;
            const modifyCount = Object.keys(rule.headersModify || {}).length;
            const total = addCount + removeCount + modifyCount;
            destDisplay = `${total} header${total !== 1 ? 's' : ''} modified`;
        } else if (rule.type === RULE_TYPES.RESPONSE) {
            const status = rule.responseStatus || 200;
            const bodyPreview = typeof rule.responseBody === 'string'
                ? rule.responseBody.substring(0, 30)
                : JSON.stringify(rule.responseBody).substring(0, 30);
            destDisplay = `${status} • ${bodyPreview}${bodyPreview.length >= 30 ? '...' : ''}`;
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
    return {redirect: 'Redirect', block: 'Block', replace: 'Replace', headers: 'Headers', response: 'Mock Response'}[type] || type;
}

// ── Google OAuth & Sync ────────────────────────────────────────────────────
// Dynamic import for Google services
let GoogleAuth = null;
let GoogleDrive = null;

async function loadGoogleServices() {
    try {
        const module = await import('../services/google.js');
        GoogleAuth = module.GoogleAuth;
        GoogleDrive = module.GoogleDrive;
        await initializeGoogleUI();
    } catch (error) {
        console.warn('Google services not available:', error);
    }
}

async function initializeGoogleUI() {
    const loginBtn = document.getElementById('googleLoginBtn');
    const logoutBtn = document.getElementById('googleLogoutBtn');
    const userProfile = document.getElementById('userProfile');
    const syncStatus = document.querySelector('.sync-status');

    if (!loginBtn || !logoutBtn) return;

    // Check initial auth state
    await updateGoogleUIState();

    // Handle login
    loginBtn.addEventListener('click', async () => {
        try {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Signing in...';

            if (GoogleAuth) {
                await GoogleAuth.login();
                await updateGoogleUIState();
                // Wait a moment for sync to initialize
                setTimeout(() => updateSyncUI(), 500);
            }
        } catch (error) {
            console.error('Login failed:', error);
            alert('Login failed. Make sure to configure Google OAuth credentials.');
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign in with Google';
        }
    });

    // Handle logout
    logoutBtn.addEventListener('click', async () => {
        try {
            logoutBtn.disabled = true;
            if (GoogleAuth) {
                await GoogleAuth.logout();
                await updateGoogleUIState();
                updateSyncUI();
            }
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            logoutBtn.disabled = false;
        }
    });

    // Setup sync listeners
    setupSyncListeners();
}

async function updateGoogleUIState() {
    const loginBtn = document.getElementById('googleLoginBtn');
    const logoutBtn = document.getElementById('googleLogoutBtn');
    const forceSyncBtn = document.getElementById('forceSyncBtn');
    const userProfile = document.getElementById('userProfile');
    const profileEmail = document.getElementById('profileEmail');
    const syncStatus = document.querySelector('.sync-status');

    if (!GoogleAuth) return;

    const isAuthenticated = await GoogleAuth.isAuthenticated();

    if (isAuthenticated) {
        // User is logged in
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'flex';
        if (forceSyncBtn) forceSyncBtn.style.display = 'flex';
        userProfile.classList.remove('hidden');

        // Fetch user profile
        const profile = await GoogleAuth.getUserProfile();
        if (profile?.email) {
            profileEmail.textContent = profile.email;
        }

        // Update sync status
        syncStatus.classList.add('synced');
        syncStatus.classList.remove('syncing');
        syncStatus.querySelector('.sync-text').textContent = 'Synced';

        // Get last sync time
        const tokens = await GoogleAuth.getTokens();
        if (tokens?.issued_at) {
            const lastSync = new Date(tokens.issued_at).toLocaleString();
            document.getElementById('lastSync').textContent = `Last auth: ${lastSync}`;
        }
    } else {
        // User is not logged in
        loginBtn.style.display = 'flex';
        logoutBtn.style.display = 'none';
        if (forceSyncBtn) forceSyncBtn.style.display = 'none';
        userProfile.classList.add('hidden');

        // Update sync status
        syncStatus.classList.remove('synced', 'syncing');
        syncStatus.querySelector('.sync-text').textContent = 'Not synced';
    }
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

    // Load Google services
    await loadGoogleServices();

    // Initialize settings and history
    await initializeSettings();
    await initializeSyncHistory();
});

// ── Sync UI Functions ──────────────────────────────────────────────────────
async function updateSyncUI() {
    const syncStatus = document.querySelector('.sync-status');
    if (!syncStatus) return;

    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SYNC_STATE' });
        const { syncState } = response;

        const dot = syncStatus.querySelector('.sync-dot');
        const text = syncStatus.querySelector('.sync-text');

        if (!dot || !text) return;

        // Update status based on sync state
        syncStatus.classList.remove('synced', 'syncing', 'error');

        switch (syncState.status) {
            case 'synced':
                syncStatus.classList.add('synced');
                text.textContent = 'Synced';
                break;
            case 'syncing':
                syncStatus.classList.add('syncing');
                text.textContent = 'Syncing...';
                break;
            case 'error':
                syncStatus.classList.add('error');
                text.textContent = `Error: ${syncState.lastError || 'Sync failed'}`;
                break;
            case 'conflict':
                syncStatus.classList.add('error');
                text.textContent = 'Conflict detected';
                break;
            default:
                text.textContent = 'Not synced';
        }

        // Update last sync time
        if (syncState.lastSyncTime) {
            const lastSync = document.getElementById('lastSync');
            if (lastSync) {
                const time = new Date(syncState.lastSyncTime).toLocaleString();
                lastSync.textContent = `Last sync: ${time}`;
            }
        }
    } catch (error) {
        console.warn('Could not update sync UI:', error);
    }
}

function setupSyncListeners() {
    // Listen for sync state changes from background
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'SYNC_STATE_CHANGED') {
                updateSyncUI();
            }
        });
    }

    // Poll for sync state changes every 2 seconds
    setInterval(updateSyncUI, 2000);

    // Add force sync button listener if it exists
    const forceSyncBtn = document.getElementById('forceSyncBtn');
    if (forceSyncBtn) {
        forceSyncBtn.addEventListener('click', async () => {
            try {
                forceSyncBtn.disabled = true;
                forceSyncBtn.textContent = 'Syncing...';
                await chrome.runtime.sendMessage({ type: 'FORCE_SYNC' });
                updateSyncUI();
            } catch (error) {
                console.error('Force sync failed:', error);
            } finally {
                forceSyncBtn.disabled = false;
                forceSyncBtn.textContent = 'Sync Now';
            }
        });
    }
}

// ── Settings Page ─────────────────────────────────────────────────────────
async function initializeSettings() {
    const autoSyncToggle = document.getElementById('autoSyncToggle');
    const syncIntervalSlider = document.getElementById('syncIntervalSlider');
    const syncIntervalValue = document.getElementById('syncIntervalValue');
    const strategyRadios = document.querySelectorAll('input[name="conflictStrategy"]');
    const logoutAllBtn = document.getElementById('logoutAllBtn');

    // Load current settings
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SYNC_STATE' });
        const syncState = response?.syncState || {};

        // Update statistics
        updateSettingsStats(syncState);

        // Load sync options from background
        chrome.runtime.sendMessage({ type: 'GET_SYNC_STATE' }, (response) => {
            // In future, we'll fetch the actual sync options
            // For now, defaults are set in HTML
        });
    } catch (error) {
        console.warn('Could not load sync state:', error);
    }

    // Auto-sync toggle
    if (autoSyncToggle) {
        autoSyncToggle.addEventListener('change', async () => {
            try {
                await chrome.runtime.sendMessage({
                    type: 'UPDATE_SYNC_OPTIONS',
                    options: { autoSync: autoSyncToggle.checked }
                });
            } catch (error) {
                console.error('Failed to update auto-sync:', error);
                autoSyncToggle.checked = !autoSyncToggle.checked; // revert
            }
        });
    }

    // Sync interval slider
    if (syncIntervalSlider && syncIntervalValue) {
        syncIntervalSlider.addEventListener('input', () => {
            syncIntervalValue.textContent = syncIntervalSlider.value;
        });

        syncIntervalSlider.addEventListener('change', async () => {
            const minutes = parseInt(syncIntervalSlider.value);
            const milliseconds = minutes * 60 * 1000;
            try {
                await chrome.runtime.sendMessage({
                    type: 'UPDATE_SYNC_OPTIONS',
                    options: { autoSyncInterval: milliseconds }
                });
            } catch (error) {
                console.error('Failed to update sync interval:', error);
            }
        });
    }

    // Conflict resolution strategy
    strategyRadios.forEach(radio => {
        radio.addEventListener('change', async () => {
            const strategy = document.querySelector('input[name="conflictStrategy"]:checked')?.value;
            if (strategy) {
                try {
                    await chrome.runtime.sendMessage({
                        type: 'UPDATE_SYNC_OPTIONS',
                        options: { conflictStrategy: strategy }
                    });
                } catch (error) {
                    console.error('Failed to update conflict strategy:', error);
                }
            }
        });
    });

    // Logout button
    if (logoutAllBtn) {
        logoutAllBtn.addEventListener('click', async () => {
            if (!confirm('Sign out from Google? Syncing will stop.')) return;
            try {
                if (GoogleAuth) {
                    await GoogleAuth.logout();
                    await updateGoogleUIState();
                    updateSyncUI();
                }
            } catch (error) {
                console.error('Logout failed:', error);
            }
        });
    }

    // Poll for updated statistics
    setInterval(updateSettingsStats, 5000);
}

async function updateSettingsStats(syncState) {
    const statLastSync = document.getElementById('statLastSync');
    const statTotalSyncs = document.getElementById('statTotalSyncs');
    const statRuleCount = document.getElementById('statRuleCount');
    const statStatus = document.getElementById('statStatus');

    if (syncState?.lastSyncTime && statLastSync) {
        const time = new Date(syncState.lastSyncTime).toLocaleString();
        statLastSync.textContent = time;
    }

    if (statStatus) {
        const status = syncState?.status || 'idle';
        statStatus.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }

    // Get rule count
    try {
        const rules = await getRules();
        if (statRuleCount) {
            statRuleCount.textContent = rules.length;
        }
    } catch (error) {
        console.warn('Could not fetch rule count:', error);
    }

    // Get sync history count
    try {
        const history = await chrome.runtime.sendMessage({ type: 'GET_SYNC_HISTORY' });
        if (history?.history && statTotalSyncs) {
            statTotalSyncs.textContent = history.history.length;
        }
    } catch (error) {
        console.warn('Could not fetch sync history:', error);
    }
}

// ── Sync History Page ──────────────────────────────────────────────────────
async function initializeSyncHistory() {
    const refreshBtn = document.getElementById('refreshHistoryBtn');
    const clearBtn = document.getElementById('clearHistoryBtn');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', renderSyncHistory);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (!confirm('Clear all sync history? This cannot be undone.')) return;
            try {
                // In future, add method to SyncService to clear history
                console.log('Clear history feature coming soon');
            } catch (error) {
                console.error('Failed to clear history:', error);
            }
        });
    }

    // Initial render
    await renderSyncHistory();

    // Auto-refresh every 10 seconds
    setInterval(renderSyncHistory, 10000);
}

async function renderSyncHistory() {
    const historyBody = document.getElementById('historyBody');
    const historyEmpty = document.getElementById('historyEmpty');
    const filterInput = document.getElementById('syncHistoryFilter');

    if (!historyBody) return;

    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SYNC_HISTORY' });
        const history = response?.history || [];

        // Calculate statistics
        updateSyncHistoryStats(history);

        // Get filter query
        const filterQuery = filterInput?.value?.toLowerCase() || '';

        // Filter history
        let filteredHistory = history;
        if (filterQuery) {
            filteredHistory = history.filter(event => {
                const time = new Date(event.timestamp).toLocaleString().toLowerCase();
                const action = (event.action || '').toLowerCase();
                const status = event.error ? 'error' : 'success';
                return time.includes(filterQuery) || action.includes(filterQuery) || status.includes(filterQuery);
            });
        }

        historyBody.innerHTML = '';

        if (filteredHistory.length === 0) {
            if (historyEmpty) historyEmpty.classList.remove('hidden');
            return;
        }

        if (historyEmpty) historyEmpty.classList.add('hidden');

        // Display last 50 items
        filteredHistory.slice(0, 50).forEach(event => {
            const tr = document.createElement('tr');

            const time = new Date(event.timestamp).toLocaleString();
            const shortTime = new Date(event.timestamp).toLocaleTimeString();
            const action = event.action === 'SYNC_UP' ? '📤 Upload' : (event.action === 'SYNC_DOWN' ? '📥 Download' : '🔄 Sync');
            const status = event.error ? 'error' : 'success';
            const statusText = event.error ? '✗ Failed' : '✓ Success';
            const details = event.error ? event.error : (event.ruleCount ? `${event.ruleCount} rules` : 'Synchronized');

            tr.innerHTML = `
                <td style="font-size: 11px; color: var(--muted);" title="${time}">
                    ${shortTime}
                </td>
                <td>${action}</td>
                <td style="text-align: center; font-weight: 500;">${event.ruleCount || '—'}</td>
                <td><span class="history-status ${status}">${statusText}</span></td>
                <td style="font-size: 11px; color: var(--muted);">${details}</td>
                <td>
                    <button class="btn-icon" title="View details" data-event="${JSON.stringify(event).replace(/"/g, '&quot;')}">
                        ⋯
                    </button>
                </td>
            `;

            historyBody.appendChild(tr);
        });

        // Add filter listener
        if (filterInput && !filterInput._listenerAdded) {
            filterInput.addEventListener('input', renderSyncHistory);
            filterInput._listenerAdded = true;
        }
    } catch (error) {
        console.error('Failed to render sync history:', error);
        if (historyEmpty) historyEmpty.classList.remove('hidden');
    }
}

function updateSyncHistoryStats(history) {
    const totalEl = document.getElementById('syncHistoryTotal');
    const successEl = document.getElementById('syncHistorySuccess');
    const failedEl = document.getElementById('syncHistoryFailed');
    const lastTimeEl = document.getElementById('syncHistoryLastTime');

    if (!totalEl) return;

    const total = history.length;
    const successful = history.filter(e => !e.error).length;
    const failed = history.filter(e => e.error).length;
    const lastEvent = history[0];
    const lastTime = lastEvent ? new Date(lastEvent.timestamp).toLocaleTimeString() : 'Never';

    if (totalEl) totalEl.textContent = total.toString();
    if (successEl) successEl.textContent = successful.toString();
    if (failedEl) failedEl.textContent = failed.toString();
    if (lastTimeEl) lastTimeEl.textContent = total > 0 ? lastTime : 'Never';

    console.log('[Sync History] Stats - Total:', total, 'Success:', successful, 'Failed:', failed);
}

// Debug & Utilities
window.refreshRules = () => renderTable(searchInput?.value || '');
window.updateGoogleUI = updateGoogleUIState;
window.updateSyncUI = updateSyncUI;
window.forceSync = async () => {
    try {
        await chrome.runtime.sendMessage({ type: 'FORCE_SYNC' });
        updateSyncUI();
    } catch (error) {
        console.error('Force sync error:', error);
    }
};
window.refreshSyncHistory = renderSyncHistory;
window.updateSettingsStats = updateSettingsStats;
