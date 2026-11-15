import { describe, expect, it, vi } from 'vitest';
import { viewerScript } from './app-viewer-script';
import { boardViewerScript } from './app-viewer-board-script';

// Each product's docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)": the page of a tab of pages (its
// pager) and liveplanner's board, run in a stand-in frame. The host is the list of JSON-RPC messages the page posts
// and the answers this test gives.

type Msg = {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: { name?: string; arguments?: Record<string, unknown>; url?: string };
  answered?: boolean;
};
type Listener = (event: unknown) => void;

class FakeEl {
  id: string;
  tag: string;
  className = '';
  hidden = false;
  title = '';
  type = '';
  disabled = false;
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attrs: Record<string, string> = {};
  children: FakeEl[] = [];
  onclick: (() => void) | null = null;
  on: Record<string, Listener[]> = {};
  private text = '';
  constructor(id: string, tag = 'div') {
    this.id = id;
    this.tag = tag;
  }
  get textContent(): string {
    return this.text + this.children.map((c) => c.textContent).join('');
  }
  set textContent(v: string) {
    this.text = v;
    this.children = [];
  }
  setAttribute(k: string, v: string) {
    this.attrs[k] = v;
  }
  appendChild(c: FakeEl) {
    this.children.push(c);
  }
  addEventListener(t: string, f: Listener) {
    (this.on[t] ??= []).push(f);
  }
  setPointerCapture() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 600, height: 400 };
  }
  // Every element under this one with the class, depth first.
  all(cls: string): FakeEl[] {
    return this.children.flatMap((c) => [
      ...(c.className.split(' ').includes(cls) ? [c] : []),
      ...c.all(cls),
    ]);
  }
}

function frame(script: string) {
  const els: Record<string, FakeEl> = {};
  const el = (id: string) => (els[id] ??= new FakeEl(id));
  const sent: Msg[] = [];
  const onWindow: Record<string, Listener[]> = {};
  const doc = {
    hidden: false,
    getElementById: el,
    createElement: (tag: string) => new FakeEl('', tag),
    documentElement: { dataset: {} as Record<string, string> },
    body: { scrollWidth: 600 },
    addEventListener: () => {},
  };
  const win = {
    parent: { postMessage: (m: Msg) => void sent.push(m) },
    addEventListener: (t: string, f: Listener) => void (onWindow[t] ??= []).push(f),
    open: vi.fn(),
  };
  // oxlint-disable-next-line typescript/no-implied-eval, typescript/no-unsafe-call -- runs the page's own script, as the frame does
  new Function('window', 'document', 'WebSocket', script)(win, doc, class {});
  const deliver = (data: unknown) => onWindow.message!.forEach((f) => f({ data }));
  const pendingCall = (name: string) =>
    sent.find((x) => (x.method === name || x.params?.name === name) && !x.answered);
  const answer = (name: string, result: unknown, error?: unknown) => {
    const m = pendingCall(name)!;
    expect(m, `a pending ${name}`).toBeTruthy();
    m.answered = true;
    deliver({ jsonrpc: '2.0', id: m.id, ...(error ? { error } : { result }) });
  };
  const result = (structuredContent: Record<string, unknown>) =>
    deliver({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent },
    });
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { sent, deliver, answer, result, flush, el, win, doc, pendingCall };
}

const PAGE = (pageId: string) => ({
  designId: 'g1',
  tabId: 't1',
  name: 'Screens',
  tabs: [
    { id: 't1', name: 'Screens' },
    { id: 't2', name: 'Logo' },
  ],
  pageId,
  pages: [
    { id: 'p1', name: 'Home' },
    { id: 'p2', name: 'Page 2' },
    { id: 'p3', name: 'Checkout' },
  ],
  svg: '<svg viewBox="0 0 390 844"></svg>',
  viewBox: { x: 0, y: 0, width: 390, height: 844 },
  elements: [{ id: 'buy', ref: 'buy', label: 'Buy', x: 0, y: 0, width: 390, height: 844 }],
  url: 'https://www.acme.app/design/g1',
});

describe('the view of a tab of pages', () => {
  async function shown() {
    const f = frame(viewerScript('livedesign', { idKey: 'designId', live: false }));
    f.answer('ui/initialize', { hostContext: { theme: 'dark' } });
    await f.flush();
    f.result({ designId: 'g1', tabId: 't1' });
    await f.flush();
    f.answer('view_tab', { structuredContent: PAGE('p1') });
    await f.flush();
    return f;
  }

  it('asks by the product’s id key, shows the first page with a pager, and follows nothing live', async () => {
    const f = await shown();
    const asked = f.sent.filter((m) => m.params?.name === 'view_tab');
    expect(asked[0]!.params!.arguments).toEqual({ designId: 'g1', tabId: 't1' });
    expect(f.el('pager').hidden).toBe(false);
    expect(f.el('page').textContent).toBe('1 / 3');
    expect(f.el('page').title).toBe('Home');
    expect([f.el('prev').disabled, f.el('next').disabled]).toEqual([true, false]);
    expect(f.sent.some((m) => m.params?.name === 'view_live')).toBe(false);
    expect(f.el('live').hidden).toBe(false);
    expect(f.el('live').textContent).toBe('');
    expect(f.doc.documentElement.dataset.theme).toBe('dark');
  });

  it('flips pages from the pager and the keyboard, and a new tab starts at its first page', async () => {
    const f = await shown();
    f.el('next').onclick!();
    await f.flush();
    expect(f.pendingCall('view_tab')!.params!.arguments).toEqual({
      designId: 'g1',
      tabId: 't1',
      pageId: 'p2',
    });
    f.answer('view_tab', { structuredContent: PAGE('p2') });
    await f.flush();
    expect(f.el('page').textContent).toBe('2 / 3');
    expect([f.el('prev').disabled, f.el('next').disabled]).toEqual([false, false]);
    const key = (k: string) => {
      const e = { key: k, preventDefault: vi.fn() };
      f.el('stage').on.keydown!.forEach((h) => h(e));
      return e;
    };
    expect(key('PageDown').preventDefault).toHaveBeenCalled();
    await f.flush();
    expect(f.pendingCall('view_tab')!.params!.arguments).toMatchObject({ pageId: 'p3' });
    f.answer('view_tab', { structuredContent: PAGE('p3') });
    await f.flush();
    expect(f.el('next').disabled).toBe(true);
    key('PageDown');
    f.el('next').onclick!();
    expect(f.pendingCall('view_tab')).toBeUndefined();
    key('PageUp');
    f.el('prev').onclick!();
    await f.flush();
    expect(f.pendingCall('view_tab')!.params!.arguments).toMatchObject({ pageId: 'p2' });
    f.answer('view_tab', { structuredContent: PAGE('p2') });
    await f.flush();
    // The second view_tab for p2 from the key press, answered too.
    f.answer('view_tab', { structuredContent: PAGE('p2') });
    await f.flush();
    f.el('tabs').children[1]!.onclick!();
    await f.flush();
    expect(f.pendingCall('view_tab')!.params!.arguments).toEqual({ designId: 'g1', tabId: 't2' });
  });

  it('hides the pager for a tab of one page, and opens the editor at the tab or an element', async () => {
    const f = await shown();
    f.el('tabs').children[1]!.onclick!();
    await f.flush();
    f.answer('view_tab', {
      structuredContent: { ...PAGE('p1'), tabId: 't2', pages: [{ id: 'p1', name: 'Logo' }] },
    });
    await f.flush();
    expect(f.el('pager').hidden).toBe(true);
    f.el('open').onclick!();
    expect(f.pendingCall('ui/open-link')!.params!.url).toBe('https://www.acme.app/design/g1#t=t2');
  });
});

const BOARD = {
  projectId: 'p1',
  tabId: 't1',
  name: 'Sprint',
  tabs: [
    { id: 't1', name: 'Sprint' },
    { id: 't2', name: 'Bugs' },
  ],
  boards: [
    {
      id: 'b1',
      title: 'Sprint board',
      columns: [
        {
          name: 'To Do',
          status: 'todo',
          count: 32,
          wipLimit: null,
          done: false,
          cards: [
            { id: 'c1', ref: '#1', title: 'Write <b>copy</b>', color: '#2563eb' },
            { id: 'c2', ref: '#2', title: 'Ship it', color: null },
          ],
        },
        { name: 'Doing', status: 'doing', count: 4, wipLimit: 3, done: false, cards: [] },
        { name: 'Done', status: 'done', count: 0, wipLimit: null, done: true, cards: [] },
      ],
    },
  ],
  url: 'https://www.acme.app/project/p1',
};

describe('the board view', () => {
  async function board(structuredContent: Record<string, unknown> = BOARD) {
    const f = frame(boardViewerScript('liveplanner', 'projectId'));
    f.answer('ui/initialize', {});
    await f.flush();
    f.result({ projectId: 'p1', boards: [] });
    await f.flush();
    f.answer('view_tab', { structuredContent });
    await f.flush();
    return f;
  }

  it('asks for the plan’s first board tab, and draws its columns and cards as text', async () => {
    const f = await board();
    const asked = f.sent.find((m) => m.params?.name === 'view_tab')!;
    expect(asked.params!.arguments).toEqual({ projectId: 'p1' });
    expect(f.el('title').textContent).toBe('Sprint');
    expect(f.el('note').hidden).toBe(true);
    const root = f.el('board');
    const cols = root.all('col');
    expect(cols.map((c) => c.attrs['aria-label'])).toEqual([
      'To Do, 32 cards',
      'Doing, 4 cards',
      'Done, 0 cards',
    ]);
    expect(cols[2]!.className).toBe('col done');
    expect(root.all('n').map((n) => [n.textContent, n.className])).toEqual([
      ['32', 'n'],
      ['4 / 3', 'n over'],
      ['0', 'n'],
    ]);
    const cards = root.all('card');
    // A title is text, never markup.
    expect(cards.map((c) => c.textContent)).toEqual(['#1Write <b>copy</b>', '#2Ship it']);
    expect(cards[0]!.style.borderLeftColor).toBe('#2563eb');
    expect(cards[1]!.style.borderLeftColor).toBeUndefined();
    expect(root.all('more').map((m) => m.textContent)).toEqual(['+ 30 more', '+ 4 more']);
    expect(root.all('empty').map((m) => m.textContent)).toEqual(['No cards']);
    // One board on the tab: no heading over it.
    expect(root.all('bt')).toEqual([]);
  });

  it('opens the editor at a card on its board, at the board for the rest, and at the tab', async () => {
    const f = await board();
    f.el('board').all('card')[0]!.onclick!();
    expect(f.pendingCall('ui/open-link')!.params!.url).toBe(
      'https://www.acme.app/project/p1#t=t1&el=b1&item=c1',
    );
    f.answer('ui/open-link', {});
    f.el('board').all('more')[0]!.onclick!();
    expect(f.pendingCall('ui/open-link')!.params!.url).toBe(
      'https://www.acme.app/project/p1#t=t1&el=b1',
    );
    // A host without open-link: the frame opens it itself.
    f.answer('ui/open-link', undefined, { code: -32601 });
    await f.flush();
    expect(f.win.open).toHaveBeenCalledWith(
      'https://www.acme.app/project/p1#t=t1&el=b1',
      '_blank',
      'noopener',
    );
    f.el('open').onclick!();
    expect(f.pendingCall('ui/open-link')!.params!.url).toBe('https://www.acme.app/project/p1#t=t1');
  });

  it('switches board tabs, names several boards on a tab, and says when there is none', async () => {
    const f = await board({
      ...BOARD,
      boards: [BOARD.boards[0]!, { ...BOARD.boards[0]!, id: 'b2', title: 'Ops' }],
    });
    expect(
      f
        .el('board')
        .all('bt')
        .map((h) => h.textContent),
    ).toEqual(['Sprint board', 'Ops']);
    expect(f.el('tabs').children.map((b) => b.attrs['aria-pressed'])).toEqual(['true', 'false']);
    f.el('tabs').children[0]!.onclick!();
    expect(f.pendingCall('view_tab')).toBeUndefined();
    f.el('tabs').children[1]!.onclick!();
    await f.flush();
    expect(f.pendingCall('view_tab')!.params!.arguments).toEqual({ projectId: 'p1', tabId: 't2' });
    f.answer('view_tab', { structuredContent: { ...BOARD, tabs: [BOARD.tabs[0]], boards: [] } });
    await f.flush();
    expect(f.el('tabs').hidden).toBe(true);
    expect(f.el('note').textContent).toBe('This plan has no board yet.');
  });

  it('says so when the board cannot be read, or the host never starts it, or a result names nothing', async () => {
    const f = await board({ name: 'x' });
    expect(f.el('note').textContent).toBe('This board could not be shown.');
    f.el('open').onclick!();
    expect(f.pendingCall('ui/open-link')).toBeUndefined();
    f.result({ name: 'nothing' });
    expect(f.el('note').textContent).toBe('Nothing to show for this result.');
    const g = frame(boardViewerScript('liveplanner', 'projectId'));
    g.answer('ui/initialize', undefined, { code: -1 });
    await g.flush();
    expect(g.el('note').textContent).toBe('This chat could not start the view.');
  });
});
