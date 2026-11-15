// The interactive view a product's MCP server links its tools to (docs/specs/015-api/mcp-server.md "Interactive view
// (MCP Apps)"): the io.modelcontextprotocol/ui extension's `ui://` resource, the tool `_meta` that points at it, and
// the one self-contained viewer page every product's view shares. A host with MCP Apps renders the page in a
// sandboxed frame beside the tool's result; one without ignores the `_meta` and shows the PNG, which always stays.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { VIEWER_SCRIPT } from './app-viewer-script';

// The extension's media type for a view (MCP Apps, stable 2026-01-26).
export const VIEW_MIME_TYPE = 'text/html;profile=mcp-app';

// The most the viewer page may weigh, script and styles inline: it is sent to every host that lists the resource.
export const VIEWER_HTML_BUDGET_BYTES = 24 * 1024;

/** The `_meta` a tool carries to link its result to the view: the extension's key and the older flat one. */
export function toolUiMeta(resourceUri: string): Record<string, unknown> {
  return { ui: { resourceUri }, 'ui/resourceUri': resourceUri };
}

/** The `_meta` of a tool only the view calls, which a host with MCP Apps keeps from the model. */
export function appOnlyToolMeta(): Record<string, unknown> {
  return { ui: { visibility: ['app'] } };
}

// The view page's own `_meta`: no network but the sockets it names (the SVG is drawn as an image, so nothing in it
// fetches; live updates open the document's room, mcp-server.md "Live updates"), and a border round the frame.
export function viewResourceMeta(connectDomains: readonly string[] = []) {
  return {
    ui: { csp: { connectDomains: [...connectDomains], resourceDomains: [] }, prefersBorder: true },
  };
}

/** The WebSocket origin of an app base (`https://www.x.app` → `wss://www.x.app`), as the view's CSP names it. */
export function socketOriginOf(appBase: string): string {
  const url = new URL(appBase);
  return `${url.protocol === 'http:' ? 'ws:' : 'wss:'}//${url.host}`;
}

const STYLE = `
:root{--bg:#fff;--fg:#0f172a;--muted:#64748b;--line:#e2e8f0;--chip:#f1f5f9;--chip-on:#0f172a;--chip-on-fg:#fff;--ring:#6366f1;--stage:#f8fafc;--live:#16a34a;--wait:#d97706;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0b1120;--fg:#e2e8f0;--muted:#94a3b8;--line:#1e293b;--chip:#1e293b;--chip-on:#e2e8f0;--chip-on-fg:#0b1120;--ring:#818cf8;--stage:#020617;--live:#4ade80;--wait:#fbbf24;color-scheme:dark}}
:root[data-theme=dark]{--bg:#0b1120;--fg:#e2e8f0;--muted:#94a3b8;--line:#1e293b;--chip:#1e293b;--chip-on:#e2e8f0;--chip-on-fg:#0b1120;--ring:#818cf8;--stage:#020617;--live:#4ade80;--wait:#fbbf24;color-scheme:dark}
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--fg);font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;flex-direction:column;min-height:420px}
header{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--line)}
#title{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:0 1 auto}
#tabs{display:flex;gap:4px;overflow-x:auto;flex:1 1 auto;min-width:0;scrollbar-width:none}
#tabs button,.tool{border:0;border-radius:999px;background:var(--chip);color:var(--fg);font:inherit;padding:4px 10px;cursor:pointer;white-space:nowrap}
#tabs button[aria-pressed=true]{background:var(--chip-on);color:var(--chip-on-fg)}
.tool{padding:4px 8px;min-width:28px}.tool:hover,#tabs button:hover{filter:brightness(.95)}
button:focus-visible,#stage:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
#live{display:inline-flex;align-items:center;gap:5px;color:var(--muted);font-size:12px;white-space:nowrap;cursor:default}
#live::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--muted)}
#live[data-state=live]::before{background:var(--live)}#live[data-state=wait]::before{background:var(--wait)}
.spacer{flex:1}#zoom{color:var(--muted);font-variant-numeric:tabular-nums;min-width:40px;text-align:right}
#open{background:var(--chip-on);color:var(--chip-on-fg);font-weight:500}
#stage{position:relative;flex:1;overflow:hidden;background:var(--stage);cursor:grab;touch-action:none;outline:none}
#stage:active{cursor:grabbing}
#art{position:absolute;left:0;top:0;transform-origin:0 0;user-select:none;-webkit-user-drag:none;pointer-events:none;max-width:none}
#ring{position:absolute;border:2px solid var(--ring);border-radius:6px;pointer-events:none}
#note{position:absolute;inset:auto 0 12px;margin:auto;width:max-content;max-width:90%;padding:6px 12px;border-radius:8px;background:var(--bg);border:1px solid var(--line);color:var(--muted)}
@media (max-width:520px){header{gap:6px}#title{display:none}#zoom{display:none}#live{font-size:0;gap:0;padding:0 2px}.tool{flex:none}}
@media (prefers-reduced-motion:no-preference){#tabs button,.tool{transition:filter .15s}#live[data-state=wait]::before{animation:pulse 1.2s ease-in-out infinite}}
@keyframes pulse{50%{opacity:.35}}
`;

/** The viewer page, for a product (its name, which the host hears at ui/initialize). */
export function viewerHtml(app: string): string {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<title>${app}</title><style>${STYLE}</style></head><body>` +
    '<header><span id="title"></span><nav id="tabs" aria-label="Tabs" hidden></nav><span class="spacer"></span>' +
    '<span id="live" role="status" hidden></span>' +
    '<button class="tool" id="out" type="button" title="Zoom out" aria-label="Zoom out">−</button>' +
    '<span id="zoom" aria-live="polite">100%</span>' +
    '<button class="tool" id="in" type="button" title="Zoom in" aria-label="Zoom in">+</button>' +
    '<button class="tool" id="fit" type="button" title="Fit the tab">Fit</button>' +
    '<button class="tool" id="open" type="button" title="Open this tab in the editor">Open in editor</button>' +
    '</header><main id="stage" tabindex="0" aria-label="The tab: drag to pan, scroll or pinch to zoom, click an element to open it in the editor">' +
    '<img id="art" alt=""><div id="ring" hidden></div><p id="note" role="status">Waiting for the result…</p></main>' +
    `<script>${VIEWER_SCRIPT.replace('__APP__', app)}</script></body></html>`
  );
}

/** Lists the view page as a `ui://` resource on the server, its CSP allowing the sockets in `connectDomains`. */
export function registerViewResource(
  server: McpServer,
  opts: { uri: string; app: string; title: string; connectDomains?: readonly string[] },
): void {
  const html = viewerHtml(opts.app);
  const meta = viewResourceMeta(opts.connectDomains);
  server.registerResource(
    'view',
    opts.uri,
    { title: opts.title, mimeType: VIEW_MIME_TYPE, _meta: meta },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: VIEW_MIME_TYPE, text: html, _meta: meta }],
    }),
  );
}
