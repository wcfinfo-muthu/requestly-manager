// content.js — Lightweight tab indicator logic

(function () {
    const ICON_PATH = chrome.runtime.getURL('icons/app48.png');
    let activeRule = null;
    let activeCount = 0;

    // Robust messaging wrapper to handle extension reloads/invalidated context
    function safeSendMessage(message, callback) {
        if (!chrome.runtime?.id) return; // Extension context invalidated
        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    // Ignore silenced errors about receiving end not existing
                    return;
                }
                if (callback) callback(response);
            });
        } catch (e) {
            // Catch "Extension context invalidated" or other runtime exceptions
        }
    }

    // Listen for changes from other contexts (Options page, Popup, etc.)
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync') {
            if (changes.extensionEnabled !== undefined || changes.rules !== undefined) {
                safeSendMessage({type: 'CHECK_ACTIVE_RULES', url: window.location.href}, (response) => {
                    if (response && response.hasActiveRules) {
                        activeRule = response.rule;
                        activeCount = response.activeCount || 1;
                        renderIndicator();
                    } else {
                        const indicator = document.getElementById('requestly-active-indicator');
                        if (indicator) indicator.remove();
                    }
                });
            }
        }
    });


    // Check with background if we have active rules for this URL
    safeSendMessage({type: 'CHECK_ACTIVE_RULES', url: window.location.href}, (response) => {
        if (response && response.hasActiveRules) {
            activeRule = response.rule;
            activeCount = response.activeCount || 1;
            renderIndicator();
        }
    });

    function renderIndicator() {
        if (document.getElementById('requestly-active-indicator')) return;

        const div = document.createElement('div');
        div.id = 'requestly-active-indicator';
        div.title = 'Requestly is active. Drag to move, click to manage.';

        // Inner wrapper for icon clipping
        const inner = document.createElement('div');
        inner.className = 'indicator-icon-inner';

        const img = document.createElement('img');
        img.src = ICON_PATH;
        img.draggable = false;

        inner.appendChild(img);
        div.appendChild(inner);
        document.body.appendChild(div);

        // ── Dragging Logic ─────────────────────────────────────────
        let isDragging = false;
        let hasMoved = false;
        let startX, startY;
        let initialX, initialY;

        div.addEventListener('mousedown', (e) => {
            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;
            const rect = div.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;

            // Prevent style issues while dragging
            div.style.transition = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                hasMoved = true;
            }

            // Update position
            div.style.left = `${initialX + dx}px`;
            div.style.top = `${initialY + dy}px`;
            div.style.right = 'auto';
            div.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            div.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        });

        div.addEventListener('click', (e) => {
            if (hasMoved) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            e.stopPropagation();
            e.preventDefault();
            showPopup();
        });
    }

    function getResourceCounts() {
        const resources = performance.getEntriesByType('resource');
        const counts = {
            image: 0,
            css: 0,
            js: 0,
            fetch: 0,
            docs: 0,
            media: 0,
            manifest: 0,
            etc: 0
        };

        resources.forEach(res => {
            const type = res.initiatorType;
            const url = res.name.toLowerCase();
            const urlPath = url.replace(/[?#].*$/, ''); // Strip query and hash reliably

            if (type === 'img' || type === 'image' || /\.(png|jpg|jpeg|gif|webp|svg|ico)$/.test(urlPath)) {
                counts.image++;
            } else if (/\.(woff|woff2|ttf|otf|eot)$/.test(urlPath)) {
                counts.etc++;
            } else if (urlPath.endsWith('.css')) {
                counts.css++;
            } else if (type === 'script' || urlPath.endsWith('.js')) {
                counts.js++;
            } else if (type === 'fetch' || type === 'xmlhttprequest') {
                counts.fetch++;
            } else if (type === 'video' || type === 'audio' || /\.(mp4|webm|mp3|wav|ogg)$/.test(urlPath)) {
                counts.media++;
            } else if (urlPath.endsWith('.webmanifest') || urlPath.endsWith('manifest.json')) {
                counts.manifest++;
            } else {
                counts.etc++;
            }
        });

        counts.docs = performance.getEntriesByType('navigation').length;

        // Calculate total
        counts.total = Object.values(counts).reduce((a, b) => a + b, 0);

        return counts;
    }

    function getLoadingTime() {
        const nav = performance.getEntriesByType('navigation')[0];
        if (!nav) return 'N/A';
        return `${(nav.loadEventEnd - nav.startTime).toFixed(0)}ms`;
    }

    async function showPopup() {
        if (document.querySelector('.requestly-popup-container')) return;

        const counts = getResourceCounts();
        const loadingTime = getLoadingTime();

        // We bind the popup to the activeRule's name and state
        let ruleName = activeRule ? activeRule.name : 'Requestly';

        // If multiple rules match, show the count instead of just one name
        if (activeCount > 1) {
            ruleName = `${activeCount} Rules Active`;
        } else {
            ruleName = ruleName.replace(/\s*Local to Development/gi, '').trim() || 'Active Rule';
        }

        const ruleEnabled = activeRule ? activeRule.enabled : true;

        const container = document.createElement('div');
        // Save the currently active rule so we can toggle it even if it gets unloaded globally
        const currentRuleId = activeRule ? activeRule.id : null;
        container.className = 'requestly-popup-container';

        container.innerHTML = `
        <div class="requestly-popup-header">
          <div class="requestly-popup-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;" title="${ruleName.replace(/"/g, '&quot;')}">${ruleName}</div>
          <button class="requestly-close-btn">&times;</button>
        </div>

        <div class="requestly-popup-section">
          <div class="requestly-section-label">Screenshot</div>
          <div class="requestly-screenshot-actions">
            <a class="requestly-action-link" id="requestly-capture">Visible View</a>
            <a class="requestly-action-link" id="requestly-capture-full">Full Page</a>
          </div>
        </div>

        <div class="requestly-popup-section">
          <div class="requestly-section-label">Site loading Time</div>
          <div class="requestly-stat-card">
            <span style="color: #9ca3af; font-size: 11px;letter-spacing: 0.5px;">Performance</span>
            <span class="requestly-stat-value">${loadingTime}</span>
          </div>
        </div>

        <div class="requestly-card collapsible" id="requestly-collapsible-trigger">
          <div class="requestly-card-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
            <span style="display: flex; align-items: center; gap: 8px;">
              Total number of files 
              <span style="color: #f97316; font-size: 10px; opacity: 0.8;">(${counts.total})</span>
            </span>
            <span class="requestly-collapse-icon">▼</span>
          </div>
          <div class="requestly-collapse-content" id="requestly-collapsible-content">
            <div class="requestly-card-body">
              <div class="requestly-resource-grid">
                <div class="requestly-resource-item">
                  <span class="requestly-resource-count">${counts.image}</span>
                  <span class="requestly-resource-type">image</span>
                </div>
                <div class="requestly-resource-item">
                  <span class="requestly-resource-count">${counts.css}</span>
                  <span class="requestly-resource-type">css</span>
                </div>
                <div class="requestly-resource-item">
                  <span class="requestly-resource-count">${counts.js}</span>
                  <span class="requestly-resource-type">JS</span>
                </div>
                <div class="requestly-resource-item">
                  <span class="requestly-resource-count">${counts.fetch}</span>
                  <span class="requestly-resource-type">Fetch</span>
                </div>
                <div class="requestly-resource-item">
                  <span class="requestly-resource-count">${counts.docs}</span>
                  <span class="requestly-resource-type">Docs</span>
                </div>
                <div class="requestly-resource-item">
                  <span class="requestly-resource-count">${counts.media}</span>
                  <span class="requestly-resource-type">Media</span>
                </div>
                <div class="requestly-resource-item">
                  <span class="requestly-resource-count">${counts.manifest}</span>
                  <span class="requestly-resource-type">Manifest</span>
                </div>
                <div class="requestly-resource-item">
                  <span class="requestly-resource-count">${counts.etc}</span>
                  <span class="requestly-resource-type">Etc</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      <div class="requestly-footer">
        <div class="requestly-footer-group">
          <button class="requestly-manage-btn" id="requestly-manage-rules">Manage Rules</button>
          <label class="requestly-toggle-switch" title="Enable / Disable this Rule">
            <input type="checkbox" id="requestly-rule-toggle" ${ruleEnabled ? 'checked' : ''}>
            <span class="requestly-toggle-slider"></span>
          </label>
        </div>
      </div>
    `;

        document.body.appendChild(container);

        // Initialize position for dragging (switch from CSS bottom/right to explicit left/top)
        const initialRect = container.getBoundingClientRect();
        container.style.left = `${initialRect.left}px`;
        container.style.top = `${initialRect.top}px`;
        container.style.right = 'auto';
        container.style.bottom = 'auto';

        // ── Popup Dragging Logic ───────────────────────────────────
        let isDraggingPopup = false;
        let popupStartX, popupStartY;
        let popupInitialX, popupInitialY;

        container.addEventListener('mousedown', (e) => {
            // Don't drag if clicking interactive elements
            if (e.target.closest('button, input, a, label')) return;

            isDraggingPopup = true;
            popupStartX = e.clientX;
            popupStartY = e.clientY;
            const rect = container.getBoundingClientRect();
            popupInitialX = rect.left;
            popupInitialY = rect.top;

            container.style.transition = 'none';
            e.preventDefault();
        });

        const popupMouseMoveListener = (e) => {
            if (!isDraggingPopup) return;

            const dx = e.clientX - popupStartX;
            const dy = e.clientY - popupStartY;

            container.style.left = `${popupInitialX + dx}px`;
            container.style.top = `${popupInitialY + dy}px`;
        };

        const popupMouseUpListener = () => {
            if (!isDraggingPopup) return;
            isDraggingPopup = false;
            container.style.transition = 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.15)';
        };

        document.addEventListener('mousemove', popupMouseMoveListener);
        document.addEventListener('mouseup', popupMouseUpListener);

        const toggle = container.querySelector('#requestly-rule-toggle');

        // Update toggle state if rules change while popup is open
        const storageListener = (changes, area) => {
            if (area === 'sync' && changes.rules !== undefined && currentRuleId) {
                const rules = changes.rules.newValue || [];
                const ruleData = rules.find(r => r.id === currentRuleId);
                if (ruleData) {
                    toggle.checked = ruleData.enabled;
                }
            }
        };
        chrome.storage.onChanged.addListener(storageListener);

        // Event Listeners for cleanup
        const cleanup = () => {
            chrome.storage.onChanged.removeListener(storageListener);
            document.removeEventListener('mousedown', outsideClickListener);
            document.removeEventListener('mousemove', popupMouseMoveListener);
            document.removeEventListener('mouseup', popupMouseUpListener);
            container.remove();
        };


        const outsideClickListener = (e) => {
            if (!container.contains(e.target) && e.target.id !== 'requestly-active-indicator' && !document.getElementById('requestly-active-indicator')?.contains(e.target)) {
                cleanup();
            }
        };

        // Slight delay so the click that opened the popup doesn't trigger this immediately
        setTimeout(() => {
            document.addEventListener('mousedown', outsideClickListener);
        }, 10);

        // Event Listeners
        container.querySelector('.requestly-close-btn').addEventListener('click', cleanup);

        toggle.onchange = (e) => {
            if (currentRuleId) {
                safeSendMessage({type: 'TOGGLE_RULE', ruleId: currentRuleId});
            } else {
                // Fallback: if no rule is bound, toggle the master switch
                chrome.storage.sync.set({extensionEnabled: e.target.checked});
            }
        };

        container.querySelector('#requestly-capture').onclick = (e) => {
            e.stopPropagation();
            container.style.display = 'none'; // Hide immediately for capture
            setTimeout(() => {
                safeSendMessage({type: 'CAPTURE_TAB'});
                cleanup();
            }, 100); // 100ms buffer for paint
        };

        container.querySelector('#requestly-capture-full').onclick = (e) => {
            e.stopPropagation();
            container.style.display = 'none'; // Hide immediately for capture
            document.getElementById('requestly-active-indicator').style.display = 'none';
            setTimeout(() => {
                safeSendMessage({type: 'INIT_FULL_PAGE_CAPTURE'});
                cleanup();
            }, 100);
        };

        container.querySelector('#requestly-manage-rules').onclick = () => {
            safeSendMessage({type: 'OPEN_OPTIONS_PAGE', url: window.location.href});
            cleanup();
        };

        const collapsibleContent = container.querySelector('#requestly-collapsible-content');
        collapsibleContent.style.maxHeight = '0px';
        collapsibleContent.style.opacity = '0';

        container.querySelector('#requestly-collapsible-trigger').onclick = (e) => {
            if (e.target.closest('.requestly-card-body')) return;

            const content = container.querySelector('#requestly-collapsible-content');
            const icon = container.querySelector('.requestly-collapse-icon');
            const isCurrentlyCollapsed = content.style.maxHeight === '0px';

            content.style.maxHeight = isCurrentlyCollapsed ? '250px' : '0px';
            content.style.opacity = isCurrentlyCollapsed ? '1' : '0';
            icon.style.transform = isCurrentlyCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
        };
    }

    // ── Full Page Stitching Support ─────────────────────────────────
    let stitchCanvas = null;
    let stitchCtx = null;
    let fullPageMetadata = null;
    let hiddenFixedElements = [];

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'PREPARE_FULL_PAGE') {
            // Robust dimensions for complex layouts
            const width = Math.max(
                document.documentElement.scrollWidth,
                document.body.scrollWidth,
                document.documentElement.clientWidth
            );
            const height = Math.max(
                document.documentElement.scrollHeight,
                document.body.scrollHeight,
                document.documentElement.clientHeight,
                document.documentElement.offsetHeight
            );
            const viewHeight = window.innerHeight;
            const viewWidth = window.innerWidth;
            const dpr = window.devicePixelRatio || 1;

            stitchCanvas = document.createElement('canvas');
            stitchCanvas.width = width * dpr;
            stitchCanvas.height = height * dpr;
            stitchCtx = stitchCanvas.getContext('2d');

            fullPageMetadata = {
                width,
                height,
                viewHeight,
                viewWidth,
                dpr,
                isFirstFrame: true
            };

            hiddenFixedElements = [];

            // Jump to top instantly
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            
            // Wait longer for complex sites like maps to stabilize
            setTimeout(() => {
                sendResponse({success: true, metadata: fullPageMetadata});
            }, 800);
            return true;
        }

        if (message.type === 'PROCESS_CHUNK') {
            const img = new Image();
            img.onload = () => {
                const {dpr, viewHeight, viewWidth, height} = fullPageMetadata;
                const scrollY = window.pageYOffset || window.scrollY;

                // Draw at the EXACT current scroll position
                // Use floor/ceil to avoid sub-pixel seam gaps
                stitchCtx.drawImage(img, 0, Math.floor(scrollY * dpr), viewWidth * dpr, viewHeight * dpr);

                // After the first frame is captured, we hide fixed/sticky elements so they don't repeat
                if (fullPageMetadata.isFirstFrame) {
                    document.querySelectorAll('*').forEach(el => {
                        try {
                            const style = window.getComputedStyle(el);
                            if ((style.position === 'fixed' || style.position === 'sticky') &&
                                el.id !== 'requestly-active-indicator' &&
                                !el.classList.contains('requestly-popup-container')) {
                                if (style.display !== 'none' && style.visibility !== 'hidden') {
                                    hiddenFixedElements.push({el, originalVisibility: el.style.visibility});
                                    el.style.visibility = 'hidden';
                                }
                            }
                        } catch (e) {}
                    });
                    fullPageMetadata.isFirstFrame = false;
                }

                const nextY = scrollY + viewHeight;

                if (nextY < height) {
                    window.scrollTo({ top: nextY, left: 0, behavior: 'instant' });
                    // Maps and dynamic content need significant time to redraw after scroll
                    setTimeout(() => {
                        sendResponse({done: false});
                    }, 600);
                } else {
                    const finalDataUrl = stitchCanvas.toDataURL('image/png');
                    
                    // Cleanup: restore visibility of fixed elements
                    hiddenFixedElements.forEach(item => {
                        item.el.style.visibility = item.originalVisibility;
                    });
                    hiddenFixedElements = [];
                    
                    // Reset and cleanup
                    stitchCanvas = null;
                    stitchCtx = null;
                    document.getElementById('requestly-active-indicator').style.display = '';
                    sendResponse({done: true, dataUrl: finalDataUrl});
                }
            };
            img.src = message.dataUrl;
            return true;
        }
    });

})();

