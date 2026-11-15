import { describe, expect, it } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  VIEWER_HTML_BUDGET_BYTES,
  VIEW_MIME_TYPE,
  VIEW_RESOURCE_META,
  appOnlyToolMeta,
  registerViewResource,
  toolUiMeta,
  viewerHtml,
} from './app-view';
import { VIEWER_SCRIPT } from './app-viewer-script';

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
  elementLink: (url: string, tab: string, el: string | null) => string;
  num: (v: unknown) => boolean;
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

  it('lists the page as text/html;profile=mcp-app with no network allowed', async () => {
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
    registerViewResource(server, { uri: 'ui://acme/view.html', app: 'acme', title: 'acme view' });
    expect(meta).toMatchObject({ mimeType: VIEW_MIME_TYPE, _meta: VIEW_RESOURCE_META });
    expect(VIEW_RESOURCE_META.ui.csp).toEqual({ connectDomains: [], resourceDomains: [] });
    const { contents } = await read!(new URL('ui://acme/view.html'));
    expect(contents[0]!.mimeType).toBe(VIEW_MIME_TYPE);
    expect(contents[0]!.text).toContain("name: 'acme-view'");
  });

  it('keeps the page self-contained and within its budget', () => {
    const html = viewerHtml('livediagram');
    expect(new TextEncoder().encode(html).length).toBeLessThan(VIEWER_HTML_BUDGET_BYTES);
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=|https?:\/\//);
    expect(html).not.toContain('__APP__');
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

  it('links the editor at an element, or at the tab', () => {
    expect(LDV.elementLink('https://x.app/document/d#old', 't 1', 'e/1')).toBe(
      'https://x.app/document/d#t=t%201&el=e%2F1',
    );
    expect(LDV.elementLink('https://x.app/document/d', 't', null)).toBe(
      'https://x.app/document/d#t=t',
    );
    expect([LDV.num(1), LDV.num(Number.NaN), LDV.num('1')]).toEqual([true, false, false]);
  });
});
