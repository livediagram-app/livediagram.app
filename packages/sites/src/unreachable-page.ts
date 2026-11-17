// What an app's router answers a page load it forwards to liveworkspace (the Explorer, the Community, the sign-in
// pages) when liveworkspace can't be reached or doesn't answer in time (liveworkspace/docs/specs/003-accounts/
// accounts.md "When the accounts site doesn't answer", "An app's router"). Before, the browser showed the plain line
// naming the origin ("router: liveworkspace at … could not be reached", Work Tracker 1082). Now a calm page in the
// platform's look: what happened, that nothing was lost, Try Again (the same address) and the status page.
//
// Dependency-free and Worker-safe, like the rest of this package's router helpers: one string of HTML with its styles
// inline, no script, and its own Content-Security-Policy saying so.

/** A forward that should answer with a page rather than a line of text: a GET or HEAD asking for HTML. */
export function isPageLoad(request: Request): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  if (request.headers.get('Sec-Fetch-Dest') === 'document') return true;
  return (request.headers.get('Accept') ?? '').includes('text/html');
}

export const UNREACHABLE_PAGE_COPY = {
  title: 'This Page Couldn’t Load',
  body: 'liveworkspace, which serves this page, didn’t answer. Nothing you made was lost: your work is saved in its app.',
  retry: 'Try Again',
  status: 'Check the status page',
} as const;

const PAGE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Slate on white, and on slate-950 in a dark scheme, the site's own colours; the primary button keeps a ButtonBorder
// edge under forced colours (forced-colors.md "A button is never its fill alone").
const STYLE = `
:root{color-scheme:light dark;--bg:#fff;--ink:#0f172a;--muted:#475569;--line:#e2e8f0;--btn:#0f172a;--btn-ink:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#020617;--ink:#f1f5f9;--muted:#cbd5e1;--line:#334155;--btn:#f1f5f9;--btn-ink:#0f172a}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:var(--bg);color:var(--ink);font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:28rem;text-align:center}
.icon{display:inline-flex;width:48px;height:48px;align-items:center;justify-content:center;border-radius:9999px;border:1px solid var(--line);color:var(--muted)}
h1{margin:20px 0 8px;font-size:1.25rem;font-weight:600;letter-spacing:-.01em}
p{margin:0;color:var(--muted)}
.actions{margin-top:24px;display:flex;flex-direction:column;align-items:center;gap:12px}
.retry{display:inline-flex;min-height:44px;align-items:center;justify-content:center;padding:0 24px;border-radius:9999px;background:var(--btn);color:var(--btn-ink);font-weight:600;font-size:.875rem;text-decoration:none}
.retry:focus-visible,.status:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.status{display:inline-flex;min-height:44px;align-items:center;color:var(--ink);font-size:.875rem;font-weight:500;text-decoration:underline;text-underline-offset:4px;text-decoration-color:var(--line)}
@media (forced-colors:active){.retry{border:1px solid ButtonBorder}}
`;

// lucide's cloud-alert, as the site's Explorer uses for the same moment.
const CLOUD_ALERT =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 12v4"/><path d="M12 20h.01"/><path d="M17 18h.5a1 1 0 0 0 0-9h-1.79A7 7 0 1 0 7 17.708"/></svg>';

/** The page, with the forward's status (502 or 504) and `no-store`. `statusHref` is liveworkspace's status page. */
export function unreachablePage(status: number, statusHref: string): Response {
  const { title, body, retry, status: statusLink } = UNREACHABLE_PAGE_COPY;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>${STYLE}</style>
</head>
<body>
<main data-router-unreachable="">
<span class="icon">${CLOUD_ALERT}</span>
<h1>${title}</h1>
<p>${body}</p>
<div class="actions">
<a class="retry" href="">${retry}</a>
<a class="status" href="${escapeAttribute(statusHref)}">${statusLink}</a>
</div>
</main>
</body>
</html>
`;
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': PAGE_CSP,
    },
  });
}
