import { describe, expect, it } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  VIEWER_EDIT_HTML_BUDGET_BYTES,
  VIEWER_HTML_BUDGET_BYTES,
  VIEW_MIME_TYPE,
  appOnlyToolMeta,
  registerViewResource,
  socketOriginOf,
  toolUiMeta,
  viewResourceMeta,
  viewerHtml,
} from './app-view';
import { VIEWER_SCRIPT, compactScript, viewerScript } from './app-viewer-script';

// docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)": the ui:// resource, the tool meta that links it,
// and the viewer page with its pure parts.

type View = { scale: number; x: number; y: number };
type Ldv = {
  subjectOf: (r: unknown) => { documentId: string; tabId: string | null } | null;
  fitOf: (w: number, h: number, bw: number, bh: number) => View;
  zoomAt: (v: View, f: number, px: number, py: number) => View;
  hitTest: (
    v: View,
    box: { x: number; y: number },
    els: { id: string; x: number; y: number; width: number; height: number }[],
    px: number,
    py: number,
  ) => { id: string } | null;
  elementLink: (url: string, tab: string, el: string | null, item?: string) => string;
  num: (v: unknown) => boolean;
  pagerOf: (
    pages: unknown,
    pageId: string | null,
  ) => { at: number; label: string; name: string; prev: string | null; next: string | null } | null;
  changeOf: (frame: unknown, tabId: string | null, own?: string[]) => 'redraw' | 'trashed' | null;
  retryAfter: (tries: number) => number;
  stopWords: (why: string) => string;
};

// The script's pure parts, evaluated as the page would, with no window: the wiring never runs.
// oxlint-disable-next-line typescript/no-implied-eval, typescript/no-unsafe-call -- runs the page's own script, as the frame does
const LDV = new Function('window', `${VIEWER_SCRIPT}; return LDV;`)(undefined) as Ldv;

describe('the view resource and the tool meta', () => {
  it('links a tool by the extension’s key and the older flat one, and hides the view’s own tool', () => {
    expect(toolUiMeta('ui://x/view.html')).toEqual({
      ui: { resourceUri: 'ui://x/view.html' },
      'ui/resourceUri': 'ui://x/view.html',
    });
    expect(appOnlyToolMeta()).toEqual({ ui: { visibility: ['app'] } });
  });

  it('lists the page as text/html;profile=mcp-app with no network but the sockets it names', async () => {
    let read: ((uri: URL) => Promise<{ contents: { text: string; mimeType: string }[] }>) | null =
      null;
    let meta: Record<string, unknown> = {};
    const server = {
      registerResource: (_n: string, uri: string, m: Record<string, unknown>, cb: typeof read) => {
        expect(uri).toBe('ui://acme/view.html');
        meta = m;
        read = cb;
      },
    } as unknown as McpServer;
    registerViewResource(server, {
      uri: 'ui://acme/view.html',
      app: 'acme',
      title: 'acme view',
      connectDomains: ['wss://www.acme.app'],
    });
    const csp = { connectDomains: ['wss://www.acme.app'], resourceDomains: [] };
    expect(meta).toMatchObject({ mimeType: VIEW_MIME_TYPE, _meta: { ui: { csp } } });
    const { contents } = await read!(new URL('ui://acme/view.html'));
    expect(contents[0]!.mimeType).toBe(VIEW_MIME_TYPE);
    expect(contents[0]!.text).toContain('var APP = "acme", ID_KEY = "documentId", LIVE_ON = true');
    // With none named, nothing at all.
    expect(viewResourceMeta().ui.csp).toEqual({ connectDomains: [], resourceDomains: [] });
  });

  it('names the socket origin of an app base', () => {
    expect(socketOriginOf('https://www.acme.app')).toBe('wss://www.acme.app');
    expect(socketOriginOf('https://staging.acme.app/some/path')).toBe('wss://staging.acme.app');
    expect(socketOriginOf('http://localhost:3100')).toBe('ws://localhost:3100');
  });

  it('keeps every page self-contained and within its budget', () => {
    const pages = [
      viewerHtml('livediagram'),
      viewerHtml('livedocuments', { idKey: 'documentId', live: false }),
      viewerHtml('livedesign', { idKey: 'designId', live: false }),
      viewerHtml('liveplanner', { idKey: 'projectId', live: false, board: true }),
    ];
    for (const html of pages) {
      expect(new TextEncoder().encode(html).length).toBeLessThan(VIEWER_HTML_BUDGET_BYTES);
      expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=|https?:\/\//);
    }
    // The canvas pages carry the pager; the board page draws columns, with none of the canvas's parts.
    expect(pages[1]).toContain('id="pager"');
    expect(pages[2]).toContain('ID_KEY = "designId", LIVE_ON = false');
    expect(pages[3]).toContain('id="board"');
    expect(pages[3]).not.toContain('id="stage"');
    expect(pages[3]).toContain('ID_KEY = "projectId"');
    expect(viewerHtml('liveplanner', { board: true })).toContain('ID_KEY = "documentId"');
    // None of them carries the edit parts ("Edits in the view").
    for (const html of pages) expect(html).not.toMatch(/id="edit"|view_edit|nudgeOf/);
  });

  it('keeps the page with the edit parts self-contained and within its own budget', () => {
    const html = viewerHtml('livediagram', { edits: true });
    expect(new TextEncoder().encode(html).length).toBeLessThan(VIEWER_EDIT_HTML_BUDGET_BYTES);
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=|https?:\/\//);
    expect(html).toContain(
      '<button class="tool" id="edit" type="button" aria-pressed="false" hidden>',
    );
    expect(html).toContain('id="name-box"');
    for (const id of ['edit', 'sel', 'bar', 'name-box']) expect(html).toContain(`#${id}[hidden]`);
  });

  it('ships the script without indentation, blank lines or comment lines', () => {
    expect(compactScript('  var a = 1;\n\n  // why\n    b();  ')).toBe('var a = 1;\nb();');
    for (const line of viewerScript('livediagram', { edits: true }).split('\n')) {
      expect(line).toBe(line.trim());
      expect(line.startsWith('//')).toBe(false);
    }
  });

  it('passes the viewer’s options from the resource to the page', async () => {
    let read: ((uri: URL) => Promise<{ contents: { text: string }[] }>) | null = null;
    const server = {
      registerResource: (_n: string, _u: string, _m: unknown, cb: typeof read) => void (read = cb),
    } as unknown as McpServer;
    registerViewResource(server, {
      uri: 'ui://p/view.html',
      app: 'liveplanner',
      title: 'liveplanner view',
      viewer: { idKey: 'projectId', board: true, live: false },
    });
    const { contents } = await read!(new URL('ui://p/view.html'));
    expect(contents[0]!.text).toContain('id="board"');
  });

  it('quotes the app name into the script, so a name never breaks out of its string', () => {
    expect(viewerScript('a"b')).toContain('var APP = "a\\"b"');
  });

  // A view that does not follow the room (live: false) never shows the live mark: its display rule must not
  // override the hidden attribute it starts with, or an empty grey dot sits in the header.
  it('keeps every hidden header control hidden', () => {
    const html = viewerHtml('livedocuments', { idKey: 'documentId', live: false });
    expect(html).toContain('<span id="live" role="status" hidden></span>');
    for (const id of ['live', 'pager']) expect(html).toContain(`#${id}[hidden]{display:none}`);
    // On a phone the tabs take a row of their own, and the pager stands in for the zoom buttons (pinch zooms).
    expect(html).toContain('#tabs{order:9;flex-basis:100%}');
    expect(html).toContain('#pager:not([hidden])~#out');
  });
});

describe('the viewer’s pure parts', () => {
  it('reads the document and tab from each tool’s structured result', () => {
    expect(LDV.subjectOf({ structuredContent: { documentId: 'd', tabIds: ['t1', 't2'] } })).toEqual(
      { documentId: 'd', tabId: 't1' },
    );
    expect(LDV.subjectOf({ structuredContent: { documentId: 'd', tabId: 't' } })).toEqual({
      documentId: 'd',
      tabId: 't',
    });
    expect(LDV.subjectOf({ structuredContent: { id: 'd', tab: { id: 't' } } })).toEqual({
      documentId: 'd',
      tabId: 't',
    });
    expect(LDV.subjectOf({ structuredContent: { id: 'd' } })).toEqual({
      documentId: 'd',
      tabId: null,
    });
    expect(LDV.subjectOf({ structuredContent: { name: 'x' } })).toBeNull();
    expect(LDV.subjectOf({ structuredContent: 'x' })).toBeNull();
    expect(LDV.subjectOf(null)).toBeNull();
  });

  it('fits a picture into the frame with a margin, never past twice its size', () => {
    expect(LDV.fitOf(1000, 500, 524, 400)).toEqual({ scale: 0.5, x: 12, y: 75 });
    expect(LDV.fitOf(10, 10, 524, 424).scale).toBe(2);
    expect(LDV.fitOf(0, 10, 100, 100)).toEqual({ scale: 1, x: 0, y: 0 });
    expect(LDV.fitOf(1e7, 1e7, 100, 100).scale).toBe(0.05);
  });

  it('zooms about the pointer, within its bounds', () => {
    expect(LDV.zoomAt({ scale: 1, x: 0, y: 0 }, 2, 100, 50)).toEqual({ scale: 2, x: -100, y: -50 });
    expect(LDV.zoomAt({ scale: 4, x: 0, y: 0 }, 10, 0, 0).scale).toBe(8);
    expect(LDV.zoomAt({ scale: 0.1, x: 0, y: 0 }, 0.01, 0, 0).scale).toBe(0.05);
  });

  it('finds the topmost element under a point, in the tab’s coordinates', () => {
    const els = [
      { id: 'under', x: 0, y: 0, width: 100, height: 100 },
      { id: 'over', x: 50, y: 50, width: 20, height: 20 },
    ];
    const view = { scale: 2, x: 10, y: 10 };
    const box = { x: -10, y: -10 };
    expect(LDV.hitTest(view, box, els, 10 + (60 + 10) * 2, 10 + (60 + 10) * 2)!.id).toBe('over');
    expect(LDV.hitTest(view, box, els, 10 + 20 * 2, 10 + 20 * 2)!.id).toBe('under');
    expect(LDV.hitTest(view, box, els, 1000, 1000)).toBeNull();
  });

  it('reads designs and plans by their own id keys', () => {
    expect(LDV.subjectOf({ structuredContent: { designId: 'g', tabId: 't' } })).toEqual({
      documentId: 'g',
      tabId: 't',
    });
    expect(LDV.subjectOf({ structuredContent: { projectId: 'p', boards: [] } })).toEqual({
      documentId: 'p',
      tabId: null,
    });
  });

  it('places the shown page among the tab’s pages, and shows no pager for one page', () => {
    const pages = [
      { id: 'a', name: 'Cover' },
      { id: 'b', name: 'Page 2' },
      { id: 'c', name: 'End' },
    ];
    expect(LDV.pagerOf(pages, 'b')).toEqual({
      at: 1,
      label: '2 / 3',
      name: 'Page 2',
      prev: 'a',
      next: 'c',
    });
    expect(LDV.pagerOf(pages, 'a')).toMatchObject({ label: '1 / 3', prev: null, next: 'b' });
    expect(LDV.pagerOf(pages, 'c')).toMatchObject({ prev: 'b', next: null });
    expect(LDV.pagerOf(pages, 'gone')).toMatchObject({ at: 0 });
    expect(LDV.pagerOf(pages.slice(0, 1), 'a')).toBeNull();
    expect(LDV.pagerOf(undefined, null)).toBeNull();
  });

  it('links the editor at an element, or at the tab', () => {
    expect(LDV.elementLink('https://x.app/document/d#old', 't 1', 'e/1')).toBe(
      'https://x.app/document/d#t=t%201&el=e%2F1',
    );
    expect(LDV.elementLink('https://x.app/document/d', 't', null)).toBe(
      'https://x.app/document/d#t=t',
    );
    expect(LDV.elementLink('https://x.app/project/p', 't', 'board 1', 'card/2')).toBe(
      'https://x.app/project/p#t=t&el=board%201&item=card%2F2',
    );
    expect([LDV.num(1), LDV.num(Number.NaN), LDV.num('1')]).toEqual([true, false, false]);
  });

  // docs/specs/015-api/mcp-server.md "Live updates".
  it('draws again for a content change or a save on the shown tab, or the tab list, and for nothing else', () => {
    const op = (o: Record<string, unknown>) => ({ kind: 'op', from: 'x', op: o });
    for (const kind of [
      'tab',
      'el',
      'tab-meta',
      'el-delta',
      'vote',
      'qa',
      'changeset',
      'tab-saved',
    ]) {
      expect(LDV.changeOf(op({ kind, tabId: 't1' }), 't1'), kind).toBe('redraw');
      expect(LDV.changeOf(op({ kind, tabId: 't2' }), 't1'), kind).toBeNull();
    }
    expect(LDV.changeOf(op({ kind: 'document-meta', tabs: [] }), 't1')).toBe('redraw');
    expect(LDV.changeOf(op({ kind: 'document-trashed' }), 't1')).toBe('trashed');
    for (const kind of [
      'cursor',
      'laser',
      'select',
      'viewport',
      'drag-preview',
      'reaction',
      'poll-answer',
    ]) {
      expect(LDV.changeOf(op({ kind, tabId: 't1' }), 't1'), kind).toBeNull();
    }
    expect(LDV.changeOf(op({ kind: 'constructor' }), 't1')).toBeNull();
    expect(LDV.changeOf(op({ kind: 'el' }), 't1')).toBe('redraw');
    expect(LDV.changeOf({ kind: 'presence', participants: [] }, 't1')).toBeNull();
    expect(LDV.changeOf({ kind: 'op', op: null }, 't1')).toBeNull();
    expect(LDV.changeOf({ kind: 'op', op: { kind: 3 } }, 't1')).toBeNull();
    expect(LDV.changeOf(null, 't1')).toBeNull();
    // The view's own edit, drawn from view_edit's answer, draws nothing more; anyone else's does.
    const cs = (id: string) => op({ kind: 'changeset', tabId: 't1', id });
    expect(LDV.changeOf(cs('cs1'), 't1', ['cs1'])).toBeNull();
    expect(LDV.changeOf(cs('cs2'), 't1', ['cs1'])).toBe('redraw');
    expect(LDV.changeOf(cs('cs1'), 't1', null as unknown as string[])).toBe('redraw');
  });

  it('backs off from one second, doubling to thirty, then stops after six tries', () => {
    expect([0, 1, 2, 3, 4, 5].map(LDV.retryAfter)).toEqual([1000, 2000, 4000, 8000, 16000, 30000]);
    expect(LDV.retryAfter(6)).toBe(-1);
  });

  it('says quietly why live updates stopped', () => {
    expect(LDV.stopWords('trashed')).toBe('This document moved to the Trash.');
    expect(LDV.stopWords('lost')).toContain('connection kept dropping');
    expect(LDV.stopWords('refused')).toBe('Live updates are off for this document.');
  });
});

// docs/specs/015-api/mcp-server.md "Edits in the view": the edit parts' pure parts, on a page that edits.
type EditLdv = {
  NUDGE_SETTLE_MS: number;
  OWN_MAX: number;
  nudgeOf: (key: string, fine: boolean) => [number, number] | null;
  moveOf: (dx: number, dy: number, scale: number) => [number, number];
  stepOf: (els: { id: string }[], id: string | null, back: boolean) => number;
  hintOf: (el: { canMove: boolean; canRename: boolean }) => string;
};
// oxlint-disable-next-line typescript/no-implied-eval, typescript/no-unsafe-call -- runs the page's own script, as the frame does
const EDIT_LDV = new Function(
  'window',
  `${viewerScript('livediagram', { edits: true })}; return LDV;`,
)(undefined) as EditLdv;

describe('the edit parts’ pure parts', () => {
  it('nudges ten pixels by an arrow key, one with Shift, and nothing for other keys', () => {
    expect(EDIT_LDV.nudgeOf('ArrowLeft', false)).toEqual([-10, 0]);
    expect(EDIT_LDV.nudgeOf('ArrowRight', true)).toEqual([1, 0]);
    expect(EDIT_LDV.nudgeOf('ArrowUp', false)).toEqual([0, -10]);
    expect(EDIT_LDV.nudgeOf('ArrowDown', true)).toEqual([0, 1]);
    expect(EDIT_LDV.nudgeOf('Enter', false)).toBeNull();
    expect(EDIT_LDV.NUDGE_SETTLE_MS).toBe(400);
  });

  it('turns a drag on screen into whole pixels of the tab', () => {
    expect(EDIT_LDV.moveOf(30, -15, 0.5)).toEqual([60, -30]);
    expect(EDIT_LDV.moveOf(3, 1, 2)).toEqual([2, 1]);
    expect(EDIT_LDV.moveOf(-0.2, 0.2, 1)).toEqual([0, 0]);
  });

  it('steps the selection through the elements, and off either end', () => {
    const els = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(EDIT_LDV.stepOf(els, null, false)).toBe(0);
    expect(EDIT_LDV.stepOf(els, null, true)).toBe(2);
    expect(EDIT_LDV.stepOf(els, 'a', false)).toBe(1);
    expect(EDIT_LDV.stepOf(els, 'b', true)).toBe(0);
    expect(EDIT_LDV.stepOf(els, 'c', false)).toBe(-1);
    expect(EDIT_LDV.stepOf(els, 'a', true)).toBe(-1);
    expect(EDIT_LDV.stepOf([], null, false)).toBe(-1);
  });

  it('says what an element allows', () => {
    expect(EDIT_LDV.hintOf({ canMove: true, canRename: true })).toBe('Drag to move');
    expect(EDIT_LDV.hintOf({ canMove: true, canRename: false })).toBe('Drag to move');
    expect(EDIT_LDV.hintOf({ canMove: false, canRename: true })).toBe('Move it in the editor');
    expect(EDIT_LDV.hintOf({ canMove: false, canRename: false })).toBe('Locked');
  });
});
