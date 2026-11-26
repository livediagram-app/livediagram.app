// @vitest-environment jsdom
// The selection menu in an article's writing (liveworkspace/docs/specs/004-index/send-to-plan.md "The selection
// menu", Work Tracker 1462): a right-click on the words picked opens it at the pointer, the keyboard's menu key under
// the words, and a touch's words dock it at the screen's edge once they hold still. Each editor's own
// article-sent.test.ts drives it on a real ProseMirror view.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/index-client', () => ({ indexClient: {} }));
vi.mock('./selection-clipboard', () => ({
  runClipboardCommand: vi.fn(),
  writeClipboardText: vi.fn(),
  pasteClipboard: vi.fn(),
}));

import {
  bindSelectionMenu,
  DOCK_CLEAR_STEPS,
  DOCK_MARGIN_PX,
  DOCK_PROBE_STEP_PX,
  DOCK_ROOM_PX,
  DOCK_SETTLE_MS,
  dockScreen,
  dockSpot,
  livePick,
  onWords,
  screenBox,
  type SelectionView,
} from './article-selection-menu';
import { pasteClipboard, runClipboardCommand, writeClipboardText } from './selection-clipboard';
import {
  closeSelectionMenu,
  currentSelectionMenu,
  openSelectionMenu,
  SELECTION_MENU_ATTR,
} from './selection-menu-store';
import { setSendSource } from '../send-to-plan/send-store';
import { onSendToPlan, setSendHere, type SendRequest } from '../send-to-plan/send-to-plan-entry';
import {
  onSendToDiagram,
  setDiagramDrafter,
  type DiagramSendRequest,
} from '../send-to-diagram/send-to-diagram-entry';
import { PRESS_HOLD_MS } from '../send-to-plan/press-hold';
import { setSelectionNoteEntry } from './selection-note-entry';

const LINE = { left: 0, right: 80, top: 100, bottom: 120 };

// A writing holding one block's words, its view as the menu reads it.
function writing(blockId: unknown = 'b1', depth = 1) {
  const dom = document.createElement('div');
  dom.textContent = 'Book the venue';
  document.body.append(dom);
  const tr = { deleteSelection: vi.fn() };
  tr.deleteSelection.mockReturnValue(tr);
  const view = {
    dom,
    isDestroyed: false as boolean,
    state: {
      doc: {
        content: { size: 10 },
        resolve: () => ({ depth, node: () => ({ attrs: { id: blockId } }) }),
      },
      tr,
    },
    posAtDOM: () => 99,
    dispatch: vi.fn(),
    focus: vi.fn(),
    pasteHTML: vi.fn(),
    pasteText: vi.fn(),
  } satisfies SelectionView;
  return { dom, view, tr };
}

// Picks `to` characters of an element's words, as the browser would.
function pick(el: Element, to: number): Range {
  const range = document.createRange();
  range.setStart(el.firstChild!, 0);
  range.setEnd(el.firstChild!, to);
  range.getClientRects = () => [LINE] as unknown as DOMRectList;
  range.getBoundingClientRect = () => ({ ...LINE }) as DOMRect;
  document.getSelection()!.removeAllRanges();
  document.getSelection()!.addRange(range);
  return range;
}

const press = (target: EventTarget, pointerType?: string) => {
  const e = new Event('pointerdown', { bubbles: true });
  if (pointerType !== undefined) Object.defineProperty(e, 'pointerType', { value: pointerType });
  target.dispatchEvent(e);
};

function rightClick(
  dom: Element,
  at: { x: number; y: number } = { x: 10, y: 110 },
  over: MouseEventInit & { pointerType?: string } = {},
): boolean {
  const { pointerType, ...init } = over;
  const e = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: at.x,
    clientY: at.y,
    ...init,
  });
  if (pointerType !== undefined) Object.defineProperty(e, 'pointerType', { value: pointerType });
  dom.dispatchEvent(e);
  return e.defaultPrevented;
}

const changed = () => document.dispatchEvent(new Event('selectionchange'));

let heard: SendRequest[] = [];
let drew: DiagramSendRequest[] = [];
let stops: (() => void)[] = [];
beforeEach(() => {
  heard = [];
  drew = [];
  stops = [onSendToPlan((r) => heard.push(r)), onSendToDiagram((r) => drew.push(r))];
  setSendSource('K', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
  setSendHere({ app: 'liveknowledge', tabId: 't1' });
});
afterEach(() => {
  for (const s of stops) s();
  setDiagramDrafter(null);
  setSendSource(null);
  setSendHere(null);
  closeSelectionMenu();
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(runClipboardCommand).mockReset();
  vi.mocked(writeClipboardText).mockReset();
  vi.mocked(pasteClipboard).mockReset();
});

describe('the words picked', () => {
  it('reads the words in the writing with the block they start in, and nothing else', () => {
    const { dom, view } = writing();
    expect(livePick(view)).toBeNull();
    const outside = document.createElement('p');
    outside.textContent = 'Elsewhere';
    document.body.append(outside);
    pick(outside, 4);
    expect(livePick(view)).toBeNull();
    dom.textContent = '   words';
    pick(dom, 2);
    expect(livePick(view)).toBeNull();
    pick(dom, 6);
    expect(livePick(view)).toMatchObject({ pick: { blockId: 'b1', text: 'wor' }, text: '   wor' });
    vi.spyOn(document, 'getSelection').mockReturnValue(null);
    expect(livePick(view)).toBeNull();
  });

  it('names no block at the top level or without an id', () => {
    const top = writing('b1', 0);
    pick(top.dom, 4);
    expect(livePick(top.view)).toBeNull();
    const nameless = writing('');
    pick(nameless.dom, 4);
    expect(livePick(nameless.view)).toBeNull();
  });

  it('counts a point on any of the words’ lines, give or take a hair', () => {
    const { dom } = writing();
    const range = pick(dom, 4);
    expect(onWords(range, 10, 110)).toBe(true);
    expect(onWords(range, 81, 98)).toBe(true);
    expect(onWords(range, 90, 110)).toBe(false);
    expect(onWords(range, 10, 130)).toBe(false);
    expect(onWords(range, -5, 110)).toBe(false);
    expect(onWords(range, 10, 90)).toBe(false);
  });
});

describe('where the docked menu sits', () => {
  const screen = { top: 0, left: 0, width: 390, height: 844 };
  it('centres at the foot, or at the top while the words are low', () => {
    expect(dockSpot({ top: 100, bottom: 120 }, screen)).toEqual({
      at: { x: (390 - 224) / 2, y: 844 - DOCK_MARGIN_PX },
      placement: 'above-start',
    });
    expect(dockSpot({ top: 700, bottom: 720 }, screen)).toEqual({
      at: { x: (390 - 224) / 2, y: DOCK_MARGIN_PX },
      placement: 'below-start',
    });
    // Words reaching the top and the foot both: the foot.
    expect(dockSpot({ top: DOCK_ROOM_PX, bottom: 800 }, screen).placement).toBe('above-start');
    // A screen narrower than the menu keeps the edge margin.
    expect(dockSpot({ top: 0, bottom: 10 }, { ...screen, width: 200 }).at.x).toBe(DOCK_MARGIN_PX);
  });

  it('reads the visual viewport, above an on-screen keyboard, else the window', () => {
    expect(screenBox()).toEqual({
      top: 0,
      left: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    });
    vi.stubGlobal('visualViewport', { offsetTop: 30, offsetLeft: 2, width: 390, height: 500 });
    expect(screenBox()).toEqual({ top: 30, left: 2, width: 390, height: 500 });
  });
});

describe('the room the docked menu has', () => {
  const screen = { top: 0, left: 0, width: 390, height: 844 };
  const rect = (top: number, bottom: number) => () => ({ top, bottom }) as DOMRect;
  // A writing inside a scrolling box that ends above a tab bar, under a header.
  function scrolled() {
    const scroller = document.createElement('div');
    scroller.style.overflowY = 'auto';
    scroller.getBoundingClientRect = rect(56, 796);
    const dom = document.createElement('div');
    scroller.append(dom);
    document.body.append(scroller);
    return { scroller, dom };
  }

  it('is the screen where the writing scrolls with the page', () => {
    const dom = document.createElement('div');
    document.body.append(dom);
    expect(dockScreen(dom, screen)).toEqual(screen);
  });

  it('stays inside the writing’s scrolling box, clear of a header and a tab bar', () => {
    const { dom } = scrolled();
    expect(dockScreen(dom, screen)).toEqual({ top: 56, left: 0, width: 390, height: 740 });
  });

  it('rises above a control floating over the writing at its foot, and past the menu itself', () => {
    const { scroller, dom } = scrolled();
    const words = document.createElement('p');
    scroller.append(words);
    const corner = document.createElement('button');
    corner.getBoundingClientRect = rect(728, 772);
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    menu.getBoundingClientRect = rect(600, 784);
    document.body.append(corner, menu);
    const at = vi.fn((_x: number, y: number) => (y > 728 ? corner : words) as Element | null);
    vi.stubGlobal('document', Object.assign(document, { elementFromPoint: at }));
    expect(dockScreen(dom, screen)).toEqual({ top: 56, left: 0, width: 390, height: 728 - 56 });
    // An open menu where the dock looks is its own, never a reason to rise.
    at.mockImplementation((_x, y) => (y > 700 ? menu : words));
    expect(dockScreen(dom, screen).height).toBe(740);
    // A tower of controls stops after a few steps rather than climbing on and on.
    at.mockReset();
    at.mockImplementation((_x, y) => {
      const el = document.createElement('i');
      document.body.append(el);
      el.getBoundingClientRect = rect(y - 10, y);
      return el;
    });
    expect(dockScreen(dom, screen).height).toBeGreaterThanOrEqual(0);
    const probes = 3 * Math.ceil((DOCK_ROOM_PX - DOCK_MARGIN_PX - 1) / DOCK_PROBE_STEP_PX);
    expect(at).toHaveBeenCalledTimes(DOCK_CLEAR_STEPS * probes);
    // Nothing found at a point counts as clear.
    at.mockImplementation(() => null);
    expect(dockScreen(dom, screen).height).toBe(740);
    Reflect.deleteProperty(document, 'elementFromPoint');
  });
});

describe('a right-click', () => {
  it('opens the menu at the pointer on the words picked, reading: Copy and the sends', () => {
    const { dom, view } = writing();
    const unbind = bindSelectionMenu(view, () => false);
    pick(dom, 4);
    expect(rightClick(dom)).toBe(true);
    const menu = currentSelectionMenu()!;
    expect(menu).toMatchObject({
      anchor: dom,
      at: { x: 10, y: 110 },
      placement: 'below-start',
      docked: false,
    });
    expect(menu.actions.cut).toBeNull();
    expect(menu.actions.paste).toBeNull();
    expect(menu.actions.sendToDiagram).toBeNull();
    menu.actions.sendToPlan!();
    expect(heard[0]!.places[0]).toMatchObject({ elementId: 'b1', text: 'Book' });
    unbind();
    expect(currentSelectionMenu()).toBeNull();
  });

  it('adds Comment and Add Action where the app notes the words, picking them again first', () => {
    const { dom, view } = writing();
    const note = vi.fn();
    const unregister = setSelectionNoteEntry({ canNote: (w) => w === dom, note });
    const unbind = bindSelectionMenu(view, () => false);
    pick(dom, 4);
    expect(rightClick(dom)).toBe(true);
    const { actions } = currentSelectionMenu()!;
    document.getSelection()!.removeAllRanges();
    actions.addAction!();
    expect(note).toHaveBeenCalledWith('action', dom);
    expect(document.getSelection()!.toString()).toBe('Book');
    unbind();
    unregister();
  });

  it('opens for the notes alone where the session may note but not send', () => {
    const { dom, view } = writing();
    setSendHere(null);
    const unregister = setSelectionNoteEntry({ canNote: () => true, note: vi.fn() });
    const unbind = bindSelectionMenu(view, () => false);
    pick(dom, 4);
    expect(rightClick(dom)).toBe(true);
    const { actions } = currentSelectionMenu()!;
    expect(actions.sendToPlan).toBeNull();
    expect(actions.sendToDiagram).toBeNull();
    expect(actions.comment).not.toBeNull();
    unbind();
    unregister();
    setSendHere({ app: 'liveknowledge', tabId: 't1' });
  });

  it('leaves the browser’s menu off the words, with nothing picked, with Shift, or where it can’t send', () => {
    const { dom, view } = writing();
    const unbind = bindSelectionMenu(view, () => false);
    expect(rightClick(dom)).toBe(false);
    pick(dom, 4);
    expect(rightClick(dom, { x: 300, y: 300 })).toBe(false);
    expect(rightClick(dom, undefined, { shiftKey: true })).toBe(false);
    setSendHere(null);
    expect(rightClick(dom)).toBe(false);
    expect(currentSelectionMenu()).toBeNull();
    unbind();
  });

  it('opens under the words from the keyboard’s menu key', () => {
    const { dom, view } = writing();
    const unbind = bindSelectionMenu(view, () => false);
    pick(dom, 4);
    expect(rightClick(dom, { x: 300, y: 300 }, { button: 0, pointerType: '' })).toBe(true);
    expect(currentSelectionMenu()!.at).toEqual({ x: LINE.left, y: LINE.bottom });
    expect(rightClick(dom, { x: 0, y: 0 }, { button: 0 })).toBe(true);
    expect(currentSelectionMenu()!.at).toEqual({ x: LINE.left, y: LINE.bottom });
    // Chromium's menu key: no button, placed at the words.
    closeSelectionMenu();
    expect(rightClick(dom, { x: 300, y: 300 }, { button: -1, pointerType: 'mouse' })).toBe(true);
    expect(currentSelectionMenu()!.at).toEqual({ x: LINE.left, y: LINE.bottom });
    // A Ctrl-click at the corner is a pointer's, and off the words.
    closeSelectionMenu();
    expect(rightClick(dom, { x: 0, y: 0 }, { button: 0, ctrlKey: true })).toBe(false);
    unbind();
  });

  it('opens from the menu key while reading, with focus outside the writing, but not in a field', () => {
    const { dom, view } = writing();
    const button = document.createElement('button');
    const field = document.createElement('input');
    const notes = document.createElement('div');
    notes.setAttribute('contenteditable', 'true');
    document.body.append(button, field, notes);
    const unbind = bindSelectionMenu(view, () => false);
    // Nothing picked: the browser's menu.
    expect(rightClick(button, { x: 0, y: 0 }, { button: -1 })).toBe(false);
    pick(dom, 4);
    // A pointer's right-click elsewhere stays the browser's.
    expect(rightClick(button, { x: 10, y: 110 })).toBe(false);
    expect(rightClick(field, { x: 0, y: 0 }, { button: -1 })).toBe(false);
    expect(rightClick(notes, { x: 0, y: 0 }, { button: -1 })).toBe(false);
    expect(currentSelectionMenu()).toBeNull();
    // The page's own menu (the canvas's) is not heard once this one opens.
    const pageMenu = vi.fn();
    button.addEventListener('contextmenu', pageMenu);
    expect(rightClick(button, { x: 0, y: 0 }, { button: -1 })).toBe(true);
    expect(currentSelectionMenu()).toMatchObject({ at: { x: LINE.left, y: LINE.bottom } });
    expect(pageMenu).not.toHaveBeenCalled();
    rightClick(button, { x: 10, y: 110 });
    expect(pageMenu).toHaveBeenCalledTimes(1);
    // Once from the writing itself, not again from the page.
    closeSelectionMenu();
    const opened = vi.fn();
    const stop = (() => {
      document.addEventListener('contextmenu', opened);
      return () => document.removeEventListener('contextmenu', opened);
    })();
    expect(rightClick(dom, { x: 0, y: 0 }, { button: -1 })).toBe(true);
    expect(opened).toHaveBeenCalledTimes(1);
    stop();
    // A text node's event, or one already taken, is left alone.
    closeSelectionMenu();
    const taken = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: -1 });
    taken.preventDefault();
    button.dispatchEvent(taken);
    const text = document.createTextNode('x');
    document.body.append(text);
    text.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: -1 }),
    );
    expect(currentSelectionMenu()).toBeNull();
    unbind();
    expect(rightClick(button, { x: 0, y: 0 }, { button: -1 })).toBe(false);
  });

  it('leaves a touch’s long press to the dock', () => {
    const { dom, view } = writing();
    const unbind = bindSelectionMenu(view, () => false);
    pick(dom, 4);
    press(dom, 'touch');
    expect(rightClick(dom)).toBe(false);
    press(dom);
    expect(rightClick(dom)).toBe(true);
    unbind();
  });

  it('offers Send to Diagram in an app that drafts diagrams', () => {
    setDiagramDrafter(vi.fn());
    const { dom, view } = writing();
    const unbind = bindSelectionMenu(view, () => false);
    pick(dom, 4);
    rightClick(dom);
    currentSelectionMenu()!.actions.sendToDiagram!();
    expect(drew[0]).toMatchObject({ elementId: 'b1', words: 'Book' });
    unbind();
  });
});

describe('Cut, Copy and Paste', () => {
  it('copies the words read through the browser’s own copy, picking them again first', () => {
    const { dom, view } = writing();
    const unbind = bindSelectionMenu(view, () => false);
    const range = pick(dom, 4);
    rightClick(dom);
    const { copy } = currentSelectionMenu()!.actions;
    document.getSelection()!.removeAllRanges();
    vi.mocked(runClipboardCommand).mockReturnValue(true);
    copy();
    expect(runClipboardCommand).toHaveBeenCalledWith('copy');
    expect(document.getSelection()!.getRangeAt(0).toString()).toBe(range.toString());
    expect(writeClipboardText).not.toHaveBeenCalled();
    expect(view.focus).not.toHaveBeenCalled();
    unbind();
  });

  it('falls back to the words as plain text where the browser refuses its copy', () => {
    const { dom, view } = writing();
    const unbind = bindSelectionMenu(view, () => false);
    pick(dom, 4);
    rightClick(dom);
    vi.mocked(runClipboardCommand).mockReturnValue(false);
    vi.mocked(writeClipboardText).mockResolvedValue(true);
    currentSelectionMenu()!.actions.copy();
    expect(writeClipboardText).toHaveBeenCalledWith('Book');
    expect(view.dispatch).not.toHaveBeenCalled();
    unbind();
  });

  it('cuts and pastes while editing, the caret back in the writing first', async () => {
    const { dom, view, tr } = writing();
    const unbind = bindSelectionMenu(view, () => true);
    pick(dom, 4);
    rightClick(dom);
    const { cut, paste } = currentSelectionMenu()!.actions;
    vi.mocked(runClipboardCommand).mockReturnValue(true);
    cut!();
    expect(view.focus).toHaveBeenCalledTimes(1);
    expect(runClipboardCommand).toHaveBeenCalledWith('cut');
    expect(view.dispatch).not.toHaveBeenCalled();
    // Refused: the words go once they are on the clipboard, never before.
    vi.mocked(runClipboardCommand).mockReturnValue(false);
    vi.mocked(writeClipboardText).mockResolvedValue(true);
    cut!();
    await vi.waitFor(() => expect(view.dispatch).toHaveBeenCalledWith(tr));
    expect(tr.deleteSelection).toHaveBeenCalled();
    view.dispatch.mockClear();
    vi.mocked(writeClipboardText).mockResolvedValue(false);
    cut!();
    await Promise.resolve();
    await Promise.resolve();
    expect(view.dispatch).not.toHaveBeenCalled();
    vi.mocked(writeClipboardText).mockResolvedValue(true);
    view.isDestroyed = true;
    cut!();
    await Promise.resolve();
    await Promise.resolve();
    expect(view.dispatch).not.toHaveBeenCalled();
    paste!();
    expect(pasteClipboard).toHaveBeenCalledWith(view);
    unbind();
  });
});

describe('on a touch screen', () => {
  it('docks once a long press’s words hold still, follows them, and goes with them', () => {
    vi.useFakeTimers();
    const { dom, view } = writing();
    const unbind = bindSelectionMenu(view, () => false);
    press(dom, 'touch');
    pick(dom, 4);
    changed();
    vi.advanceTimersByTime(DOCK_SETTLE_MS - 1);
    expect(currentSelectionMenu()).toBeNull();
    // A handle moved: the wait starts again.
    pick(dom, 5);
    changed();
    vi.advanceTimersByTime(DOCK_SETTLE_MS - 1);
    expect(currentSelectionMenu()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(currentSelectionMenu()).toMatchObject({ docked: true, placement: 'above-start' });
    expect(currentSelectionMenu()!.actions.copy).toBeTypeOf('function');
    document.getSelection()!.removeAllRanges();
    changed();
    expect(currentSelectionMenu()).toBeNull();
    unbind();
  });

  it('stays through a tap on one of its rows that clears the words', () => {
    vi.useFakeTimers();
    const { dom, view } = writing();
    const unbind = bindSelectionMenu(view, () => false);
    press(dom, 'touch');
    pick(dom, 4);
    changed();
    vi.advanceTimersByTime(DOCK_SETTLE_MS);
    const row = document.createElement('button');
    const rows = document.createElement('div');
    rows.setAttribute(SELECTION_MENU_ATTR, '');
    rows.append(row);
    document.body.append(rows);
    press(row, 'touch');
    document.getSelection()!.removeAllRanges();
    changed();
    expect(currentSelectionMenu()).not.toBeNull();
    // Let go elsewhere, the hold runs out: the words going take the menu.
    vi.advanceTimersByTime(PRESS_HOLD_MS);
    changed();
    expect(currentSelectionMenu()).toBeNull();
    unbind();
  });

  it('docks nothing once the words went, or where it can’t send, and a mouse’s words never dock', () => {
    vi.useFakeTimers();
    const { dom, view } = writing();
    const unbind = bindSelectionMenu(view, () => false);
    press(dom, 'touch');
    pick(dom, 4);
    changed();
    document.getSelection()!.removeAllRanges();
    vi.advanceTimersByTime(DOCK_SETTLE_MS);
    expect(currentSelectionMenu()).toBeNull();
    pick(dom, 4);
    changed();
    setSendHere(null);
    vi.advanceTimersByTime(DOCK_SETTLE_MS);
    expect(currentSelectionMenu()).toBeNull();
    setSendHere({ app: 'liveknowledge', tabId: 't1' });
    press(dom, 'mouse');
    changed();
    vi.advanceTimersByTime(DOCK_SETTLE_MS);
    expect(currentSelectionMenu()).toBeNull();
    // Unbound mid-wait: nothing docks after.
    press(dom, 'touch');
    changed();
    unbind();
    vi.advanceTimersByTime(DOCK_SETTLE_MS);
    expect(currentSelectionMenu()).toBeNull();
  });
});

describe('the menu closed from its own side', () => {
  it('is forgotten, so the words going later close no other menu', () => {
    const { dom, view } = writing();
    const unbind = bindSelectionMenu(view, () => false);
    pick(dom, 4);
    rightClick(dom);
    closeSelectionMenu();
    const other = openSelectionMenu({
      anchor: document.body,
      at: { x: 0, y: 0 },
      placement: 'below-start',
      docked: false,
      actions: currentSelectionMenu()?.actions ?? {
        cut: null,
        copy: () => {},
        paste: null,
        sendToPlan: () => {},
        sendToDiagram: null,
      },
    });
    document.getSelection()!.removeAllRanges();
    changed();
    expect(currentSelectionMenu()!.id).toBe(other);
    unbind();
    expect(currentSelectionMenu()!.id).toBe(other);
  });
});
