import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In — Token Tracer',
  description: 'Sign in to your Token Tracer dashboard.',
};

export default function LoginPage() {
  return (
    <div suppressHydrationWarning>
      <div className="login-page" id="login-page">
        <div className="login-card" id="login-card">
          <div className="login-brand">
            <div className="wordmark">
              <h1>token<span>tracer</span></h1>
              <span className="eyebrow">Sign In</span>
            </div>
          </div>

          <form id="login-form" autoComplete="on" noValidate>
            <div className="login-field">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="your username"
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="hbtn primary" id="login-submit">
              Sign in
            </button>
            <p id="login-error" className="error" hidden />
          </form>
        </div>
      </div>

      {/* Inline login script — runs before React hydration to avoid flash */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var form = document.getElementById('login-form');
          var errEl = document.getElementById('login-error');
          var btn = document.getElementById('login-submit');
          if (!form) return;
          form.addEventListener('submit', async function(e) {
            e.preventDefault();
            errEl.hidden = true;
            btn.disabled = true;
            btn.textContent = 'Signing in…';
            try {
              var username = document.getElementById('login-username').value.trim();
              var password = document.getElementById('login-password').value;
              var res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'same-origin',
              });
              var data = await res.json().catch(function() { return {}; });
              if (res.ok && data.redirect) {
                window.location.href = data.redirect;
              } else {
                errEl.textContent = data.error || 'Sign in failed. Please try again.';
                errEl.hidden = false;
                btn.disabled = false;
                btn.textContent = 'Sign in';
              }
            } catch (err) {
              errEl.textContent = 'Network error. Please try again.';
              errEl.hidden = false;
              btn.disabled = false;
              btn.textContent = 'Sign in';
            }
          });
        })();
      ` }} />
    </div>
  );
}
