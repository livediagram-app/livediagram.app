// The interactive view a product's MCP server links its tools to (docs/specs/015-api/mcp-server.md "Interactive view
// (MCP Apps)"): the io.modelcontextprotocol/ui extension's `ui://` resource, the tool `_meta` that points at it, and
// the one self-contained viewer page every product's view shares. A host with MCP Apps renders the page in a
// sandboxed frame beside the tool's result; one without ignores the `_meta` and shows the PNG, which always stays.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { viewerScript } from './app-viewer-script';
import { boardViewerScript } from './app-viewer-board-script';

// The extension's media type for a view (MCP Apps, stable 2026-01-26).
export const VIEW_MIME_TYPE = 'text/html;profile=mcp-app';

// The most the viewer page may weigh, script and styles inline: it is sent to every host that lists the resource. A
// page with the edit parts (livediagram's, "Edits in the view") has a budget of its own; the others leave them out.
export const VIEWER_HTML_BUDGET_BYTES = 24 * 1024;
export const VIEWER_EDIT_HTML_BUDGET_BYTES = 32 * 1024;

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

// The styles every view shares: the theme, the header and its buttons, and the note.
const BASE_STYLE = `
:root{--bg:#fff;--fg:#0f172a;--muted:#64748b;--line:#e2e8f0;--chip:#f1f5f9;--chip-on:#0f172a;--chip-on-fg:#fff;--ring:#6366f1;--stage:#f8fafc;--live:#16a34a;--wait:#b45309;color-scheme:light}
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
.tool:disabled{opacity:.4;cursor:default;filter:none}
button:focus-visible,#stage:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
.spacer{flex:1}
#open{background:var(--chip-on);color:var(--chip-on-fg);font-weight:500}
#note{position:absolute;inset:auto 0 12px;margin:auto;width:max-content;max-width:90%;padding:6px 12px;border-radius:8px;background:var(--bg);border:1px solid var(--line);color:var(--muted)}
@media (max-width:520px){header{gap:6px;flex-wrap:wrap}#title{display:none}.tool{flex:none}#tabs{order:9;flex-basis:100%}}
@media (prefers-reduced-motion:no-preference){#tabs button,.tool{transition:filter .15s}}
`;

// The canvas view's styles: the stage it pans and zooms, the hover ring, the pager and the live mark.
const CANVAS_STYLE = `
#live{display:inline-flex;align-items:center;gap:5px;color:var(--muted);font-size:12px;white-space:nowrap;cursor:default}#live[hidden]{display:none}
#live::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--muted)}
#live[data-state=live]::before{background:var(--live)}#live[data-state=wait]::before{background:var(--wait)}
#zoom{color:var(--muted);font-variant-numeric:tabular-nums;min-width:40px;text-align:right}
#pager{display:inline-flex;align-items:center;gap:2px;flex:none}#pager[hidden]{display:none}
#page{color:var(--muted);font-variant-numeric:tabular-nums;min-width:44px;text-align:center;white-space:nowrap;cursor:default}
#stage{position:relative;flex:1;overflow:hidden;background:var(--stage);cursor:grab;touch-action:none;outline:none}
#stage:active{cursor:grabbing}
#art{position:absolute;left:0;top:0;transform-origin:0 0;user-select:none;-webkit-user-drag:none;pointer-events:none;max-width:none}
#ring{position:absolute;border:2px solid var(--ring);border-radius:6px;pointer-events:none}
@media (max-width:520px){#zoom{display:none}#live{font-size:0;gap:0;padding:0 2px}#page{min-width:36px}#pager:not([hidden])~#out,#pager:not([hidden])~#in{display:none}}
@media (prefers-reduced-motion:no-preference){#live[data-state=wait]::before{animation:pulse 1.2s ease-in-out infinite}}
@keyframes pulse{50%{opacity:.35}}
`;

// The edit parts' styles: the Edit toggle, the selection, its bar (whose hint says a save) and the rename box.
const EDIT_STYLE = `
#edit[aria-pressed=true]{background:color-mix(in srgb,var(--ring) 18%,var(--bg));box-shadow:inset 0 0 0 1.5px var(--ring)}
#edit[hidden],#sel[hidden],#bar[hidden],#name-box[hidden]{display:none}
#sel{position:absolute;border:2px solid var(--ring);border-radius:6px;pointer-events:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--ring) 25%,transparent)}
#sel.drag{border-style:dashed;background:color-mix(in srgb,var(--ring) 10%,transparent)}
#bar{position:absolute;z-index:2;display:flex;align-items:center;gap:2px;max-width:calc(100% - 16px);padding:3px;border:1px solid var(--line);border-radius:10px;background:var(--bg);box-shadow:0 6px 18px rgb(2 6 23/.16);cursor:default}
#bar-name{font-weight:600;padding:0 6px 0 5px;min-width:0;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#hint{color:var(--muted);font-size:12px;padding-right:8px;margin-right:2px;border-right:1px solid var(--line);white-space:nowrap}
#bar button{border:0;border-radius:7px;background:none;color:var(--fg);font:inherit;padding:4px 9px;cursor:pointer;white-space:nowrap}
#bar button:hover:not(:disabled){background:var(--chip)}
#bar button:disabled{color:var(--muted);opacity:.6;cursor:not-allowed}
#name-box{position:absolute;z-index:3;height:34px;padding:0 10px;border:2px solid var(--ring);border-radius:8px;background:var(--bg);color:var(--fg);font:inherit;outline:none;box-shadow:0 6px 18px rgb(2 6 23/.16)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (pointer:coarse){#bar button{padding:8px 12px}#name-box{height:40px}}
@media (max-width:760px){#live{font-size:0;gap:0;padding:0 2px}}
@media (max-width:520px){#bar-name{max-width:110px}}
@media (prefers-reduced-motion:no-preference){#bar button{transition:background-color .15s}}
`;

// The board view's styles: columns side by side, scrolling across (snapping a column at a time on a phone), and the
// cards as buttons with their type's stripe.
const BOARD_STYLE = `
#board{position:relative;flex:1;overflow:auto;background:var(--stage);padding:10px;overscroll-behavior:contain}
.bd+.bd{margin-top:16px}
.bt{font-size:12px;font-weight:600;color:var(--muted);margin:0 2px 8px}
.cols{display:flex;gap:10px;align-items:flex-start;scroll-snap-type:x proximity}
.col{flex:0 0 232px;display:flex;flex-direction:column;gap:6px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px;scroll-snap-align:start}
.ch{display:flex;align-items:baseline;gap:8px;padding:2px 4px 2px;border:0;font-weight:600}
.cn{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.n{margin-left:auto;color:var(--muted);font-weight:500;font-variant-numeric:tabular-nums;font-size:12px}
.n.over{color:var(--wait)}
.done .cn{color:var(--muted)}
.cards{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.card{display:flex;align-items:baseline;gap:6px;width:100%;text-align:left;border:1px solid var(--line);border-left:3px solid var(--muted);border-radius:8px;background:var(--bg);color:var(--fg);font:inherit;padding:6px 8px;cursor:pointer}
.card:hover{background:var(--chip)}
.ref{color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums;flex:none}
.tt{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.more{border:1px dashed var(--line);border-radius:8px;background:transparent;color:var(--muted);font:inherit;font-size:12px;padding:5px 8px;cursor:pointer;text-align:left}
.more:hover{color:var(--fg);border-color:var(--muted)}
.empty{margin:0;padding:2px 4px 4px;color:var(--muted);font-size:12px}
@media (max-width:520px){.col{flex-basis:78vw}}
@media (prefers-reduced-motion:no-preference){.card,.more{transition:background-color .15s,border-color .15s,color .15s}}
`;

/** How a product's view page is made: the id key its tools take, whether it follows live, and which view it is. */
export type ViewerOptions = {
  // The argument naming the file in the view's tools: documentId (the default), designId, projectId.
  idKey?: string;
  // Follow the room once drawn (view_live): only a product whose api mints a view-only room ticket. Default true.
  live?: boolean;
  // The board view (liveplanner) in place of the canvas: columns and cards drawn as HTML.
  board?: boolean;
  // The edit parts ("Edits in the view", livediagram's): offered only when view_live says the token may.
  edits?: boolean;
};

const head = (app: string, style: string) =>
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  `<title>${app}</title><style>${BASE_STYLE}${style}</style></head><body>`;

const NOTE = '<p id="note" role="status">Waiting for the result…</p>';

// The edit parts' markup: the header's Edit toggle, and the stage's selection, bar, rename box and the words a screen
// reader hears on a selection or a save.
const EDIT_HEADER =
  '<button class="tool" id="edit" type="button" aria-pressed="false" hidden>Edit</button>';
const EDIT_STAGE =
  '<div id="sel" hidden></div><div id="bar" role="toolbar" hidden><span id="bar-name"></span>' +
  '<span id="hint"></span><button id="ren" type="button">Rename</button>' +
  '<button id="go" type="button" title="Open this element in the editor">Open</button></div>' +
  '<input id="name-box" type="text" aria-label="Label" maxlength="500" autocomplete="off" hidden>' +
  '<span id="sr" class="sr" aria-live="polite"></span>';

function canvasHtml(app: string, opts: ViewerOptions): string {
  return (
    head(app, CANVAS_STYLE + (opts.edits ? EDIT_STYLE : '')) +
    '<header><span id="title"></span><nav id="tabs" aria-label="Tabs" hidden></nav><span class="spacer"></span>' +
    '<span id="live" role="status" hidden></span>' +
    '<span id="pager" role="group" aria-label="Pages" hidden>' +
    '<button class="tool" id="prev" type="button" title="Previous page" aria-label="Previous page">‹</button>' +
    '<span id="page" aria-live="polite"></span>' +
    '<button class="tool" id="next" type="button" title="Next page" aria-label="Next page">›</button></span>' +
    '<button class="tool" id="out" type="button" title="Zoom out" aria-label="Zoom out">−</button>' +
    '<span id="zoom" aria-live="polite">100%</span>' +
    '<button class="tool" id="in" type="button" title="Zoom in" aria-label="Zoom in">+</button>' +
    '<button class="tool" id="fit" type="button" title="Fit to the frame">Fit</button>' +
    (opts.edits ? EDIT_HEADER : '') +
    '<button class="tool" id="open" type="button" title="Open this tab in the editor">Open in editor</button>' +
    '</header><main id="stage" tabindex="0" aria-label="The tab: drag to pan, scroll or pinch to zoom, click an element to open it in the editor">' +
    `<img id="art" alt=""><div id="ring" hidden></div>${opts.edits ? EDIT_STAGE : ''}${NOTE}</main>` +
    `<script>${viewerScript(app, opts)}</script></body></html>`
  );
}

function boardHtml(app: string, opts: ViewerOptions): string {
  return (
    head(app, BOARD_STYLE) +
    '<header><span id="title"></span><nav id="tabs" aria-label="Boards" hidden></nav><span class="spacer"></span>' +
    '<button class="tool" id="open" type="button" title="Open this board in the editor">Open in editor</button>' +
    `</header><main id="board" aria-label="The board: click a card to open it in the editor">${NOTE}</main>` +
    `<script>${boardViewerScript(app, opts.idKey ?? 'documentId')}</script></body></html>`
  );
}

/** The viewer page, for a product (its name, which the host hears at ui/initialize). */
export function viewerHtml(app: string, opts: ViewerOptions = {}): string {
  return opts.board ? boardHtml(app, opts) : canvasHtml(app, opts);
}

/** Lists the view page as a `ui://` resource on the server, its CSP allowing the sockets in `connectDomains`. */
export function registerViewResource(
  server: McpServer,
  opts: {
    uri: string;
    app: string;
    title: string;
    connectDomains?: readonly string[];
    viewer?: ViewerOptions;
  },
): void {
  const html = viewerHtml(opts.app, opts.viewer);
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
