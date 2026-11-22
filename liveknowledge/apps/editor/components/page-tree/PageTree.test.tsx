// @vitest-environment jsdom

// The page tree's list (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page tree" and "Share roles"):
// a real tree for the keyboard, the row menu, the rename, the drag, and what each share role is offered.
import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessLevel } from '@liveknowledge/api-schema';
import { MAX_KNOWLEDGEBASE_PAGES } from '@liveknowledge/document';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { PageTree, type PageTreeActions } from './PageTree';
import { pageMenuRefusals } from './PageTreeRowMenu';
import type { TreeTab } from './page-tree-view';

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
  const onSetOpen = vi.fn();
  const view = render(
    <PageTree
      tabs={TABS}
      activeId="b"
      closed={new Set()}
      onSetOpen={onSetOpen}
      canEdit
      actions={act_}
      {...over}
    />,
  );
  return { ...view, actions: act_, onSetOpen };
}

const row = (name: string) => screen.getByRole('treeitem', { name });
const hover = (name: string) => fireEvent.pointerOver(row(name));
const openMenu = (name: string) => {
  hover(name);
  fireEvent.click(within(row(name)).getByRole('button', { name: `Page Options for ${name}` }));
};
// A toolbar button is named by its label alone; a row by its words.
const menuItems = () =>
  screen
    .getAllByRole('menuitem')
    .map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '');
const openMove = () => fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }));

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the tree', () => {
  it('is a tree of treeitems, each with its level, its place, and whether it is open', () => {
    mount({ closed: new Set(['b']) });
    expect(screen.getByRole('tree', { name: 'Pages' })).toBeTruthy();
    const items = screen.getAllByRole('treeitem');
    expect(items.map((el) => el.getAttribute('aria-label'))).toEqual([
      'Handbook',
      'Release Process',
      'Onboarding',
      'Notes',
    ]);
    expect(items.map((el) => el.getAttribute('aria-level'))).toEqual(['1', '2', '2', '1']);
    expect(row('Handbook').getAttribute('aria-expanded')).toBe('true');
    // The current page's ancestors are open whatever was closed; the current page itself is as it was left.
    expect(row('Release Process').getAttribute('aria-expanded')).toBe('false');
    expect(row('Notes').hasAttribute('aria-expanded')).toBe(false);
    expect(row('Onboarding').getAttribute('aria-posinset')).toBe('2');
    expect(row('Onboarding').getAttribute('aria-setsize')).toBe('2');
  });

  it('marks the current page, which is the one row the Tab key lands on', () => {
    mount();
    expect(row('Release Process').getAttribute('aria-current')).toBe('page');
    expect(row('Release Process').getAttribute('aria-selected')).toBe('true');
    const stops = screen.getAllByRole('treeitem').filter((el) => el.tabIndex === 0);
    expect(stops).toEqual([row('Release Process')]);
  });

  it('indents a level by 20px', () => {
    mount();
    const left = (name: string) => Number.parseInt(row(name).style.paddingLeft, 10);
    expect(left('Release Process') - left('Handbook')).toBe(20);
    expect(left('Checklist') - left('Release Process')).toBe(20);
  });

  it('opens a page on a click, and never the one already open', () => {
    const { actions: a } = mount();
    fireEvent.click(row('Notes'));
    expect(a.onSelect).toHaveBeenCalledWith('e');
  });

  it('folds and unfolds from the chevron without opening the page', () => {
    const { actions: a, onSetOpen } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Handbook' }));
    expect(onSetOpen).toHaveBeenCalledWith('a', false);
    expect(a.onSelect).not.toHaveBeenCalled();
  });

  it('keeps a row’s + and … mounted, quiet until pointed at, in room that never changes', () => {
    mount();
    const room = (name: string) => row(name).querySelector('[data-row-controls]')!;
    const options = () =>
      within(row('Notes')).getByRole('button', { name: 'Page Options for Notes' });
    expect(options().className).toContain('text-slate-400/70');
    expect(within(row('Notes')).getByRole('button', { name: 'Add Subpage to Notes' })).toBeTruthy();
    const before = room('Notes').className;
    hover('Notes');
    expect(within(row('Notes')).getByRole('button', { name: 'Add Subpage to Notes' })).toBeTruthy();
    expect(options().className).not.toContain('text-slate-400/70');
    // The hover is CSS's: the row renders nothing new into its controls' box, so nothing shifts.
    expect(room('Notes').className).toBe(before);
    expect(before).toContain('w-[50px]');
  });

  it('names an out of scope page Not Shared and does not open it', () => {
    const { actions: a } = mount({ isOutOfScope: (id) => id === 'e' });
    fireEvent.click(row('Not Shared'));
    expect(a.onSelect).not.toHaveBeenCalled();
    expect(row('Not Shared').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('the keyboard', () => {
  const press = (name: string, key: string) => fireEvent.keyDown(row(name), { key });

  it('moves focus with the arrows, and the Tab stop with it', () => {
    mount();
    act(() => row('Release Process').focus());
    press('Release Process', 'ArrowDown');
    expect(document.activeElement).toBe(row('Checklist'));
    expect(row('Checklist').tabIndex).toBe(0);
    expect(row('Release Process').tabIndex).toBe(-1);
    press('Checklist', 'ArrowLeft');
    expect(document.activeElement).toBe(row('Release Process'));
  });

  it('opens and closes with Right and Left', () => {
    const { onSetOpen } = mount({ closed: new Set(['a']), activeId: 'e' });
    press('Handbook', 'ArrowRight');
    expect(onSetOpen).toHaveBeenCalledWith('a', true);
    cleanup();
    const again = mount({ activeId: 'e' });
    press('Handbook', 'ArrowLeft');
    expect(again.onSetOpen).toHaveBeenCalledWith('a', false);
  });

  it('opens the page with Enter and renames it with F2', () => {
    const { actions: a } = mount();
    press('Notes', 'Enter');
    expect(a.onSelect).toHaveBeenCalledWith('e');
    press('Notes', 'F2');
    const field = screen.getByRole('textbox', { name: 'Page name' });
    fireEvent.change(field, { target: { value: 'Meeting Notes' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(a.onRename).toHaveBeenCalledWith('e', 'Meeting Notes');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('leaves the arrows to the rename field while it is open', () => {
    mount();
    press('Notes', 'F2');
    const field = screen.getByRole('textbox', { name: 'Page name' });
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(screen.getByRole('textbox', { name: 'Page name' })).toBe(field);
  });
});

describe('the row menu', () => {
  it('puts Rename, Duplicate, Copy Link and Delete in a toolbar, then the rows, then a closed Move section', () => {
    mount();
    openMenu('Onboarding');
    expect(menuItems()).toEqual([
      'Rename',
      'Duplicate',
      'Copy Link',
      'Delete',
      'Add Subpage',
      'Move',
    ]);
    openMove();
    expect(menuItems().slice(-4)).toEqual(['Move Up', 'Move Down', 'Indent', 'Outdent']);
  });

  it('runs each verb on its page', () => {
    const verbs: [string, keyof PageTreeActions, unknown[]][] = [
      ['Add Subpage', 'onAdd', ['c']],
      ['Duplicate', 'onDuplicate', ['c']],
      ['Copy Link', 'onCopyLink', ['c']],
      ['Move Up', 'onStep', ['c', -1]],
      ['Indent', 'onIndent', ['c']],
      ['Outdent', 'onOutdent', ['c']],
      ['Delete', 'onDelete', ['c']],
    ];
    for (const [label, action, args] of verbs) {
      const { actions: a } = mount();
      openMenu('Onboarding');
      if (['Move Up', 'Indent', 'Outdent'].includes(label)) openMove();
      fireEvent.click(screen.getByRole('menuitem', { name: label }));
      expect(a[action], label).toHaveBeenCalledWith(...args);
      expect(screen.queryByRole('menuitem')).toBeNull();
      cleanup();
    }
  });

  it('renames in place from the menu', () => {
    mount();
    openMenu('Onboarding');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Page name' }).value).toBe(
      'Onboarding',
    );
  });

  it('opens the parent when a subpage is added, so the new page shows', () => {
    const { onSetOpen } = mount({ closed: new Set(['a']), activeId: 'e' });
    hover('Handbook');
    fireEvent.click(screen.getByRole('button', { name: 'Add Subpage to Handbook' }));
    expect(onSetOpen).toHaveBeenCalledWith('a', true);
  });

  it('says why a verb cannot run', () => {
    expect(pageMenuRefusals(TABS, 'a')).toEqual({
      up: 'This is the first page here.',
      indent: 'There is no page above to move this one under.',
      outdent: 'This page is already at the top level.',
    });
    expect(pageMenuRefusals(TABS, 'e')).toMatchObject({ down: 'This is the last page here.' });
    // The last page cannot be deleted: a knowledgebase always has a page.
    expect(pageMenuRefusals([tab('x', 'Only')], 'x').delete).toBe(
      'A knowledgebase always has a page.',
    );
    expect(pageMenuRefusals([tab('x', 'A'), { ...tab('y', 'B'), locked: true }], 'y').delete).toBe(
      'Unlock the page before deleting it.',
    );
    // At the page limit neither a subpage nor a copy can be added.
    const full = Array.from({ length: MAX_KNOWLEDGEBASE_PAGES }, (_, i) => tab(`t${i}`, `P${i}`));
    expect(pageMenuRefusals(full, 't1')).toMatchObject({
      add: 'A knowledgebase holds 500 pages at most.',
      duplicate: 'A knowledgebase holds 500 pages at most.',
    });
    // Eight levels deep: no subpage under the deepest, and no indent that would make a ninth.
    const deep = Array.from({ length: 8 }, (_, i) =>
      tab(`p${i}`, `L${i}`, i ? `p${i - 1}` : undefined),
    );
    expect(pageMenuRefusals(deep, 'p7').add).toBe('Pages nest 8 levels deep at most.');
  });

  it('keeps a verb that cannot run in the menu, greyed, and does nothing on a press', () => {
    const { actions: a } = mount({ tabs: [tab('x', 'Only')], activeId: 'x' });
    openMenu('Only');
    const del = screen.getByRole('menuitem', { name: 'Delete' });
    expect(del.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(del);
    expect(a.onDelete).not.toHaveBeenCalled();
  });
});

describe('the drag', () => {
  // jsdom lays nothing out: each row is given a 32px box at its place in the list.
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const rows = [...document.querySelectorAll('[data-page-row]')];
      const top = Math.max(0, rows.indexOf(this)) * 32;
      return {
        top,
        bottom: top + 32,
        left: 0,
        right: 264,
        width: 264,
        height: 32,
        x: 0,
        y: top,
        toJSON: () => ({}),
      };
    });
  });
  const transfer = () => ({
    setData: vi.fn(),
    getData: vi.fn(),
    effectAllowed: '',
    dropEffect: '',
  });
  const at = (name: string, zone: 'top' | 'middle' | 'bottom') => {
    const index = screen.getAllByRole('treeitem').indexOf(row(name));
    return index * 32 + { top: 2, middle: 16, bottom: 30 }[zone];
  };
  const drag = (from: string, to: string, zone: 'top' | 'middle' | 'bottom') => {
    const dataTransfer = transfer();
    fireEvent.dragStart(row(from), { dataTransfer });
    // jsdom's drag events carry no pointer position: it is set on the event itself.
    const event = createEvent.dragOver(row(to), { dataTransfer });
    Object.defineProperty(event, 'clientY', { value: at(to, zone) });
    const over = fireEvent(row(to), event);
    return { dataTransfer, taken: !over };
  };

  it('reorders among siblings on a row’s edge, showing the insertion line', () => {
    const { actions: a } = mount();
    const { dataTransfer, taken } = drag('Notes', 'Onboarding', 'top');
    expect(taken).toBe(true);
    expect(row('Onboarding').querySelector('[data-insert-line="before"]')).toBeTruthy();
    fireEvent.drop(row('Onboarding'), { dataTransfer });
    expect(a.onMove).toHaveBeenCalledWith('e', { parent: 'a', before: 'c' });
    expect(document.querySelector('[data-insert-line]')).toBeNull();
  });

  it('nests on the row itself, which highlights and then opens', () => {
    const { actions: a, onSetOpen } = mount();
    const { dataTransfer } = drag('Notes', 'Onboarding', 'middle');
    expect(row('Onboarding').className).toContain('ring-brand-500');
    fireEvent.drop(row('Onboarding'), { dataTransfer });
    expect(a.onMove).toHaveBeenCalledWith('e', { parent: 'c' });
    expect(onSetOpen).toHaveBeenCalledWith('c', true);
  });

  it('never drops a page inside its own subtree', () => {
    const { actions: a } = mount();
    const { dataTransfer, taken } = drag('Handbook', 'Checklist', 'middle');
    expect(taken).toBe(false);
    expect(row('Checklist').className).not.toContain('ring-brand-500');
    fireEvent.drop(row('Checklist'), { dataTransfer });
    expect(a.onMove).not.toHaveBeenCalled();
  });

  it('takes no drop where the page already is', () => {
    mount({ closed: new Set(['b']), activeId: 'e' });
    // Onboarding already sits just after Release Process.
    const { taken } = drag('Onboarding', 'Release Process', 'bottom');
    expect(taken).toBe(false);
  });

  it('dims the dragged row and clears every mark when the drag ends', () => {
    mount();
    drag('Notes', 'Onboarding', 'middle');
    expect(row('Notes').className).toContain('opacity-50');
    fireEvent.dragEnd(row('Notes'));
    expect(row('Notes').className).not.toContain('opacity-50');
    expect(row('Onboarding').className).not.toContain('ring-brand-500');
  });
});

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles": the tree's actions, a role at a time. What
// a role may do is `can.editPages` (lib/editor-capabilities.ts), which the model hands the tree as `canEdit`.
describe.each(['edit', 'participate', 'view'] as AccessLevel[])('share roles: %s', (level) => {
  const may = resolveEditorCapabilities(level).editPages;
  // A Participant is an Editor minus the settings, the style and automations: the tree is its to change.
  const offered = level !== 'view';

  it(`${offered ? 'may' : 'may not'} change the page tree`, () => {
    expect(may).toBe(offered);
  });

  it(`${offered ? 'offers' : 'withholds'} Add Subpage on a row`, () => {
    mount({ canEdit: may });
    hover('Notes');
    expect(screen.queryByRole('button', { name: 'Add Subpage to Notes' }) !== null).toBe(offered);
  });

  it(`${offered ? 'lists' : 'withholds'} rename, add, duplicate, move, indent, outdent and delete; Copy Link stays`, () => {
    mount({ canEdit: may });
    openMenu('Onboarding');
    const changing = ['Rename', 'Add Subpage', 'Duplicate', 'Move', 'Delete'];
    const items = menuItems();
    for (const verb of changing) expect(items.includes(verb), verb).toBe(offered);
    expect(items).toContain('Copy Link');
  });

  it(`${offered ? 'renames' : 'does not rename'} with F2 or a double click`, () => {
    mount({ canEdit: may });
    fireEvent.keyDown(row('Notes'), { key: 'F2' });
    expect(screen.queryByRole('textbox') !== null).toBe(offered);
    cleanup();
    mount({ canEdit: may });
    fireEvent.doubleClick(row('Notes'));
    expect(screen.queryByRole('textbox') !== null).toBe(offered);
  });

  it(`${offered ? 'drags' : 'does not drag'} a row to move it`, () => {
    const { actions: a } = mount({ canEdit: may });
    expect(row('Notes').draggable).toBe(offered);
    const dataTransfer = { setData: vi.fn(), getData: vi.fn(), effectAllowed: '', dropEffect: '' };
    const started = fireEvent.dragStart(row('Notes'), { dataTransfer });
    expect(started).toBe(offered);
    fireEvent.dragOver(row('Onboarding'), { dataTransfer, clientY: 0 });
    fireEvent.drop(row('Onboarding'), { dataTransfer });
    expect(a.onMove).toHaveBeenCalledTimes(offered ? 1 : 0);
  });

  it('reads and follows the tree whatever the role', () => {
    const { actions: a } = mount({ canEdit: may });
    fireEvent.click(row('Notes'));
    expect(a.onSelect).toHaveBeenCalledWith('e');
  });
});
