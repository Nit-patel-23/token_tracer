/**
 * Lightweight toast notification system shared by every page (personal
 * dashboard, team, admin). Replaces blocking `alert()` calls with a
 * non-blocking, accessible, auto-dismissing notification.
 *
 * Usage: window.showToast('Message', { type: 'success' | 'error' | 'warning' | 'info', duration })
 */
(function () {
  var viewport = null;

  function ensureViewport() {
    if (viewport && document.body.contains(viewport)) return viewport;
    viewport = document.createElement('div');
    viewport.className = 'toast-viewport';
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(viewport);
    return viewport;
  }

  var ICONS = { success: '✓', error: '✕', warning: '!', info: 'i' };

  function showToast(message, opts) {
    opts = opts || {};
    var type = opts.type || 'info';
    var duration = opts.duration || (type === 'error' ? 7000 : 4200);
    var vp = ensureViewport();

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    var icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = ICONS[type] || ICONS.info;

    var text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.textContent = '\u00d7';

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(close);
    vp.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    var timer = setTimeout(dismiss, duration);
    function dismiss() {
      clearTimeout(timer);
      if (!toast.isConnected) return;
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(function () { toast.remove(); }, 220);
    }
    close.addEventListener('click', dismiss);
    toast.addEventListener('mouseenter', function () { clearTimeout(timer); });
    toast.addEventListener('mouseleave', function () { timer = setTimeout(dismiss, 1500); });

    return dismiss;
  }

  window.showToast = showToast;
})();
