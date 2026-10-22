// The sign-in and consent pages. Plain HTML plus one small script each, served by this
// Worker: they are the only UI the accounts site has, so a framework would cost more than
// the pages themselves.

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

const SECURITY_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  // The query string carries the signed OAuth request; keep it out of Referer.
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'content-security-policy': [
    "default-src 'self'",
    `script-src 'self' https://challenges.cloudflare.com`,
    'frame-src https://challenges.cloudflare.com',
    "style-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; '),
};

function escapeAttribute(value: string): string {
  return value.replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function page(title: string, body: string, scripts: string[]): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="/assets/accounts.css">
${scripts.map((src) => `<script src="${src}" defer></script>`).join('\n')}
</head>
<body>
<main class="card">
<p class="brand">liveworkspace</p>
${body}
</main>
</body>
</html>`;
  return new Response(html, { headers: SECURITY_HEADERS });
}

export function signInPage(turnstileSiteKey: string): Response {
  return page(
    'Sign in · liveworkspace',
    `<h1>Sign in</h1>
<p class="lede">One account for livediagram, liveplanner and the rest of liveworkspace.</p>
<form id="email-step" novalidate>
  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="email" required autofocus>
  <div class="cf-turnstile" data-sitekey="${escapeAttribute(turnstileSiteKey)}" data-size="flexible"></div>
  <button type="submit">Email me a code</button>
</form>
<form id="code-step" hidden novalidate>
  <p class="lede">We sent a 6-digit code to <strong id="sent-to"></strong>.</p>
  <label for="code">Code</label>
  <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required>
  <button type="submit">Sign in</button>
  <button type="button" id="restart" class="link">Use a different email</button>
</form>
<div id="done" hidden>
  <h2>You're signed in</h2>
  <p class="lede">You can close this tab, or go back to the app you came from.</p>
</div>
<p id="error" class="error" role="alert" hidden></p>`,
    ['/assets/sign-in.js', TURNSTILE_SCRIPT],
  );
}

export function consentPage(): Response {
  return page(
    'Allow access · liveworkspace',
    `<h1>Allow access</h1>
<p class="lede"><strong id="client"></strong> wants to use your liveworkspace account.</p>
<div class="row">
  <button type="button" id="allow">Allow</button>
  <button type="button" id="deny" class="secondary">Deny</button>
</div>
<p id="error" class="error" role="alert" hidden></p>`,
    ['/assets/consent.js'],
  );
}

// Rebuilds the signed OAuth query the provider put on this page's URL, in the form the
// sign-in and consent endpoints expect as `oauth_query`. A port of
// @better-auth/oauth-provider's buildSignedOAuthQuery (src/signed-query.ts); the plugin's
// client does the same, but pulling in the client for this one function would ship far more.
const SIGNED_QUERY = `
function signedOAuthQuery() {
  const params = new URLSearchParams(location.search);
  if (!params.has('sig')) return undefined;
  const names = params.getAll('ba_param');
  if (names.length === 0) return undefined;
  const allowed = new Set(names);
  const out = new URLSearchParams();
  for (const [key, value] of params) {
    if (key === 'sig' || key === 'ba_param' || allowed.has(key)) out.append(key, value);
  }
  return out.toString();
}
async function post(path, body, headers) {
  const response = await fetch('/api/auth' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}
function showError(message) {
  const el = document.getElementById('error');
  el.textContent = message;
  el.hidden = !message;
}
`;

export const SIGN_IN_SCRIPT = `${SIGNED_QUERY}
const emailStep = document.getElementById('email-step');
const codeStep = document.getElementById('code-step');
let email = '';

function busy(form, on) {
  for (const button of form.querySelectorAll('button')) button.disabled = on;
}

emailStep.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  email = emailStep.email.value.trim().toLowerCase();
  if (!email.includes('@')) return showError('Enter your email address.');
  const captcha = new FormData(emailStep).get('cf-turnstile-response') || '';
  busy(emailStep, true);
  const result = await post(
    '/email-otp/send-verification-otp',
    { email, type: 'sign-in' },
    { 'x-captcha-response': String(captcha) },
  );
  busy(emailStep, false);
  window.turnstile?.reset();
  if (!result.ok) {
    return showError(result.status === 429
      ? 'Too many codes requested. Wait a minute and try again.'
      : 'We could not send a code. Check the address and try again.');
  }
  document.getElementById('sent-to').textContent = email;
  emailStep.hidden = true;
  codeStep.hidden = false;
  codeStep.code.focus();
});

codeStep.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  const otp = codeStep.code.value.trim();
  if (!/^[0-9]{6}$/.test(otp)) return showError('The code is 6 digits.');
  busy(codeStep, true);
  const result = await post('/sign-in/email-otp', { email, otp, oauth_query: signedOAuthQuery() });
  busy(codeStep, false);
  if (!result.ok) {
    const code = result.data && result.data.code;
    return showError(code === 'TOO_MANY_ATTEMPTS'
      ? 'Too many wrong codes. Request a new one.'
      : result.status === 429
        ? 'Too many attempts. Wait a minute and try again.'
        : 'That code is wrong or has expired.');
  }
  if (result.data && typeof result.data.url === 'string') return location.assign(result.data.url);
  codeStep.hidden = true;
  document.getElementById('done').hidden = false;
});

document.getElementById('restart').addEventListener('click', () => {
  codeStep.hidden = true;
  codeStep.code.value = '';
  emailStep.hidden = false;
  showError('');
  emailStep.email.focus();
});
`;

export const CONSENT_SCRIPT = `${SIGNED_QUERY}
document.getElementById('client').textContent =
  new URLSearchParams(location.search).get('client_id') || 'An app';

async function answer(accept) {
  showError('');
  const result = await post('/oauth2/consent', { accept, oauth_query: signedOAuthQuery() });
  if (result.ok && result.data && typeof result.data.url === 'string') return location.assign(result.data.url);
  showError('That request has expired. Go back to the app and try again.');
}
document.getElementById('allow').addEventListener('click', () => answer(true));
document.getElementById('deny').addEventListener('click', () => answer(false));
`;

export const STYLES = `
:root { color-scheme: light dark; --bg: #f6f6f4; --card: #fff; --ink: #161616; --muted: #5d5d5d;
  --line: #d9d9d4; --accent: #2f5bea; --accent-ink: #fff; --error: #b42318; }
@media (prefers-color-scheme: dark) { :root { --bg: #121212; --card: #1c1c1c; --ink: #f1f1ef;
  --muted: #a3a3a0; --line: #343432; --accent: #7c9cff; --accent-ink: #0b0b0b; --error: #ff8a80; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
  background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, sans-serif; }
.card { width: 100%; max-width: 380px; background: var(--card); border: 1px solid var(--line);
  border-radius: 12px; padding: 28px 24px; }
.brand { margin: 0 0 20px; font-weight: 600; color: var(--muted); font-size: 14px; }
h1 { margin: 0 0 6px; font-size: 24px; } h2 { margin: 0 0 6px; font-size: 20px; }
.lede { margin: 0 0 20px; color: var(--muted); }
label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; }
input { width: 100%; font: inherit; padding: 10px 12px; border: 1px solid var(--line);
  border-radius: 8px; background: transparent; color: inherit; margin-bottom: 16px; }
input:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
#code { letter-spacing: 6px; font-size: 22px; text-align: center; }
.cf-turnstile { margin-bottom: 16px; min-height: 65px; }
button { width: 100%; font: inherit; font-weight: 500; padding: 10px 12px; border: 0;
  border-radius: 8px; background: var(--accent); color: var(--accent-ink); cursor: pointer; }
button:disabled { opacity: .6; cursor: progress; }
button.secondary { background: transparent; color: var(--ink); border: 1px solid var(--line); }
button.link { background: none; color: var(--accent); margin-top: 8px; }
.row { display: flex; gap: 8px; }
.error { color: var(--error); margin: 16px 0 0; }
`;
