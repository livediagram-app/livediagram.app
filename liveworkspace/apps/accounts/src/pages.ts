// The sign-in, registration and consent pages. Plain HTML plus one small script each, served by
// this Worker: they are the only UI the accounts site has, so a framework would cost more than the
// pages themselves. The look is livediagram's account pages ("Night Band": the brand in a header,
// the card, and beside it what an account adds), in liveworkspace's slate.

import { APP_SITES } from '@liveworkspace/sites';
import { NAME_MAX_LENGTH } from './auth-options.ts';

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

// The wordmark: a tile of four squares, one per app accent and the rest slate, beside the name.
// The squares' colours live in the stylesheet (`.tile-N`), since the page allows no inline style.
const WORDMARK = `<span class="wordmark"><span class="tile" aria-hidden="true">${[0, 1, 2, 3]
  .map((i) => `<span class="tile-${i}"></span>`)
  .join('')}</span><span class="word">live<span>workspace</span></span></span>`;

const APP_NAMES = APP_SITES.map((site) => site.name).join(', ');

function icon(paths: string): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const PITCH_ROWS = [
  {
    tone: 'emerald',
    icon: icon(
      '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    ),
    lead: 'Every app',
    title: 'One sign-in',
    line: `The same account works in ${APP_NAMES} and the rest of liveworkspace.`,
  },
  {
    tone: 'violet',
    icon: icon('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
    lead: 'Every device',
    title: 'Your work follows you',
    line: 'Start on a laptop, pick up on a phone.',
  },
  {
    tone: 'sky',
    icon: icon(
      '<circle cx="9" cy="8" r="3"/><path d="M3 19a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a4.5 4.5 0 0 1 5 4.8"/>',
    ),
    lead: 'Teams',
    title: 'Work with your people',
    line: 'Share a workspace with the people you work with.',
  },
  {
    tone: 'amber',
    icon: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
    lead: 'No password',
    title: 'A code by email',
    line: 'Nothing to remember: we send a code each time you sign in.',
  },
];

const PITCH = `<section class="pitch">
<p class="eyebrow">Your liveworkspace account</p>
<h2>One account for every live app.</h2>
<ul>${PITCH_ROWS.map(
  (row) => `
<li><span class="chip ${row.tone}">${row.icon}</span><span><span class="lead ${row.tone}">${row.lead}</span> <span class="row-title">${row.title}</span><span class="row-line">${row.line}</span></span></li>`,
).join('')}
</ul>
</section>`;

function page(title: string, card: string, scripts: string[], pitch: boolean): Response {
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
<main class="stage">
<header class="top">${WORDMARK}</header>
<div class="${pitch ? 'layout' : 'layout alone'}">
<div class="card">
${card}
</div>
${pitch ? PITCH : ''}
</div>
</main>
</body>
</html>`;
  return new Response(html, { headers: SECURITY_HEADERS });
}

const ALERTS = `<p id="error" class="alert error" role="alert" hidden></p>
<p id="notice" class="alert notice" role="status" hidden></p>`;

// The registration form and the name step each hold these, so their ids take a prefix.
function nameFields(prefix: string, autofocus: boolean): string {
  return `<div class="names">
  <div>
    <label for="${prefix}-given">First name</label>
    <input id="${prefix}-given" name="givenName" type="text" autocomplete="given-name" placeholder="Jane" maxlength="${NAME_MAX_LENGTH}" required${autofocus ? ' autofocus' : ''}>
  </div>
  <div>
    <label for="${prefix}-family">Last name</label>
    <input id="${prefix}-family" name="familyName" type="text" autocomplete="family-name" placeholder="Doe" maxlength="${NAME_MAX_LENGTH}" required>
  </div>
</div>`;
}

const CODE_STEP = `<form id="code-step" class="stack" hidden novalidate>
  <p class="muted">We sent a verification code to <strong id="sent-to"></strong>. Enter it below.</p>
  <div class="digits" role="group" aria-label="Verification code">${[1, 2, 3, 4, 5, 6]
    .map(
      (n) =>
        `<input inputmode="numeric" maxlength="1" autocomplete="${n === 1 ? 'one-time-code' : 'off'}" aria-label="Digit ${n}">`,
    )
    .join('')}</div>
  <button type="submit" class="primary" disabled>Verify</button>
  <div class="split">
    <button type="button" id="resend" class="quiet">Resend code</button>
    <button type="button" id="back" class="quiet">Back</button>
  </div>
</form>`;

// Turnstile only draws itself when it wants a press; until then it takes no room.
function captcha(siteKey: string): string {
  return `<div class="cf-turnstile" data-sitekey="${escapeAttribute(siteKey)}" data-size="flexible" data-appearance="interaction-only"></div>`;
}

const DONE = `<div id="done" hidden>
  <p class="muted">You're signed in. You can close this tab, or go back to the app you came from.</p>
</div>`;

// Shown after the code when the account has no name yet: someone who signed in rather than
// registering, or an account from before names were asked for.
const NAME_STEP = `<form id="name-step" class="stack" hidden novalidate>
  <p class="muted">What should we call you? Your name shows on your work and to your teammates.</p>
  ${nameFields('name', false)}
  <button type="submit" class="primary">Continue</button>
</form>`;

function heading(title: string, subtitle: string): string {
  return `<div class="heading"><h1 id="title">${title}</h1><p class="muted">${subtitle}</p></div>`;
}

export function signInPage(turnstileSiteKey: string): Response {
  return page(
    'Sign in · liveworkspace',
    `${heading('Sign in', `One account for ${APP_NAMES} and the rest of liveworkspace.`)}
${ALERTS}
<form id="email-step" class="stack" data-flow="sign-in" novalidate>
  <div>
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required autofocus>
  </div>
  <button type="submit" class="primary">Continue with email</button>
</form>
${CODE_STEP}
${NAME_STEP}
${DONE}
${captcha(turnstileSiteKey)}
<p class="footer">New to liveworkspace? <a id="switch" href="/sign-up">Create an account</a></p>`,
    ['/assets/sign-in.js', TURNSTILE_SCRIPT],
    true,
  );
}

export function signUpPage(turnstileSiteKey: string): Response {
  return page(
    'Create your account · liveworkspace',
    `${heading('Create your account', `One account for ${APP_NAMES} and the rest of liveworkspace.`)}
${ALERTS}
<form id="email-step" class="stack" data-flow="sign-up" novalidate>
  ${nameFields('new', true)}
  <div>
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
  </div>
  <button type="submit" class="primary">Create account</button>
</form>
${CODE_STEP}
${NAME_STEP}
${DONE}
${captcha(turnstileSiteKey)}
<p class="footer">Already have an account? <a id="switch" href="/sign-in">Sign in</a></p>`,
    ['/assets/sign-in.js', TURNSTILE_SCRIPT],
    true,
  );
}

export function consentPage(): Response {
  return page(
    'Allow access · liveworkspace',
    `${heading('Allow access', '<strong id="client"></strong> wants to use your liveworkspace account.')}
<div class="split gap">
  <button type="button" id="deny" class="secondary">Deny</button>
  <button type="button" id="allow" class="primary">Allow</button>
</div>
<p id="error" class="alert error" role="alert" hidden></p>`,
    ['/assets/consent.js'],
    false,
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
async function call(path, body, headers) {
  const response = await fetch('/api/auth' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}
function showError(message) {
  const el = document.getElementById('error');
  el.textContent = message;
  el.hidden = !message;
  if (message) showNotice('');
}
function showNotice(message) {
  const el = document.getElementById('notice');
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
}
`;

// Both account pages run this script; the email form's data-flow says which one it is on.
export const SIGN_IN_SCRIPT = `${SIGNED_QUERY}
const emailStep = document.getElementById('email-step');
const codeStep = document.getElementById('code-step');
const nameStep = document.getElementById('name-step');
const digits = Array.from(codeStep.querySelectorAll('.digits input'));
const verifyButton = codeStep.querySelector('button[type=submit]');
const signingUp = emailStep.dataset.flow === 'sign-up';
const NAME_MAX = ${NAME_MAX_LENGTH};
let email = '';
let names = null;
let continueTo = null;
let verifying = false;

// The other page keeps the signed request, so switching between them mid-sign-in still
// finishes back in the app.
document.getElementById('switch').href += location.search;

function busy(form, on, label) {
  const submit = form.querySelector('button[type=submit]');
  if (label !== undefined) {
    submit.dataset.label ??= submit.textContent;
    submit.textContent = on ? label : submit.dataset.label;
  }
  for (const button of form.querySelectorAll('button')) button.disabled = on;
  if (!on && form === codeStep) verifyButton.disabled = code().length !== 6;
}

function show(step) {
  for (const form of [emailStep, codeStep, nameStep]) form.hidden = form !== step;
  document.getElementById('done').hidden = step !== null;
  document.getElementById('switch').parentElement.hidden = step !== emailStep;
}

function namesFrom(form) {
  const givenName = form.givenName.value.trim().slice(0, NAME_MAX);
  const familyName = form.familyName.value.trim().slice(0, NAME_MAX);
  if (!givenName) return showError('Please enter your first name.');
  if (!familyName) return showError('Please enter your last name.');
  return { givenName, familyName };
}

// Turnstile takes a moment to clear a visitor, and again after each reset, so a quick submit or
// Resend waits for its token rather than being refused for not having one.
async function captchaToken() {
  for (let waited = 0; waited < 15000; waited += 200) {
    const token = window.turnstile && window.turnstile.getResponse();
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return '';
}

async function sendCode() {
  const captcha = await captchaToken();
  const result = await call(
    '/email-otp/send-verification-otp',
    { email, type: 'sign-in' },
    { 'x-captcha-response': String(captcha) },
  );
  if (window.turnstile) window.turnstile.reset();
  if (result.ok) return true;
  showError(result.status === 429
    ? 'Too many codes requested. Wait a minute and try again.'
    : 'We could not send a code. Check the address and try again.');
  return false;
}

emailStep.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  if (signingUp) {
    names = namesFrom(emailStep);
    if (!names) return;
  }
  email = emailStep.email.value.trim().toLowerCase();
  if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) return showError('Please enter a valid email address.');
  busy(emailStep, true, 'Sending code…');
  const sent = await sendCode();
  busy(emailStep, false, '');
  if (!sent) return;
  document.getElementById('sent-to').textContent = email;
  for (const box of digits) box.value = '';
  verifyButton.disabled = true;
  show(codeStep);
  digits[0].focus();
});

function code() {
  return digits.map((box) => box.value).join('');
}

function fill(text, from) {
  const clean = text.replace(/\\D/g, '').slice(0, 6 - from);
  for (let i = 0; i < clean.length; i++) digits[from + i].value = clean[i];
  digits[Math.min(from + clean.length, 5)].focus();
  verifyButton.disabled = code().length !== 6;
  if (code().length === 6) codeStep.requestSubmit();
}

digits.forEach((box, i) => {
  box.addEventListener('input', () => {
    const typed = box.value.replace(/\\D/g, '');
    box.value = '';
    if (typed) fill(typed, i);
    else verifyButton.disabled = true;
  });
  box.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace' && !box.value && i > 0) digits[i - 1].focus();
  });
  box.addEventListener('paste', (event) => {
    event.preventDefault();
    fill(event.clipboardData.getData('text'), 0);
  });
});

codeStep.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (verifying) return;
  showError('');
  const otp = code();
  if (!/^[0-9]{6}$/.test(otp)) return showError('The code is 6 digits.');
  verifying = true;
  busy(codeStep, true, 'Verifying…');
  // A new account takes the names typed on the registration page; an existing one keeps its own.
  const body = { email, otp, oauth_query: signedOAuthQuery() };
  if (names) Object.assign(body, names, { name: names.givenName + ' ' + names.familyName });
  const result = await call('/sign-in/email-otp', body);
  verifying = false;
  busy(codeStep, false, '');
  if (!result.ok) {
    const failure = result.data && result.data.code;
    for (const box of digits) box.value = '';
    verifyButton.disabled = true;
    digits[0].focus();
    return showError(failure === 'TOO_MANY_ATTEMPTS'
      ? 'Too many wrong codes. Request a new one.'
      : result.status === 429
        ? 'Too many attempts. Wait a minute and try again.'
        : 'That code is wrong or has expired.');
  }
  continueTo = result.data && typeof result.data.url === 'string' ? result.data.url : null;
  const session = await call('/get-session');
  const user = session.ok && session.data ? session.data.user : null;
  if (user && !user.givenName) {
    // Registered with names, but the address already had a nameless account: give it these.
    if (names && (await saveNames(names))) return finish();
    nameStep.givenName.value = '';
    nameStep.familyName.value = '';
    document.getElementById('title').textContent = "What's your name?";
    show(nameStep);
    return nameStep.givenName.focus();
  }
  finish();
});

async function saveNames(chosen) {
  const result = await call('/update-user', {
    ...chosen,
    name: chosen.givenName + ' ' + chosen.familyName,
  });
  return result.ok;
}

nameStep.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  const chosen = namesFrom(nameStep);
  if (!chosen) return;
  busy(nameStep, true, 'Saving…');
  const saved = await saveNames(chosen);
  busy(nameStep, false, '');
  if (!saved) return showError('We could not save your name. Please try again.');
  finish();
});

// An app's "Create account" asks with prompt=create, and the provider keeps sending that request
// back to the registration page until it hears the account was made.
const registering = (new URLSearchParams(location.search).get('prompt') || '').split(' ').includes('create');

async function finish() {
  if (registering) {
    const next = await call('/oauth2/continue', { created: true, oauth_query: signedOAuthQuery() });
    if (next.ok && next.data && typeof next.data.url === 'string') return location.assign(next.data.url);
    return showError('That sign-in has expired. Go back to the app and try again.');
  }
  if (continueTo) return location.assign(continueTo);
  document.getElementById('title').textContent = "You're signed in";
  show(null);
}

document.getElementById('resend').addEventListener('click', async () => {
  showError('');
  busy(codeStep, true);
  const sent = await sendCode();
  busy(codeStep, false);
  if (sent) showNotice('We sent you a new code.');
});

document.getElementById('back').addEventListener('click', () => {
  showError('');
  show(emailStep);
  emailStep.email.focus();
});
`;

export const CONSENT_SCRIPT = `${SIGNED_QUERY}
document.getElementById('client').textContent =
  new URLSearchParams(location.search).get('client_id') || 'An app';

async function answer(accept) {
  showError('');
  const result = await call('/oauth2/consent', { accept, oauth_query: signedOAuthQuery() });
  if (result.ok && result.data && typeof result.data.url === 'string') return location.assign(result.data.url);
  showError('That request has expired. Go back to the app and try again.');
}
document.getElementById('allow').addEventListener('click', () => answer(true));
document.getElementById('deny').addEventListener('click', () => answer(false));
`;

const TILE_COLOURS = [...APP_SITES.map((site) => site.accent), '#64748b', '#64748b'].slice(0, 4);

// Tailwind's slate, emerald, violet, sky and amber, so the pages match the apps' account pages.
export const STYLES = `
:root { color-scheme: light dark;
  --ground: #f1f5f9; --dots: #cbd5e1; --card: rgb(255 255 255 / .95); --card-line: #e2e8f0;
  --ink: #1e1b4b; --text: #0f172a; --muted: #475569; --label: #334155; --field: #fff;
  --field-line: #e2e8f0; --focus: #64748b; --ring: #e2e8f0; --primary: #0f172a; --primary-ink: #fff;
  --primary-hover: #1e293b; --eyebrow: #334155; --row: #fff; --row-line: #e2e8f0; --link: #0f172a;
  --error-bg: #fff1f2; --error-line: #fecdd3; --error-ink: #be123c;
  --notice-bg: #ecfdf5; --notice-line: #a7f3d0; --notice-ink: #065f46;
  --emerald-chip: #d1fae5; --emerald: #047857; --violet-chip: #ede9fe; --violet: #6d28d9;
  --sky-chip: #e0f2fe; --sky: #0369a1; --amber-chip: #fef3c7; --amber: #b45309;
  --tile: #0f172a; --shadow: rgb(15 23 42 / .1); }
@media (prefers-color-scheme: dark) { :root {
  --ground: #0f172a; --card: rgb(30 41 59 / .95); --card-line: #334155; --ink: #f1f5f9;
  --text: #f1f5f9; --muted: #94a3b8; --label: #cbd5e1; --field: #0f172a; --field-line: #334155;
  --focus: #94a3b8; --ring: rgb(148 163 184 / .3); --primary: #f1f5f9; --primary-ink: #0f172a;
  --primary-hover: #cbd5e1; --eyebrow: #cbd5e1; --row: rgb(30 41 59 / .8);
  --row-line: rgb(51 65 85 / .7); --link: #e2e8f0;
  --error-bg: rgb(244 63 94 / .1); --error-line: rgb(244 63 94 / .3); --error-ink: #fda4af;
  --notice-bg: rgb(16 185 129 / .1); --notice-line: rgb(16 185 129 / .3); --notice-ink: #6ee7b7;
  --emerald-chip: rgb(52 211 153 / .1); --emerald: #34d399; --violet-chip: rgb(167 139 250 / .1);
  --violet: #a78bfa; --sky-chip: rgb(56 189 248 / .1); --sky: #38bdf8;
  --amber-chip: rgb(251 191 36 / .1); --amber: #fbbf24; --tile: #fff; --shadow: rgb(0 0 0 / .4); } }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; background: var(--ground); color: var(--text);
  background-image: radial-gradient(var(--dots) 1px, transparent 1px); background-size: 24px 24px;
  font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; }
.stage { min-height: 100dvh; display: flex; flex-direction: column; gap: 32px;
  max-width: 72rem; margin: 0 auto; padding: 24px 16px; }
@media (prefers-color-scheme: dark) { body { background-image: none; } }
@media (min-width: 640px) { .stage { padding: 24px 32px; } }
@media (min-width: 1024px) { .stage { padding: 40px 48px; } }
.top { display: flex; align-items: center; justify-content: space-between; }
.wordmark { display: inline-flex; align-items: center; gap: 10px; }
.tile { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; width: 28px; height: 28px;
  padding: 4px; border-radius: 8px; background: var(--tile); }
.tile > span { border-radius: 3px; }
${TILE_COLOURS.map((colour, i) => `.tile-${i} { background: ${colour}; }`).join('\n')}
.word { font-size: 18px; font-weight: 600; letter-spacing: -.01em; color: var(--text); }
.word > span { color: var(--muted); }
.layout { flex: 1; display: flex; flex-direction: column; gap: 32px; }
.layout.alone { align-items: center; justify-content: center; }
.layout.alone .card { max-width: 28rem; }
@media (min-width: 1024px) {
  .layout:not(.alone) { display: grid; grid-template-columns: minmax(0, 1fr) 440px;
    align-items: center; gap: 64px; }
  .layout:not(.alone) .card { grid-column: 2; grid-row: 1; }
  .layout:not(.alone) .pitch { grid-column: 1; grid-row: 1; } }
.card { width: 100%; background: var(--card); border: 1px solid var(--card-line); border-radius: 16px;
  padding: 24px; box-shadow: 0 20px 25px -5px var(--shadow), 0 8px 10px -6px var(--shadow);
  animation: card-in 420ms cubic-bezier(.34, 1.56, .64, 1) 70ms both; }
@media (min-width: 640px) { .card { padding: 32px; } }
.heading { margin-bottom: 24px; }
h1 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -.025em; color: var(--ink); }
@media (min-width: 640px) { h1 { font-size: 28px; } }
.heading .muted { margin-top: 8px; }
.muted { margin: 0; font-size: 14px; line-height: 1.6; color: var(--muted); }
.muted strong { color: var(--text); }
.stack { display: flex; flex-direction: column; gap: 16px; }
.names { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
label { display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500; color: var(--label); }
input { width: 100%; font: inherit; font-size: 14px; padding: 10px 12px; color: var(--text);
  background: var(--field); border: 1px solid var(--field-line); border-radius: 8px; }
input::placeholder { color: #94a3b8; }
input:focus { outline: none; border-color: var(--focus); box-shadow: 0 0 0 3px var(--ring); }
.digits { display: flex; justify-content: center; gap: 8px; }
.digits input { width: 44px; height: 52px; padding: 0; text-align: center; font-size: 20px;
  font-weight: 600; }
button { font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; border-radius: 8px; }
button:focus-visible, a:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
button:disabled { opacity: .5; cursor: not-allowed; }
.primary { width: 100%; min-height: 44px; padding: 10px 16px; border: 0; color: var(--primary-ink);
  background: var(--primary); box-shadow: 0 1px 2px var(--shadow); }
.primary:not(:disabled):hover { background: var(--primary-hover); }
.secondary { width: 100%; min-height: 44px; padding: 10px 16px; color: var(--text);
  background: transparent; border: 1px solid var(--field-line); }
.quiet { padding: 4px 0; border: 0; background: none; font-weight: 400; color: var(--muted); }
.quiet:not(:disabled):hover { color: var(--text); }
.split { display: flex; justify-content: space-between; }
.split.gap { gap: 8px; }
.alert { margin: 0 0 16px; padding: 8px 12px; border-radius: 8px; font-size: 14px; border: 1px solid; }
.alert.error { background: var(--error-bg); border-color: var(--error-line); color: var(--error-ink); }
.alert.notice { background: var(--notice-bg); border-color: var(--notice-line); color: var(--notice-ink); }
.cf-turnstile { margin-top: 16px; }
.cf-turnstile:empty { display: none; }
.footer { margin: 24px 0 0; text-align: center; font-size: 14px; color: var(--muted); }
.footer a { font-weight: 500; color: var(--link); text-decoration: none; }
.footer a:hover { text-decoration: underline; }
.pitch { display: flex; flex-direction: column; gap: 16px; }
.eyebrow { margin: 0; font-size: 12px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase;
  color: var(--eyebrow); }
.pitch h2 { margin: 0; font-size: 24px; line-height: 1.15; font-weight: 600; letter-spacing: -.025em;
  color: var(--ink); }
@media (min-width: 640px) { .eyebrow { font-size: 14px; } .pitch h2 { font-size: 36px; } }
@media (min-width: 1024px) { .pitch { gap: 24px; }
  .pitch h2 { font-size: 60px; line-height: 1.02; letter-spacing: -.03em; } }
.pitch ul { margin: 4px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.pitch li { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--row);
  border: 1px solid var(--row-line); border-radius: 12px; animation: row-in 360ms cubic-bezier(.34, 1.4, .64, 1) both; }
.pitch li:nth-child(2) { animation-delay: 60ms; } .pitch li:nth-child(3) { animation-delay: 120ms; }
.pitch li:nth-child(4) { animation-delay: 180ms; }
@media (min-width: 1024px) { .pitch ul { gap: 12px; } .pitch li { gap: 16px; padding: 16px 18px; border-radius: 16px; } }
.chip { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;
  border-radius: 8px; }
.chip.emerald { background: var(--emerald-chip); color: var(--emerald); }
.chip.violet { background: var(--violet-chip); color: var(--violet); }
.chip.sky { background: var(--sky-chip); color: var(--sky); }
.chip.amber { background: var(--amber-chip); color: var(--amber); }
.lead { font-size: 16px; font-weight: 600; }
.lead.emerald { color: var(--emerald); } .lead.violet { color: var(--violet); }
.lead.sky { color: var(--sky); } .lead.amber { color: var(--amber); }
@media (min-width: 1024px) { .chip { width: 40px; height: 40px; } .lead { font-size: 20px; } }
.row-title { font-size: 14px; font-weight: 600; color: var(--text); }
.row-line { display: block; font-size: 14px; color: var(--muted); }
@keyframes card-in { from { opacity: 0; transform: translateY(12px) scale(.98); } }
@keyframes row-in { from { opacity: 0; transform: translateY(8px); } }
@media (prefers-reduced-motion: reduce) { .card, .pitch li { animation: none; } }
`;
