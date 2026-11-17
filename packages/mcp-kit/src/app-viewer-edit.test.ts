import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { viewerScript } from './app-viewer-script';

// docs/specs/015-api/mcp-server.md "Edits in the view": the edit parts' wiring, run in a stand-in frame. The host is
// the list of JSON-RPC messages the page posts and the answers this test gives; the stage takes pointer and key
// events as a browser would send them. The server decides every write: these tests hold what the view sends, and that
// a view whose token is not edit-level never offers or sends an edit.

type Msg = {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: { name?: string; arguments?: Record<string, unknown>; url?: string };
  answered?: boolean;
};
type Listener = (event: Record<string, unknown>) => void;

class FakeEl {
  hidden = false;
  textContent = '';
  title = '';
  value = '';
  disabled = false;
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  classes = new Set<string>();
  on: Record<string, Listener[]> = {};
  onclick: (() => void) | null = null;
  onload: (() => void) | null = null;
  parent: FakeEl | null = null;
  focused = false;
  offsetWidth = 120;
  offsetHeight = 30;
  clientWidth = 600;
  clientHeight = 400;
  classList = {
    toggle: (c: string, on: boolean) => void (on ? this.classes.add(c) : this.classes.delete(c)),
  };
  readonly id: string;
  constructor(id: string) {
    this.id = id;
  }
  addEventListener(type: string, f: Listener) {
    (this.on[type] ??= []).push(f);
  }
  setAttribute(name: string, value: string) {
    this.attrs[name] = value;
  }
  getAttribute(name: string) {
    return this.attrs[name] ?? null;
  }
  contains(node: unknown): boolean {
    for (let n = node as FakeEl | null; n; n = n.parent) if (n === this) return true;
    return false;
  }
  appendChild() {}
  setPointerCapture() {}
  focus() {
    this.focused = true;
  }
  select() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 600, height: 400 };
  }
  fire(type: string, event: Record<string, unknown> = {}) {
    for (const f of this.on[type] ?? []) f({ target: this, preventDefault: () => {}, ...event });
  }
}

const EDIT_SCRIPT = viewerScript('livediagram', { edits: true });

function frame() {
  const els: Record<string, FakeEl> = {};
  const el = (id: string) => (els[id] ??= new FakeEl(id));
  el('stage').attrs['aria-label'] = 'The tab';
  for (const id of ['bar-name', 'hint', 'ren', 'go']) el(id).parent = el('bar');
  for (const id of ['bar', 'name-box', 'sel', 'ring', 'note']) el(id).parent = el('stage');
  const sent: Msg[] = [];
  const onWindow: Record<string, ((e: unknown) => void)[]> = {};
  const doc = {
    hidden: false,
    getElementById: el,
    createElement: () => new FakeEl('made'),
    documentElement: { dataset: {} },
    body: { scrollWidth: 600 },
    addEventListener: () => {},
  };
  const win = {
    parent: { postMessage: (m: Msg) => void sent.push(m) },
    addEventListener: (t: string, f: (e: unknown) => void) => void (onWindow[t] ??= []).push(f),
    open: () => {},
  };
  class Socket {
    static last: Socket | null = null;
    onopen: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onclose: ((e: { code: number }) => void) | null = null;
    constructor() {
      Socket.last = this;
    }
    close() {}
  }
  // oxlint-disable-next-line typescript/no-implied-eval, typescript/no-unsafe-call -- runs the page's own script, as the frame does
  new Function('window', 'document', 'WebSocket', EDIT_SCRIPT)(win, doc, Socket);

  const deliver = (data: unknown) => onWindow.message!.forEach((f) => f({ data }));
  const calls = (name: string) => sent.filter((m) => m.params?.name === name);
  const answer = (name: string, result: unknown, error?: unknown) => {
    const m = sent.find((x) => (x.method === name || x.params?.name === name) && !x.answered)!;
    expect(m, `a pending ${name}`).toBeTruthy();
    m.answered = true;
    deliver({ jsonrpc: '2.0', id: m.id, ...(error ? { error } : { result }) });
  };
  const flush = () => vi.advanceTimersByTimeAsync(0);
  const stage = el('stage');
  const at = (x: number, y: number, extra: Record<string, unknown> = {}) => ({
    pointerId: 1,
    clientX: x,
    clientY: y,
    target: stage,
    ...extra,
  });
  const click = (x: number, y: number) => {
    stage.fire('pointerdown', at(x, y));
    stage.fire('pointerup', at(x, y));
  };
  const drag = (from: [number, number], to: [number, number]) => {
    stage.fire('pointerdown', at(...from));
    stage.fire('pointermove', at(...to));
    stage.fire('pointerup', at(...to));
  };
  const key = (k: string, extra: Record<string, unknown> = {}) =>
    stage.fire('keydown', { key: k, target: stage, ...extra });
  return { sent, deliver, calls, answer, flush, el, stage, click, drag, key, at, Socket };
}

// A tab of three boxes: one to rename and move, a locked one, and a picture (moves, never renamed).
const box = (id: string, x: number, more: Record<string, unknown> = {}) => ({
  id,
  ref: id,
  label: id.toUpperCase(),
  x,
  y: 0,
  width: 100,
  height: 50,
  canRename: true,
  canMove: true,
  ...more,
});
const TAB = {
  documentId: 'd1',
  tabId: 't1',
  name: 'Main',
  tabs: [{ id: 't1', name: 'Main' }],
  svg: '<svg viewBox="0 0 400 300"></svg>',
  viewBox: { x: 0, y: 0, width: 400, height: 300 },
  elements: [
    box('a', 0),
    box('b', 200, { canRename: false, canMove: false }),
    box('c', 300, { canRename: false }),
  ],
  url: 'https://www.acme.app/document/d1',
};
const LIVE = (canEdit: boolean) => ({
  structuredContent: {
    documentId: 'd1',
    url: 'wss://www.acme.app/api/documents/d1/ws',
    ticket: 'rt2~sealed',
    expiresAt: Date.now() + 600_000,
    canEdit,
  },
});

// A frame showing tab t1, its token edit-level or not, the Edit toggle pressed when it may be.
async function shown(canEdit: boolean) {
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
  f.answer('view_live', LIVE(canEdit));
  await f.flush();
  f.Socket.last!.onopen!();
  return f;
}
async function editing() {
  const f = await shown(true);
  f.el('edit').onclick!();
  return f;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('a view whose token is not edit-level', () => {
  it('draws no Edit toggle, and a click still opens the editor, never an edit', async () => {
    const f = await shown(false);
    expect(f.el('edit').hidden).toBe(true);
    // A forged press of the hidden toggle changes nothing.
    f.el('edit').onclick!();
    expect(f.el('edit').attrs['aria-pressed']).toBe('false');
    f.click(10, 10);
    expect(f.sent.filter((m) => m.method === 'ui/open-link').map((m) => m.params!.url)).toEqual([
      'https://www.acme.app/document/d1#t=t1&el=a',
    ]);
    f.drag([10, 10], [60, 10]);
    f.key('Enter');
    f.key('ArrowLeft');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(f.calls('view_edit')).toHaveLength(0);
    expect(f.el('sel').hidden).toBe(true);
  });

  it('takes the toggle away when a later ticket says the token no longer edits, or the ticket is refused', async () => {
    const f = await editing();
    expect(f.el('edit').attrs['aria-pressed']).toBe('true');
    f.Socket.last!.onclose!({ code: 4005 });
    await vi.advanceTimersByTimeAsync(1_000);
    f.answer('view_live', LIVE(false));
    await f.flush();
    expect(f.el('edit')).toMatchObject({ hidden: true });
    expect(f.el('edit').attrs['aria-pressed']).toBe('false');
    f.Socket.last!.onclose!({ code: 4005 });
    await vi.advanceTimersByTimeAsync(2_000);
    f.answer('view_live', { isError: true, content: [] });
    await f.flush();
    expect(f.el('edit').hidden).toBe(true);
  });
});

describe('a view whose token is edit-level', () => {
  it('shows the Edit toggle, and a click selects instead of opening', async () => {
    const f = await shown(true);
    expect(f.el('edit').hidden).toBe(false);
    f.el('edit').onclick!();
    expect(f.el('edit').attrs['aria-pressed']).toBe('true');
    expect(f.el('edit').title).toBe('Stop editing');
    expect(f.stage.attrs['aria-label']).toContain('editing');
    f.click(250, 10);
    expect(f.sent.some((m) => m.method === 'ui/open-link')).toBe(false);
    expect(f.el('sel').hidden).toBe(false);
    expect(f.el('bar').hidden).toBe(false);
    expect(f.el('bar-name').textContent).toBe('B');
    expect(f.el('hint').textContent).toBe('Locked');
    expect(f.el('ren').disabled).toBe(true);
    expect(f.el('sr').textContent).toBe('Selected B. Locked.');
    // Open in the bar opens the editor at it; a click on empty space clears the selection.
    f.el('go').onclick!();
    expect(f.sent.filter((m) => m.method === 'ui/open-link').at(-1)!.params!.url).toBe(
      'https://www.acme.app/document/d1#t=t1&el=b',
    );
    f.click(50, 200);
    expect(f.el('sel').hidden).toBe(true);
    f.el('edit').onclick!();
    expect(f.el('edit').attrs['aria-pressed']).toBe('false');
  });

  it('moves an element by a drag, as one edit, and draws the answer', async () => {
    const f = await editing();
    f.stage.fire('pointerdown', f.at(10, 10));
    f.stage.fire('pointermove', f.at(30, 10));
    expect(f.el('sel').classes.has('drag')).toBe(true);
    expect(f.el('sel').style.cssText).toContain('left:20px');
    expect(f.el('bar').hidden).toBe(true);
    // A live change while the drag is out waits for it.
    f.Socket.last!.onmessage!({
      data: JSON.stringify({ kind: 'op', op: { kind: 'el', tabId: 't1' } }),
    });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(f.calls('view_tab')).toHaveLength(1);
    f.stage.fire('pointermove', f.at(60, 30));
    f.stage.fire('pointerup', f.at(60, 30));
    expect(f.calls('view_edit').map((m) => m.params!.arguments)).toEqual([
      { documentId: 'd1', tabId: 't1', edits: [{ elementId: 'a', dx: 50, dy: 20 }] },
    ]);
    expect(f.el('save')).toMatchObject({ hidden: false, textContent: 'Saving…' });
    const moved = { ...TAB, elements: [box('a', 50), ...TAB.elements.slice(1)] };
    f.answer('view_edit', { structuredContent: { ...moved, changesetId: 'cs1' } });
    await f.flush();
    expect(f.el('save').textContent).toBe('Saved');
    expect(f.el('sel').classes.has('drag')).toBe(false);
    expect(f.el('sel').style.cssText).toContain('left:50px');
    await vi.advanceTimersByTimeAsync(1_500);
    expect(f.el('save').hidden).toBe(true);
    // The room's relay of its own changeset draws nothing more; the held live change draws once.
    await vi.advanceTimersByTimeAsync(2_000);
    const before = f.calls('view_tab').length;
    f.Socket.last!.onmessage!({
      data: JSON.stringify({ kind: 'op', op: { kind: 'changeset', tabId: 't1', id: 'cs1' } }),
    });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(f.calls('view_tab')).toHaveLength(before);
  });

  it('pans from a locked element or empty space, and a tiny drag is a click', async () => {
    const f = await editing();
    f.stage.fire('pointerdown', f.at(10, 10));
    f.stage.fire('pointermove', f.at(11, 11));
    f.stage.fire('pointerup', f.at(11, 11));
    expect(f.el('bar-name').textContent).toBe('A');
    f.drag([210, 10], [260, 40]);
    f.drag([50, 200], [80, 220]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(f.calls('view_edit')).toHaveLength(0);
    // The pans moved the picture, and the selection with it.
    expect(f.el('sel').style.cssText).toContain('left:80px;top:50px');
  });

  it('renames from a double-click, saving on Enter and only when the label changed', async () => {
    const f = await editing();
    f.stage.fire('dblclick', f.at(10, 10));
    expect(f.el('name-box')).toMatchObject({ hidden: false, value: 'A', focused: true });
    expect(f.el('bar').hidden).toBe(true);
    // A key in the box is the box's: it neither pans nor nudges.
    f.key('ArrowLeft', { target: f.el('name-box') });
    f.el('name-box').value = '  A  ';
    f.el('name-box').fire('keydown', { key: 'Enter' });
    expect(f.calls('view_edit')).toHaveLength(0);
    f.key('Enter');
    f.el('name-box').value = 'Charge';
    // A press in the box stays there.
    f.stage.fire('pointerdown', f.at(10, 10, { target: f.el('name-box') }));
    f.el('name-box').fire('keydown', { key: 'x' });
    f.el('name-box').fire('keydown', { key: 'Enter' });
    expect(f.calls('view_edit').map((m) => m.params!.arguments!.edits)).toEqual([
      [{ elementId: 'a', label: 'Charge' }],
    ]);
    expect(f.el('name-box').hidden).toBe(true);
    expect(f.stage.focused).toBe(true);
  });

  it('cancels a rename on Escape, saves one on leaving the box, and offers none where it may not', async () => {
    const f = await editing();
    f.click(10, 10);
    f.el('ren').onclick!();
    f.el('name-box').value = 'Gone';
    f.el('name-box').fire('keydown', { key: 'Escape' });
    expect(f.el('name-box').hidden).toBe(true);
    f.key('F2');
    f.el('name-box').value = 'Kept';
    f.el('name-box').fire('blur');
    expect(f.calls('view_edit').map((m) => m.params!.arguments!.edits)).toEqual([
      [{ elementId: 'a', label: 'Kept' }],
    ]);
    f.answer('view_edit', { structuredContent: { ...TAB, changesetId: null } });
    await f.flush();
    f.click(350, 10);
    expect(f.el('ren')).toMatchObject({ disabled: true });
    expect(f.el('ren').title).toContain('renamed here');
    expect(f.el('hint').textContent).toBe('Drag to move');
    f.key('Enter');
    f.stage.fire('dblclick', f.at(250, 10));
    f.stage.fire('dblclick', f.at(50, 250));
    expect(f.el('name-box').hidden).toBe(true);
  });

  it('nudges with the arrow keys, sending one move once they rest', async () => {
    const f = await editing();
    f.click(10, 10);
    f.key('ArrowRight');
    f.key('ArrowRight');
    f.key('ArrowDown', { shiftKey: true });
    await vi.advanceTimersByTimeAsync(399);
    expect(f.calls('view_edit')).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.calls('view_edit').map((m) => m.params!.arguments!.edits)).toEqual([
      [{ elementId: 'a', dx: 20, dy: 1 }],
    ]);
    // While it saves, keys do nothing more; a locked element takes no nudge.
    f.key('ArrowLeft');
    f.answer('view_edit', { structuredContent: { ...TAB, changesetId: 'cs2' } });
    await f.flush();
    f.key('Tab');
    expect(f.el('bar-name').textContent).toBe('B');
    f.key('ArrowLeft');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(f.calls('view_edit')).toHaveLength(1);
    // A key that is not the view's goes on to the canvas's own keys.
    f.key('+');
  });

  it('sends a pending nudge before the selection moves on, then steps with Tab and clears with Escape', async () => {
    const f = await editing();
    f.key('Tab');
    expect(f.el('bar-name').textContent).toBe('A');
    f.key('ArrowLeft');
    f.key('Tab');
    expect(f.calls('view_edit').map((m) => m.params!.arguments!.edits)).toEqual([
      [{ elementId: 'a', dx: -10, dy: 0 }],
    ]);
    expect(f.el('bar-name').textContent).toBe('B');
    f.key('Tab', { shiftKey: true });
    f.key('Tab', { shiftKey: true });
    expect(f.el('sel').hidden).toBe(true);
    f.key('Tab', { shiftKey: true });
    expect(f.el('bar-name').textContent).toBe('C');
    f.key('Escape');
    expect(f.el('sel').hidden).toBe(true);
    f.key('Escape');
    expect(f.el('edit').attrs['aria-pressed']).toBe('false');
    // Off, the view's keys are the canvas's again.
    f.key('Tab');
    expect(f.el('sel').hidden).toBe(true);
  });

  it('keeps the bar’s keys for its buttons, and Escape there clears the selection', async () => {
    const f = await editing();
    f.click(10, 10);
    // Enter on Rename is the button's own click, not a second rename from the stage.
    f.key('Enter', { target: f.el('ren') });
    expect(f.el('name-box').focused).toBe(false);
    f.stage.fire('pointerdown', f.at(10, 10, { target: f.el('go') }));
    f.key('Escape', { target: f.el('go') });
    expect(f.el('sel').hidden).toBe(true);
    expect(f.stage.focused).toBe(true);
  });

  it('says the api’s reason when an edit is refused, and draws the tab as stored', async () => {
    const f = await editing();
    f.drag([10, 10], [40, 10]);
    f.answer('view_edit', {
      isError: true,
      content: [{ type: 'text', text: 'element_locked: a is locked' }],
    });
    await f.flush();
    expect(f.el('note').textContent).toBe('The edit was not saved: element_locked: a is locked');
    expect(f.calls('view_tab')).toHaveLength(2);
    expect(f.el('save').hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(f.el('note').hidden).toBe(true);
    // A host that fails the call says so plainly.
    f.drag([10, 10], [40, 10]);
    f.answer('view_edit', null, { code: -32000 });
    await f.flush();
    expect(f.el('note').textContent).toBe('The edit was not saved.');
  });

  it('drops a drag a pinch interrupts, and lets go of a selection whose element is gone', async () => {
    const f = await editing();
    f.stage.fire('pointerdown', f.at(10, 10));
    f.stage.fire('pointermove', f.at(40, 10));
    f.stage.fire('pointerdown', f.at(100, 100, { pointerId: 2 }));
    f.stage.fire('pointerup', f.at(100, 100, { pointerId: 2 }));
    f.stage.fire('pointerup', f.at(40, 10));
    expect(f.calls('view_edit')).toHaveLength(0);
    expect(f.el('sel').classes.has('drag')).toBe(false);
    // The tab drawn again without it: the selection clears.
    f.Socket.last!.onmessage!({
      data: JSON.stringify({ kind: 'op', op: { kind: 'el', tabId: 't1' } }),
    });
    await vi.advanceTimersByTimeAsync(1_500);
    f.answer('view_tab', { structuredContent: { ...TAB, elements: TAB.elements.slice(1) } });
    await f.flush();
    expect(f.el('sel').hidden).toBe(true);
  });

  it('places the bar below an element at the top, within the frame', async () => {
    const f = await editing();
    f.click(10, 10);
    expect(f.el('bar').style.top).toBe('58px');
    expect(f.el('bar').style.left).toBe('8px');
  });

  it('hovers an element as a selection would, and the selected one not at all', async () => {
    const f = await editing();
    f.stage.fire('pointermove', f.at(250, 10));
    expect(f.el('ring').title).toBe('Select B');
    expect(f.stage.style.cursor).toBe('pointer');
    f.stage.fire('pointermove', f.at(10, 10));
    expect(f.stage.style.cursor).toBe('move');
    f.click(10, 10);
    f.stage.fire('pointermove', f.at(10, 10));
    expect(f.el('ring').hidden).toBe(true);
  });
});
