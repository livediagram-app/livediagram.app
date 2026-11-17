import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VIEWER_SCRIPT, viewerScript } from './app-viewer-script';

// docs/specs/015-api/mcp-server.md "Live updates": the view's wiring, run in a stand-in frame. The host is a list of
// the JSON-RPC messages the page posts and the answers this test gives; the room is a stand-in WebSocket.

type Msg = {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
  answered?: boolean;
};
type Listener = (event: unknown) => void;
type FakeEl = {
  hidden: boolean;
  textContent: string;
  title: string;
  dataset: Record<string, string>;
  style: Record<string, string>;
};

class FakeSocket {
  static all: FakeSocket[] = [];
  closed: number | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeSocket.all.push(this);
  }
  close(code: number) {
    this.closed = code;
  }
  frame(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

function frame(script = VIEWER_SCRIPT) {
  const els: Record<string, FakeEl> = {};
  const el = (id: string) =>
    (els[id] ??= {
      hidden: false,
      textContent: '',
      title: '',
      dataset: {},
      style: {},
      addEventListener: () => {},
      setAttribute: () => {},
      appendChild: () => {},
      setPointerCapture: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 400 }),
    } as FakeEl);
  const sent: Msg[] = [];
  const onWindow: Record<string, Listener[]> = {};
  const onDocument: Record<string, Listener[]> = {};
  const doc = {
    hidden: false,
    getElementById: el,
    createElement: () => el(`made-${Math.random()}`),
    documentElement: { dataset: {} },
    body: { scrollWidth: 600 },
    addEventListener: (t: string, f: Listener) => void (onDocument[t] ??= []).push(f),
  };
  const win = {
    parent: { postMessage: (m: Msg) => void sent.push(m) },
    addEventListener: (t: string, f: Listener) => void (onWindow[t] ??= []).push(f),
    open: () => {},
  };
  // oxlint-disable-next-line typescript/no-implied-eval, typescript/no-unsafe-call -- runs the page's own script, as the frame does
  new Function('window', 'document', 'WebSocket', script)(win, doc, FakeSocket);

  const deliver = (data: unknown) => onWindow.message!.forEach((f) => f({ data }));
  const calls = (name: string) => sent.filter((m) => m.params?.name === name);
  const answer = (name: string, result: unknown) => {
    const m = sent.find((x) => (x.method === name || x.params?.name === name) && !x.answered)!;
    expect(m, `a pending ${name}`).toBeTruthy();
    m.answered = true;
    deliver({ jsonrpc: '2.0', id: m.id, result });
  };
  const flush = () => vi.advanceTimersByTimeAsync(0);
  const live = () => els.live!;
  const setHidden = (hidden: boolean) => {
    doc.hidden = hidden;
    onDocument.visibilitychange!.forEach((f) => f({}));
  };
  return { sent, deliver, calls, answer, flush, live, setHidden, el };
}

const TAB = {
  documentId: 'd1',
  tabId: 't1',
  name: 'Main',
  tabs: [{ id: 't1', name: 'Main' }],
  svg: '<svg viewBox="0 0 10 10"></svg>',
  viewBox: { x: 0, y: 0, width: 10, height: 10 },
  elements: [],
  url: 'https://www.acme.app/document/d1',
};
const LIVE = (expiresAt = Date.now() + 600_000) => ({
  structuredContent: {
    documentId: 'd1',
    url: 'wss://www.acme.app/api/documents/d1/ws',
    ticket: 'rt2~sealed',
    expiresAt,
  },
});
const op = (o: Record<string, unknown>) => ({ kind: 'op', from: 'p', op: o });

// A frame showing tab t1 and following it: initialised, given a result, the tab drawn, the ticket minted.
async function following() {
  const f = frame();
  f.answer('ui/initialize', { hostContext: {} });
  f.deliver({
    jsonrpc: '2.0',
    method: 'ui/notifications/tool-result',
    params: { structuredContent: { documentId: 'd1', tabId: 't1' } },
  });
  await f.flush();
  f.answer('view_tab', { structuredContent: TAB });
  await f.flush();
  f.answer('view_live', LIVE());
  await f.flush();
  return f;
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.all = [];
});
afterEach(() => vi.useRealTimers());

describe('the view following a document live', () => {
  it('asks for its ticket once the tab is drawn, and opens the room with it, listening only', async () => {
    const f = await following();
    expect(f.calls('view_live')[0]!.params!.arguments).toEqual({ documentId: 'd1' });
    expect(FakeSocket.all.map((s) => s.url)).toEqual([
      'wss://www.acme.app/api/documents/d1/ws?t=rt2~sealed',
    ]);
    expect(f.live().textContent).toBe('');
    FakeSocket.all[0]!.onopen!();
    expect(f.live()).toMatchObject({ hidden: false, textContent: 'Live' });
    expect(f.live().dataset.state).toBe('live');
  });

  it('draws the shown tab again for its changes, at most once a beat, keeping quiet otherwise', async () => {
    const f = await following();
    const ws = FakeSocket.all[0]!;
    ws.onopen!();
    ws.frame(op({ kind: 'cursor', tabId: 't1', x: 1, y: 1 }));
    ws.frame(op({ kind: 'el', tabId: 't2' }));
    ws.frame('not json');
    await vi.advanceTimersByTimeAsync(5_000);
    expect(f.calls('view_tab')).toHaveLength(1);
    for (let i = 0; i < 20; i++) ws.frame(op({ kind: 'el', tabId: 't1' }));
    ws.frame(op({ kind: 'tab-saved', tabId: 't1', rev: 2, digest: 'x' }));
    await vi.advanceTimersByTimeAsync(1_500);
    expect(f.calls('view_tab')).toHaveLength(2);
    expect(f.calls('view_tab')[1]!.params!.arguments).toEqual({ documentId: 'd1', tabId: 't1' });
  });

  it('mints a fresh ticket within the old one’s life, and draws once it reopens', async () => {
    const f = await following();
    const first = FakeSocket.all[0]!;
    first.onopen!();
    await vi.advanceTimersByTimeAsync(600_000 - 30_000);
    expect(first.closed).toBe(1000);
    expect(f.calls('view_live')).toHaveLength(2);
    f.answer('view_live', LIVE());
    await f.flush();
    FakeSocket.all[1]!.onopen!();
    expect(f.calls('view_tab')).toHaveLength(2);
  });

  it('reconnects when the room drops it, backing off, and stops after six tries', async () => {
    const f = await following();
    FakeSocket.all[0]!.onclose!({ code: 4007 });
    expect(f.live()).toMatchObject({ textContent: 'Reconnecting' });
    const waits = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
    for (const [i, wait] of waits.entries()) {
      await vi.advanceTimersByTimeAsync(wait - 1);
      expect(f.calls('view_live'), `try ${i + 1}`).toHaveLength(i + 1);
      await vi.advanceTimersByTimeAsync(1);
      f.answer('view_live', LIVE());
      await f.flush();
      FakeSocket.all.at(-1)!.onclose!({ code: 1006 });
    }
    expect(f.live()).toMatchObject({ textContent: 'Snapshot' });
    expect(f.live().title).toContain('connection kept dropping');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(f.calls('view_live')).toHaveLength(7);
  });

  it('falls back to the snapshot when its ticket is refused, as for a revoked grant', async () => {
    const f = await following();
    FakeSocket.all[0]!.onclose!({ code: 4005 });
    await vi.advanceTimersByTimeAsync(1_000);
    f.answer('view_live', { isError: true, content: [{ type: 'text', text: 'not found' }] });
    await f.flush();
    expect(f.live()).toMatchObject({ textContent: 'Snapshot' });
    expect(f.live().dataset.state).toBe('off');
    expect(f.live().title).toMatch(
      /^Live updates are off for this document\. Showing the tab as drawn at /,
    );
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('falls back when the host cannot reach the server', async () => {
    const f = frame();
    f.answer('ui/initialize', { hostContext: {} });
    f.deliver({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { documentId: 'd1' } },
    });
    await f.flush();
    f.answer('view_tab', { structuredContent: TAB });
    await f.flush();
    const m = f.calls('view_live')[0]!;
    f.deliver({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: 'down' } });
    await f.flush();
    expect(f.live()).toMatchObject({ textContent: 'Snapshot' });
    expect(FakeSocket.all).toHaveLength(0);
  });

  it('stops for good when the document moves to the Trash', async () => {
    const f = await following();
    FakeSocket.all[0]!.onopen!();
    FakeSocket.all[0]!.frame(op({ kind: 'document-trashed' }));
    expect(f.live().title).toContain('moved to the Trash');
    expect(FakeSocket.all[0]!.closed).toBe(1000);
    const f2 = await following();
    FakeSocket.all.at(-1)!.onclose!({ code: 4004 });
    expect(f2.live().title).toContain('moved to the Trash');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f2.calls('view_live')).toHaveLength(1);
  });

  it('holds nothing in the room while hidden, and catches up when shown', async () => {
    const f = await following();
    FakeSocket.all[0]!.onopen!();
    f.setHidden(true);
    expect(FakeSocket.all[0]!.closed).toBe(1000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.calls('view_live')).toHaveLength(1);
    f.setHidden(false);
    f.setHidden(false);
    expect(f.calls('view_live')).toHaveLength(2);
    f.answer('view_live', LIVE());
    await f.flush();
    FakeSocket.all[1]!.onopen!();
    expect(f.calls('view_tab')).toHaveLength(2);
  });

  it('opens no socket for a ticket that arrives while hidden', async () => {
    const f = frame();
    f.answer('ui/initialize', {});
    f.deliver({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { documentId: 'd1' } },
    });
    await f.flush();
    f.answer('view_tab', { structuredContent: TAB });
    await f.flush();
    f.setHidden(true);
    f.answer('view_live', LIVE());
    await f.flush();
    expect(FakeSocket.all).toHaveLength(0);
  });

  it('drops a redraw that lands after a switch to another tab', async () => {
    const f = await following();
    const ws = FakeSocket.all[0]!;
    ws.onopen!();
    ws.frame(op({ kind: 'el', tabId: 't1' }));
    await vi.advanceTimersByTimeAsync(1_500);
    f.deliver({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { documentId: 'd1', tabId: 't2' } },
    });
    await f.flush();
    // The quiet redraw of t1 answers late, after the switch: it is dropped, and no new ticket is asked for.
    f.answer('view_tab', { structuredContent: TAB });
    await f.flush();
    f.answer('view_tab', { structuredContent: { ...TAB, tabId: 't2', name: 'Two' } });
    await f.flush();
    expect(f.calls('view_live')).toHaveLength(1);
    // A failed quiet redraw changes nothing either.
    ws.frame(op({ kind: 'el', tabId: 't2' }));
    await vi.advanceTimersByTimeAsync(1_500);
    f.answer('view_tab', { isError: true });
    await f.flush();
    expect(f.live().textContent).toBe('Live');
  });

  it('keeps the old picture when the shown tab is deleted, never jumping to the first tab', async () => {
    const f = await following();
    const ws = FakeSocket.all[0]!;
    ws.onopen!();
    const art = f.el('art') as FakeEl & { src?: string };
    const drawn = art.src;
    expect(drawn).toContain(encodeURIComponent(TAB.svg));
    // The tab list changes (t1 deleted): the redraw asks for t1 and gets the document's first tab back.
    ws.frame(op({ kind: 'document-meta' }));
    await vi.advanceTimersByTimeAsync(1_500);
    const first = { ...TAB, tabId: 't0', name: 'First', svg: '<svg viewBox="0 0 5 5"><g/></svg>' };
    first.tabs = [{ id: 't0', name: 'First' }];
    f.answer('view_tab', { structuredContent: first });
    await f.flush();
    expect(art.src).toBe(drawn);
    expect(f.el('title').textContent).toBe('Main');
    // Or the server refuses the gone tab: still the old picture, still Live, and the next change asks for t1 again.
    ws.frame(op({ kind: 'tab', tabId: 't1' }));
    await vi.advanceTimersByTimeAsync(1_500);
    f.answer('view_tab', { isError: true, content: [{ type: 'text', text: 'No tab "t1"' }] });
    await f.flush();
    expect(art.src).toBe(drawn);
    expect(f.live().textContent).toBe('Live');
    expect(f.calls('view_tab').at(-1)!.params!.arguments).toEqual({
      documentId: 'd1',
      tabId: 't1',
    });
  });
});

// livedesign's and livedocuments' mcp-server.md "Live updates": a view of pages follows its file the same way, by its
// own id key, in its own words, and for the ops its room relays.
describe('a page view following a design live', () => {
  async function following() {
    const f = frame(viewerScript('livedesign', { idKey: 'designId', word: 'design' }));
    f.answer('ui/initialize', { hostContext: {} });
    f.deliver({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { designId: 'g1', tabId: 't1' } },
    });
    await f.flush();
    f.answer('view_tab', { structuredContent: { ...TAB, designId: 'g1', pageId: 'p2' } });
    await f.flush();
    f.answer('view_live', {
      structuredContent: {
        designId: 'g1',
        url: 'wss://www.acme.app/api/designs/g1/ws',
        ticket: 'rt2~s',
        expiresAt: Date.now() + 600_000,
      },
    });
    await f.flush();
    return f;
  }

  it('asks by the design’s id and redraws the page shown for its photo, component and tab-list changes', async () => {
    const f = await following();
    expect(f.calls('view_live')[0]!.params!.arguments).toEqual({ designId: 'g1' });
    const ws = FakeSocket.all[0]!;
    expect(ws.url).toBe('wss://www.acme.app/api/designs/g1/ws?t=rt2~s');
    ws.onopen!();
    expect(f.live().title).toBe('Live: this view follows the design as people change it.');
    for (const change of [
      op({ kind: 'photo', tabId: 't1' }),
      op({ kind: 'component', main: 'm1' }),
      op({ kind: 'design-meta', tabs: [] }),
    ]) {
      ws.frame(change);
      await vi.advanceTimersByTimeAsync(1_500);
      expect(f.calls('view_tab').at(-1)!.params!.arguments).toEqual({
        designId: 'g1',
        tabId: 't1',
        pageId: 'p2',
      });
      f.answer('view_tab', { structuredContent: { ...TAB, designId: 'g1', pageId: 'p2' } });
      await f.flush();
    }
    expect(f.calls('view_tab')).toHaveLength(4);
  });

  it('stops when the design moves to the Trash, saying so in its words', async () => {
    const f = await following();
    FakeSocket.all[0]!.onopen!();
    FakeSocket.all[0]!.frame(op({ kind: 'design-trashed' }));
    expect(f.live().textContent).toBe('Snapshot');
    expect(f.live().title).toMatch(
      /^This design moved to the Trash\. Showing the tab as drawn at /,
    );
  });
});
