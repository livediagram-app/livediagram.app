// @vitest-environment jsdom

// The page tree's row controls, right-click and keyboard (docs/specs/030-knowledgebase/knowledgebases-and-pages.md
// "The page tree": "A row's + and ...", "Right-click", the keyboard; blueprint page-tree.md "A row's controls", "The
// keyboard and the row's buttons", "Right-click and long press").
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessLevel } from '@liveknowledge/api-schema';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { PageTree, type PageTreeActions } from './PageTree';
import { ROW_CONTROLS_HIDDEN, ROW_CONTROLS_SHOWN } from './page-tree-row-styles';
import { typeAheadMatch, visiblePageRows, type TreeTab } from './page-tree-view';
import { LONG_PRESS_MS, LONG_PRESS_SLOP_PX } from './useRowLongPress';

const tab = (id: string, name: string, parent?: string): TreeTab => ({ id, name, parent });
// Handbook > (Release Process > Checklist, Onboarding), Notes
const TABS = [
  tab('a', 'Handbook'),
  tab('b', 'Release Process', 'a'),
  tab('d', 'Checklist', 'b'),
  tab('c', 'Onboarding', 'a'),
  tab('e', 'Notes'),
];

function actions(): PageTreeActions {
  return {
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onAdd: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    onStep: vi.fn(),
    onIndent: vi.fn(),
    onOutdent: vi.fn(),
    onCopyLink: vi.fn(),
  };
}

function mount(over: Partial<Parameters<typeof PageTree>[0]> = {}) {
  const act_ = actions();
  const view = render(
    <PageTree
      tabs={TABS}
      activeId="b"
      closed={new Set()}
      onSetOpen={vi.fn()}
      canEdit
      actions={act_}
      {...over}
    />,
  );
  return { ...view, actions: act_ };
}

const row = (name: string) => screen.getByRole('treeitem', { name });
const controls = (name: string) => row(name).querySelector<HTMLElement>('[data-row-controls]')!;
const menu = () => screen.queryByRole('menu');
const menuItems = () =>
  screen
    .getAllByRole('menuitem')
    .map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '');
const press = (name: string, key: string, shiftKey = false) =>
  fireEvent.keyDown(row(name), { key, shiftKey });

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  // jsdom lays nothing out: a menu's box is where its style puts it, so the edge clamp sees it as a browser would.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return new DOMRect(parseFloat(this.style.left) || 0, parseFloat(this.style.top) || 0, 224, 200);
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('a row’s + and … (WI-1335)', () => {
  const classes = (name: string) => controls(name).className.split(/\s+/);

  it('with a mouse, waits for the row’s hover or focus, unpressable until then', () => {
    mount();
    const hidden = classes('Notes');
    for (const c of [
      'fine-pointer:opacity-0',
      'fine-pointer:pointer-events-none',
      'fine-pointer:group-hover/row:opacity-100',
      'fine-pointer:group-hover/row:pointer-events-auto',
      'fine-pointer:group-focus-within/row:opacity-100',
      'fine-pointer:group-focus-within/row:pointer-events-auto',
    ])
      expect(hidden, c).toContain(c);
    // The row is the named group the hover is read from.
    expect(row('Notes').className.split(/\s+/)).toContain('group/row');
  });

  it('hides only under the fine-pointer variant, so a touch screen always shows them', () => {
    mount();
    const hiding = ['opacity-0', 'pointer-events-none', 'scale-90', 'translate-x-1'];
    for (const c of classes('Notes')) expect(hiding, c).not.toContain(c);
    const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');
    expect(css).toMatch(
      /@custom-variant fine-pointer \{\s*@media \(hover: hover\) and \(pointer: fine\) \{\s*@slot;/,
    );
  });

  it('fades and slides in over 150ms, ease out, only without reduced motion', () => {
    for (const c of [
      'motion-safe:transition-[opacity,translate,scale]',
      'motion-safe:duration-micro',
      'motion-safe:ease-out',
      'fine-pointer:translate-x-1',
      'fine-pointer:scale-90',
    ])
      expect(ROW_CONTROLS_HIDDEN.split(' '), c).toContain(c);
  });

  it('always shows them on the current page and on the row whose menu is open', () => {
    mount();
    expect(controls('Release Process').className).toBe(`${ROW_CONTROLS_SHOWN} w-[50px]`);
    expect(controls('Notes').className).toBe(`${ROW_CONTROLS_HIDDEN} w-[50px]`);
    fireEvent.contextMenu(row('Notes'), { clientX: 40, clientY: 90 });
    expect(controls('Notes').className).toBe(`${ROW_CONTROLS_SHOWN} w-[50px]`);
  });

  it('keeps the phone sheet’s 44px menu button, Add Subpage in its menu', () => {
    mount({ touch: true });
    expect(controls('Notes').className).toContain('w-9');
    const button = within(row('Notes')).getByRole('button', { name: 'Page Options for Notes' });
    expect(button.className).toContain('h-11');
    expect(within(row('Notes')).queryByRole('button', { name: /Add Subpage/ })).toBeNull();
  });
});

describe('the Tab key and the row’s buttons (WI-1344)', () => {
  it('makes the Tab stop row’s + and … the next stops, and no other row’s', () => {
    mount();
    const stops = [...document.querySelectorAll<HTMLElement>('[tabindex="0"]')];
    expect(stops).toEqual([
      row('Release Process'),
      within(row('Release Process')).getByRole('button', {
        name: 'Add Subpage to Release Process',
      }),
      within(row('Release Process')).getByRole('button', {
        name: 'Page Options for Release Process',
      }),
    ]);
  });

  it('moves the buttons’ stops with the focused row', () => {
    mount();
    act(() => row('Release Process').focus());
    press('Release Process', 'ArrowDown');
    expect(
      within(row('Checklist')).getByRole('button', { name: 'Page Options for Checklist' }).tabIndex,
    ).toBe(0);
    expect(
      within(row('Release Process')).getByRole('button', {
        name: 'Page Options for Release Process',
      }).tabIndex,
    ).toBe(-1);
  });

  it('runs a button’s verb from the keyboard, and leaves arrow keys on it alone', () => {
    const { actions: a } = mount();
    const add = within(row('Release Process')).getByRole('button', {
      name: 'Add Subpage to Release Process',
    });
    act(() => add.focus());
    fireEvent.keyDown(add, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(add);
    fireEvent.click(add);
    expect(a.onAdd).toHaveBeenCalledWith('b');
  });
});

describe('the keyboard (WI-1344)', () => {
  it('draws a focus ring on the focused row: its own outline style, which outline-none had set to none', () => {
    mount();
    const classes = row('Notes').className.split(/\s+/);
    for (const c of [
      'focus-visible:outline-2',
      'focus-visible:outline-solid',
      'focus-visible:outline-brand-600',
      'dark:focus-visible:outline-brand-400',
    ])
      expect(classes, c).toContain(c);
  });

  it('goes to the first and the last row with Home and End', () => {
    mount();
    act(() => row('Release Process').focus());
    press('Release Process', 'End');
    expect(document.activeElement).toBe(row('Notes'));
    press('Notes', 'Home');
    expect(document.activeElement).toBe(row('Handbook'));
  });

  it('goes into an open page with Right, and up to the parent with Left', () => {
    mount();
    press('Handbook', 'ArrowRight');
    expect(document.activeElement).toBe(row('Release Process'));
    press('Checklist', 'ArrowLeft');
    expect(document.activeElement).toBe(row('Release Process'));
  });

  it('opens the row’s menu with the menu key and with Shift+F10, not F10 alone', () => {
    mount();
    press('Onboarding', 'F10');
    expect(menu()).toBeNull();
    press('Onboarding', 'F10', true);
    expect(menuItems()).toContain('Add Subpage');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(menu()).toBeNull();
    press('Notes', 'ContextMenu');
    expect(menu()).toBeTruthy();
    // The contextmenu event the key sends after it is the key's: the menu stays at its button, not at a point.
    const left = menu()!.style.left;
    fireEvent.contextMenu(row('Notes'), { clientX: 300, clientY: 300 });
    expect(menu()!.style.left).toBe(left);
    expect(left).not.toBe('300px');
  });

  it('jumps to the next row whose name starts with the letters typed', () => {
    vi.useFakeTimers();
    mount();
    act(() => row('Release Process').focus());
    press('Release Process', 'n');
    expect(document.activeElement).toBe(row('Notes'));
    vi.advanceTimersByTime(600);
    press('Notes', 'h');
    expect(document.activeElement).toBe(row('Handbook'));
    vi.advanceTimersByTime(600);
    // Typed quickly, the letters make one search: "on" is Onboarding, not the next row starting with "o".
    press('Handbook', 'O');
    press('Onboarding', 'n');
    expect(document.activeElement).toBe(row('Onboarding'));
    // A letter no row starts with leaves the focus where it is.
    vi.advanceTimersByTime(600);
    press('Onboarding', 'z');
    expect(document.activeElement).toBe(row('Onboarding'));
  });

  it('reads type-ahead off the names the rows show, cycling a repeated letter', () => {
    const rows = visiblePageRows(
      [tab('a', 'Alpha'), tab('b', ''), tab('c', 'Apple'), tab('d', 'Secret')],
      new Set(),
      null,
    );
    const shown = (r: (typeof rows)[number]) =>
      r.id === 'd' ? 'Not Shared' : r.name || 'Untitled Page';
    expect(typeAheadMatch(rows, 'a', 'a', shown)).toBe('c');
    expect(typeAheadMatch(rows, 'c', 'aa', shown)).toBe('a');
    expect(typeAheadMatch(rows, 'a', 'unt', shown)).toBe('b');
    // An out of scope page is found by the words it shows, never its own name.
    expect(typeAheadMatch(rows, 'a', 'sec', shown)).toBeNull();
    expect(typeAheadMatch(rows, 'a', 'not', shown)).toBe('d');
    expect(typeAheadMatch(rows, 'a', '', shown)).toBeNull();
    expect(typeAheadMatch([], null, 'a', shown)).toBeNull();
  });

  it('leaves Space, modified keys and keys on the rename field to their owners', () => {
    mount();
    act(() => row('Release Process').focus());
    press('Release Process', ' ');
    fireEvent.keyDown(row('Release Process'), { key: 'n', ctrlKey: true });
    expect(document.activeElement).toBe(row('Release Process'));
    press('Notes', 'F2');
    const field = screen.getByRole('textbox', { name: 'Page name' });
    fireEvent.keyDown(field, { key: 'h' });
    expect(screen.getByRole('textbox', { name: 'Page name' })).toBe(field);
  });
});

describe('right-click (WI-1336)', () => {
  it('opens the row’s menu at the pointer, in place of the browser’s', () => {
    mount();
    const event = fireEvent.contextMenu(within(row('Onboarding')).getByText('Onboarding'), {
      clientX: 120,
      clientY: 200,
    });
    expect(event).toBe(false);
    expect(menuItems()).toEqual([
      'Rename',
      'Duplicate',
      'Copy Link',
      'Delete',
      'Add Subpage',
      'Move',
    ]);
    expect(menu()!.style.left).toBe('120px');
    expect(menu()!.style.top).toBe('200px');
  });

  it('moves to another row on a second right-click, and closes on Escape', () => {
    mount();
    fireEvent.contextMenu(row('Onboarding'), { clientX: 40, clientY: 100 });
    fireEvent.pointerDown(row('Notes'), { button: 2 });
    fireEvent.contextMenu(row('Notes'), { clientX: 40, clientY: 160 });
    expect(menu()!.style.top).toBe('160px');
    expect(row('Notes').querySelector('[aria-expanded="true"]')).toBeTruthy();
    expect(row('Onboarding').querySelector('[aria-expanded="true"]')).toBeNull();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(menu()).toBeNull();
  });

  it('closes on a press outside it', () => {
    mount();
    fireEvent.contextMenu(row('Onboarding'), { clientX: 40, clientY: 100 });
    fireEvent.pointerDown(document.body);
    expect(menu()).toBeNull();
  });

  it('opens nothing on a page out of scope, nor on a row being renamed', () => {
    mount({ isOutOfScope: (id) => id === 'e' });
    expect(fireEvent.contextMenu(row('Not Shared'))).toBe(false);
    expect(menu()).toBeNull();
    press('Onboarding', 'F2');
    const field = screen.getByRole('textbox', { name: 'Page name' });
    // The rename field keeps the browser's own menu (paste).
    expect(fireEvent.contextMenu(field)).toBe(true);
    expect(menu()).toBeNull();
  });

  it('leaves a right-click off the rows alone', () => {
    mount();
    expect(fireEvent.contextMenu(screen.getByRole('tree'))).toBe(true);
    expect(menu()).toBeNull();
  });
});

describe.each(['edit', 'participate', 'view'] as AccessLevel[])('right-click, role %s', (level) => {
  const may = resolveEditorCapabilities(level).editPages;
  it(`${level === 'view' ? 'offers Copy Link alone' : 'offers the page’s verbs'}, as the … menu does`, () => {
    mount({ canEdit: may });
    fireEvent.contextMenu(row('Onboarding'), { clientX: 10, clientY: 10 });
    expect(menuItems()).toEqual(
      level === 'view'
        ? ['Copy Link']
        : ['Rename', 'Duplicate', 'Copy Link', 'Delete', 'Add Subpage', 'Move'],
    );
  });
});

describe('long press (WI-1336)', () => {
  const touchDown = (el: Element, x = 30, y = 60) =>
    fireEvent.pointerDown(el, {
      pointerType: 'touch',
      isPrimary: true,
      pointerId: 7,
      clientX: x,
      clientY: y,
    });
  const touchMove = (el: Element, x: number, y: number) =>
    fireEvent.pointerMove(el, { pointerType: 'touch', pointerId: 7, clientX: x, clientY: y });

  beforeEach(() => vi.useFakeTimers());

  it('opens the row’s menu at the finger once held, and the release opens no page', () => {
    const { actions: a } = mount({ touch: true });
    touchDown(row('Notes'));
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    });
    expect(menu()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(menu()!.style.left).toBe('30px');
    fireEvent.pointerUp(row('Notes'), { pointerType: 'touch', pointerId: 7 });
    fireEvent.click(row('Notes'));
    expect(a.onSelect).not.toHaveBeenCalled();
    // The next tap is a tap.
    fireEvent.click(row('Notes'));
    expect(a.onSelect).toHaveBeenCalledWith('e');
  });

  it('is cancelled by lifting, a move past the slop or the browser taking the press', () => {
    const { actions: a } = mount({ touch: true });
    touchDown(row('Notes'));
    fireEvent.pointerUp(row('Notes'), { pointerType: 'touch', pointerId: 7 });
    fireEvent.click(row('Notes'));
    expect(a.onSelect).toHaveBeenCalledWith('e');
    touchDown(row('Notes'));
    touchMove(row('Notes'), 30 + LONG_PRESS_SLOP_PX - 1, 60);
    touchMove(row('Notes'), 30 + LONG_PRESS_SLOP_PX + 1, 60);
    touchDown(row('Onboarding'));
    fireEvent.pointerCancel(row('Onboarding'), { pointerType: 'touch', pointerId: 7 });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS * 2);
    });
    expect(menu()).toBeNull();
  });

  it('lets a drag win: the hold ends, and a menu it opened closes', () => {
    const { actions: a } = mount({ touch: true });
    const dataTransfer = { setData: vi.fn(), getData: vi.fn(), effectAllowed: '', dropEffect: '' };
    touchDown(row('Notes'));
    fireEvent.dragStart(row('Notes'), { dataTransfer });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(menu()).toBeNull();
    fireEvent.dragEnd(row('Notes'));
    touchDown(row('Onboarding'));
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(menu()).toBeTruthy();
    fireEvent.dragStart(row('Onboarding'), { dataTransfer });
    expect(menu()).toBeNull();
    expect(a.onMove).not.toHaveBeenCalled();
  });

  it('is never a mouse’s, a second finger’s or a press on a row’s button', () => {
    mount({ touch: true });
    fireEvent.pointerDown(row('Notes'), { pointerType: 'mouse', isPrimary: true });
    fireEvent.pointerDown(row('Notes'), { pointerType: 'touch', isPrimary: false });
    touchDown(within(row('Notes')).getByRole('button', { name: 'Page Options for Notes' }));
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS * 2);
    });
    expect(menu()).toBeNull();
  });
});
