// The Worker's settings. They live apart from src/index.ts because a Worker's entry module may only
// export handlers: the runtime refuses to start on any other export there.

// The two paths of liveworkspace.app this Worker owns: its API, under /api like every liveworkspace
// API, and the dashboard page.
export const API_PATH = '/api/telemetry';
export const DASHBOARD_PATH = '/telemetry';

const DAY_MS = 86_400_000;
// The dashboard's longest look back is 59 days (the last 30 and the 30 before them).
export const RETENTION_MS = 60 * DAY_MS;

// The ingest is posted to cross-site by every app's pages, as a CORS "simple request" (text/plain, no
// credentials), so it needs no preflight; the header only lets a page read the 204.
export const CORS = { 'Access-Control-Allow-Origin': '*' };

// The dashboard's pages get the same defence-in-depth headers as every app's public pages. Set here,
// not in a _headers file, because a Worker serving through the ASSETS binding skips _headers. Both
// apps' Trusted Types policies are named: the dashboard renders both apps' UI.
export const PAGE_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy':
    "require-trusted-types-for 'script'; trusted-types livediagram-markup livediagram-inert-parse liveplanner-markup liveplanner-inert-parse nextjs default; frame-ancestors 'none'",
};
