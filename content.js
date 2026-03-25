// content.js — Lightweight tab indicator logic

(function () {
  const ICON_PATH = chrome.runtime.getURL('icons/app48.png');

  // Check with background if we have active rules for this URL
  chrome.runtime.sendMessage({ type: 'CHECK_ACTIVE_RULES', url: window.location.href }, (response) => {
    if (response && response.hasActiveRules) {
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
      chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
    });
  }
})();
