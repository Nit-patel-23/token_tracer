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
            <div className="login-mark" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </div>
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
                  <svg className="eye-open" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <svg className="eye-closed" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...({ hidden: true } as any)}>
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.4 5.1A10.3 10.3 0 0 1 12 5c6.5 0 10 7 10 7a18.4 18.4 0 0 1-2.2 3.2" />
                    <path d="M6.7 6.7C4.2 8.4 2.7 11 2.7 11S6.2 18 12 18c1.1 0 2.1-.2 3-.5" />
                  </svg>
                </button>
              </div>
            </div>
            <button type="submit" className="login-submit" id="login-submit">
              <span className="login-submit-spinner" aria-hidden="true" />
              <span className="login-submit-label">Sign in</span>
            </button>
            <div id="login-error" className="login-error" role="alert" aria-live="assertive" hidden>
              <span aria-hidden="true">!</span>
              <span id="login-error-text"></span>
            </div>
          </form>
        </div>
        <p className="login-footer">Token usage analytics for AI coding agents</p>
      </div>

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
            var eyeOpen = pwToggle.querySelector('.eye-open');
            var eyeClosed = pwToggle.querySelector('.eye-closed');
            pwToggle.addEventListener('click', function() {
              var show = pwInput.type === 'password';
              pwInput.type = show ? 'text' : 'password';
              pwToggle.setAttribute('aria-pressed', String(show));
              pwToggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
              if (eyeOpen) eyeOpen.hidden = show;
              if (eyeClosed) eyeClosed.hidden = !show;
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
                body: JSON.stringify({ username: username, password: password }),
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
