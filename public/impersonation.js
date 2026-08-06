(async function() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return;
    
    const session = await res.json();
    
    if (session.impersonatedBy) {
      const banner = document.getElementById('impersonation-banner');
      const textSpan = document.getElementById('impersonation-text');
      const backBtn = document.getElementById('impersonation-back-btn');
      
      if (banner && textSpan && backBtn) {
        textSpan.textContent = `You are logged in as ${session.displayName || session.username} (${session.role}).`;
        banner.hidden = false;
        document.body.classList.add('is-impersonating');
        
        backBtn.addEventListener('click', async () => {
          backBtn.disabled = true;
          backBtn.textContent = 'Returning...';
          
          try {
            const retRes = await fetch('/api/admin/impersonate/return', {
              method: 'POST'
            });
            const retData = await retRes.json();
            
            if (retRes.ok && retData.redirect) {
              window.location.href = retData.redirect;
            } else {
              alert(retData.error || 'Failed to return to superadmin session.');
              backBtn.disabled = false;
              backBtn.textContent = 'Back to Super Admin';
            }
          } catch (e) {
            alert('Network error while returning to superadmin session.');
            backBtn.disabled = false;
            backBtn.textContent = 'Back to Super Admin';
          }
        });
      }
    }
  } catch (e) {
    // silently ignore errors to avoid breaking the app if auth/me fails
  }
})();
