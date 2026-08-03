/* Shared branded Token Tracer loader helpers */
(function () {
  const MARK_SVG =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>' +
    '<circle cx="12" cy="12" r="4"/>' +
    '</svg>';

  function ttLoaderHtml(label, opts) {
    const options = opts || {};
    const size = options.size === 'sm' ? ' tt-loader--sm' : '';
    const inline = options.inline ? ' tt-loader--inline' : '';
    const safeLabel = String(label || 'Tracing tokens…');
    return (
      '<div class="tt-loader' + size + inline + '" role="status" aria-live="polite">' +
        '<div class="tt-loader-orbit" aria-hidden="true">' +
          '<div class="tt-loader-ring"></div>' +
          '<div class="tt-loader-ring tt-loader-ring--inner"></div>' +
          '<div class="tt-loader-core">' + MARK_SVG + '</div>' +
          '<i class="tt-loader-token t1"></i>' +
          '<i class="tt-loader-token t2"></i>' +
          '<i class="tt-loader-token t3"></i>' +
        '</div>' +
        '<p class="tt-loader-label">' + safeLabel + '</p>' +
      '</div>'
    );
  }

  let softCount = 0;

  function setDataLoading(on, label) {
    let el = document.getElementById('data-loading');
    if (!el) {
      const host =
        document.querySelector('.team-main') ||
        document.querySelector('.admin-content') ||
        document.querySelector('.layout') ||
        document.body;
      el = document.createElement('div');
      el.id = 'data-loading';
      el.className = 'data-loading';
      el.hidden = true;
      host.style.position = host.style.position || 'relative';
      host.appendChild(el);
    }

    if (on) softCount += 1;
    else softCount = Math.max(0, softCount - 1);

    const busy = softCount > 0;
    if (busy) {
      el.innerHTML = ttLoaderHtml(label || 'Tracing tokens…');
      el.hidden = false;
      el.setAttribute('aria-busy', 'true');
      el.parentElement?.classList.add('is-refreshing');
    } else {
      el.hidden = true;
      el.removeAttribute('aria-busy');
      el.parentElement?.classList.remove('is-refreshing');
    }
  }

  function resetDataLoading() {
    softCount = 0;
    const el = document.getElementById('data-loading');
    if (el) {
      el.hidden = true;
      el.removeAttribute('aria-busy');
      el.parentElement?.classList.remove('is-refreshing');
    }
  }

  window.ttLoaderHtml = ttLoaderHtml;
  window.setDataLoading = setDataLoading;
  window.resetDataLoading = resetDataLoading;
})();
