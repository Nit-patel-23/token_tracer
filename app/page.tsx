import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionFromCookie } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Sign In — Token Tracer',
  description: 'Sign in to your Token Tracer dashboard.',
};

export default async function LoginPage() {
  const cookieStore = await cookies();
  const session = getSessionFromCookie(cookieStore.toString());

  if (session) {
    if (session.role === 'admin') {
      redirect('/team');
    }
    if (session.role === 'superadmin') {
      redirect('/admin');
    }
    if (session.role === 'user') {
      redirect('/dashboard');
    }
  }

  return (
    <div suppressHydrationWarning>
      <div className="login-page" id="login-page">
        <div className="login-glow" aria-hidden="true" />
        <div className="login-card" id="login-card">
          <div className="login-brand">
            <div className="login-mark" aria-hidden="true">◈</div>
            <div className="wordmark">
              <h1>token<span>tracer</span></h1>
            </div>
            <p className="login-tagline">Sign in to your analytics workspace</p>
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
                autoFocus
              />
            </div>
            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <div className="login-password-wrap">
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  id="login-password-toggle"
                  className="login-password-toggle"
                  aria-label="Show password"
                  aria-pressed="false"
                >
                  👁
                </button>
              </div>
            </div>
            <button type="submit" className="login-submit" id="login-submit">
              <span className="login-submit-spinner" aria-hidden="true" />
              <span className="login-submit-label">Sign in</span>
            </button>
            <div id="login-error" className="login-error" role="alert" aria-live="assertive" hidden>
              <span aria-hidden="true">⚠</span>
              <span id="login-error-text"></span>
            </div>
          </form>
        </div>
        <p className="login-footer">Token usage analytics for AI coding agents</p>
      </div>

      {/* Inline login script — runs before React hydration to avoid flash */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var form = document.getElementById('login-form');
          var errEl = document.getElementById('login-error');
          var errText = document.getElementById('login-error-text');
          var btn = document.getElementById('login-submit');
          var pwInput = document.getElementById('login-password');
          var pwToggle = document.getElementById('login-password-toggle');
          if (!form) return;

          if (pwToggle) {
            pwToggle.addEventListener('click', function() {
              var show = pwInput.type === 'password';
              pwInput.type = show ? 'text' : 'password';
              pwToggle.setAttribute('aria-pressed', String(show));
              pwToggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
              pwToggle.textContent = show ? '🙈' : '👁';
            });
          }

          function setBusy(busy) {
            btn.disabled = busy;
            btn.classList.toggle('is-busy', busy);
          }

          form.addEventListener('submit', async function(e) {
            e.preventDefault();
            errEl.hidden = true;
            setBusy(true);
            try {
              var username = document.getElementById('login-username').value.trim();
              var password = pwInput.value;
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
                errText.textContent = data.error || 'Sign in failed. Please try again.';
                errEl.hidden = false;
                setBusy(false);
              }
            } catch (err) {
              errText.textContent = 'Network error. Please try again.';
              errEl.hidden = false;
              setBusy(false);
            }
          });
        })();
      ` }} />
    </div>
  );
}
