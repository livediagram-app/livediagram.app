// @vitest-environment jsdom

// Connected files in the page tree (docs/specs/030-knowledgebase/links-and-embeds.md "Connected files in the
// sidebar"): a row with its app's logo and an arrow-out mark that opens the file in a new tab, never as the open page;
// its menu, a role at a time; Can't Open; Connect File in the page menu and the sidebar's foot.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createConnectedRowStore,
  type ConnectedRowState,
  type ConnectedRowStore,
} from '@/lib/knowledge/connected-row-store';
import { AddToSidebar } from './AddToSidebar';
import { connectedMenuRefusals } from './ConnectedRowMenu';
import { PageTree, type PageTreeActions } from './PageTree';
import type { PageTreeConnected } from './connected-rows';
import { pageInPlaceOf } from '@/hooks/editor/useActivePageNotConnected';
import { visiblePageRows, type TreeTab } from './page-tree-view';

const PLAN = { id: 'cn_planaaaaaaaaaaaa', app: 'liveplanner', itemId: 'p1' };
const MAP = { id: 'cn_mapbbbbbbbbbbbbb', app: 'livediagram', itemId: 'd1' };
// Handbook > (Release Process, Launch Plan [connected]), Architecture Map [connected], Notes
const TABS: TreeTab[] = [
  { id: 'a', name: 'Handbook' },
  { id: 'b', name: 'Release Process', parent: 'a' },
  { id: 'p', name: 'Launch Plan', parent: 'a', connection: PLAN },
  { id: 'm', name: 'Architecture Map', connection: MAP },
  { id: 'e', name: 'Notes' },
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

// A store whose answers the test sets.
function storeWith(states: Record<string, ConnectedRowState>): ConnectedRowStore {
  const store = createConnectedRowStore({
    openConnection: vi.fn(() => new Promise<never>(() => {})),
  });
  const real = store.stateOf;
  return {
    ...store,
    stateOf: (id) => states[id] ?? real(id),
    request: vi.fn(),
  };
}

function connectedOf(store: ConnectedRowStore, canConnect = true): PageTreeConnected {
  return {
    store,
    canConnect,
    onConnect: vi.fn(),
    onOpen: vi.fn(),
    onCopyLink: vi.fn(),
    onRemove: vi.fn(),
    onConnectAgain: vi.fn(),
  };
}

const READY: Record<string, ConnectedRowState> = {
  [PLAN.id]: { kind: 'ready', href: 'https://www.liveplanner.app/p/p1', name: 'Launch Plan' },
  [MAP.id]: { kind: 'broken', reason: 'gone' },
};

function mount({ canEdit = true, states = READY, canConnect = true } = {}) {
  const act_ = actions();
  const connected = connectedOf(storeWith(states), canConnect);
  render(
    <PageTree
      tabs={TABS}
      activeId="b"
      closed={new Set()}
      onSetOpen={vi.fn()}
      canEdit={canEdit}
      actions={act_}
      connected={connected}
    />,
  );
  return { actions: act_, connected };
}

const plan = () => screen.getByRole('treeitem', { name: /^Launch Plan/ });
const map = () => screen.getByRole('treeitem', { name: /^Architecture Map/ });
const openMenu = (el: HTMLElement) => {
  fireEvent.pointerOver(el);
  fireEvent.click(within(el).getByRole('button', { name: /^File Options for/ }));
};
const menuItems = () => screen.getAllByRole('menuitem').map((el) => el.textContent?.trim() ?? '');

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('a connected row', () => {
  it('is a link to its file in a new tab, with its app named, among the pages', () => {
    mount();
    const row = plan();
    expect(row.tagName).toBe('A');
    expect(row.getAttribute('href')).toBe('https://www.liveplanner.app/p/p1');
    expect(row.getAttribute('target')).toBe('_blank');
    expect(row.getAttribute('rel')).toBe('noopener');
    expect(row.getAttribute('aria-label')).toBe('Launch Plan, liveplanner, opens in a new tab');
    expect(row.getAttribute('aria-level')).toBe('2');
    expect(row.querySelector('[data-arrow-out]')).not.toBeNull();
    // In tree order, under its page.
    const names = screen
      .getAllByRole('treeitem')
      .map((r) => r.querySelector('[data-page-title]')?.textContent);
    expect(names).toEqual([
      'Handbook',
      'Release Process',
      'Launch Plan',
      'Architecture Map',
      'Notes',
    ]);
  });

  it('opens in a new tab and never becomes the open page', () => {
    const { actions: act_, connected } = mount();
    fireEvent.click(plan());
    expect(act_.onSelect).not.toHaveBeenCalled();
    // Its address known, the browser follows the link itself.
    expect(connected.onOpen).not.toHaveBeenCalled();
    fireEvent.keyDown(plan(), { key: 'Enter' });
    expect(connected.onOpen).toHaveBeenCalledWith('p');
    expect(act_.onSelect).not.toHaveBeenCalled();
  });

  it('asks the tree to open it while its address is not known yet', () => {
    const { connected } = mount({ states: {} });
    expect(plan().hasAttribute('href')).toBe(false);
    fireEvent.click(plan());
    expect(connected.onOpen).toHaveBeenCalledWith('p');
  });

  it('takes no rename, by double click or F2', () => {
    const { actions: act_ } = mount();
    fireEvent.doubleClick(plan());
    fireEvent.keyDown(plan(), { key: 'F2' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(act_.onRename).not.toHaveBeenCalled();
  });

  it("shows Can't Open in amber for a file that opens nothing, and says why", () => {
    mount();
    const row = map();
    expect(row.getAttribute('aria-label')).toBe("Architecture Map, livediagram, Can't Open");
    expect(row.hasAttribute('href')).toBe(false);
    expect(within(row).getByText('Can’t Open')).toBeTruthy();
    openMenu(row);
    expect(
      within(screen.getByRole('menu')).getByText(/moved to the Trash or deleted/),
    ).toBeTruthy();
    // Gone is not mended by connecting again: Remove from Sidebar tidies it up.
    expect(menuItems()).toEqual([
      'Move Up',
      'Move Down',
      'Indent',
      'Outdent',
      'Remove from Sidebar',
    ]);
  });

  it('offers Connect Again for a removed link', () => {
    mount({ states: { ...READY, [MAP.id]: { kind: 'broken', reason: 'link_removed' } } });
    openMenu(map());
    expect(menuItems()).toContain('Connect Again');
  });
});

describe('its menu, a role at a time', () => {
  it('gives a writer Open, Copy Link, the moves and Remove from Sidebar', () => {
    const { connected, actions: act_ } = mount();
    openMenu(plan());
    expect(menuItems()).toEqual([
      'Open',
      'Copy Link',
      'Move Up',
      'Move Down',
      'Indent',
      'Outdent',
      'Remove from Sidebar',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from Sidebar' }));
    expect(connected.onRemove).toHaveBeenCalledWith('p');
    openMenu(plan());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open' }));
    expect(connected.onOpen).toHaveBeenCalledWith('p');
    openMenu(plan());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move Up' }));
    expect(act_.onStep).toHaveBeenCalledWith('p', -1);
  });

  it('gives a Viewer Open and Copy Link alone, and no drag', () => {
    const { connected } = mount({ canEdit: false });
    expect(plan().getAttribute('draggable')).toBe('false');
    openMenu(plan());
    expect(menuItems()).toEqual(['Open', 'Copy Link']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Link' }));
    expect(connected.onCopyLink).toHaveBeenCalledWith('p');
  });

  it('says why a move cannot run', () => {
    const refusals = connectedMenuRefusals(TABS, 'm');
    // The row above Architecture Map is Handbook (a page), so it indents; Notes follows it, so it moves down.
    expect(refusals.indent).toBeUndefined();
    expect(refusals.outdent).toBe('This file is already at the top level.');
    const afterRow = connectedMenuRefusals(
      [
        { id: 'x', name: 'X', connection: PLAN },
        { id: 'y', name: 'Y', connection: MAP },
      ],
      'y',
    );
    expect(afterRow.indent).toMatch(/connected file, which holds nothing/);
  });
});

describe('Connect File', () => {
  it('is Connect File Here in a page’s menu, for a writer where connecting works', () => {
    const { connected } = mount();
    const row = screen.getByRole('treeitem', { name: 'Release Process' });
    fireEvent.pointerOver(row);
    fireEvent.click(within(row).getByRole('button', { name: 'Page Options for Release Process' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Connect File Here' }));
    expect(connected.onConnect).toHaveBeenCalledWith('b');
  });

  it('is not in a page’s menu where connecting does not work', () => {
    mount({ canConnect: false });
    const row = screen.getByRole('treeitem', { name: 'Release Process' });
    fireEvent.pointerOver(row);
    fireEvent.click(within(row).getByRole('button', { name: 'Page Options for Release Process' }));
    expect(menuItems()).not.toContain('Connect File Here');
  });

  it('is in the sidebar foot’s Add to Sidebar menu, which does not repeat the New Page beside it', () => {
    const onAdd = vi.fn();
    const onConnect = vi.fn();
    render(<AddToSidebar tabs={TABS} onAdd={onAdd} onConnect={onConnect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Sidebar' }));
    expect(menuItems()).toEqual(['Connect File']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Connect File' }));
    expect(onConnect).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('leaves the foot as New Page alone where it is not offered', () => {
    render(<AddToSidebar tabs={TABS} onAdd={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Add to Sidebar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'New Page' })).toBeTruthy();
  });
});

describe('the rows and the open page', () => {
  it('reads a connected row with its connection and app, a page with none', () => {
    const rows = visiblePageRows(TABS, new Set(), 'b');
    expect(rows.find((r) => r.id === 'p')).toMatchObject({
      connectionId: PLAN.id,
      app: 'liveplanner',
    });
    expect(rows.find((r) => r.id === 'a')).toMatchObject({ connectionId: null, app: null });
  });

  it('opens the nearest page in place of a connected row', () => {
    expect(pageInPlaceOf(TABS, 'm')).toBe('e');
    expect(pageInPlaceOf(TABS, 'p')).toBe('e');
    expect(pageInPlaceOf([TABS[0]!, TABS[3]!], 'm')).toBe('a');
  });

  it('renders the one row whose answer arrived', async () => {
    const store = createConnectedRowStore({
      openConnection: vi.fn(async () => ({
        app: 'liveplanner',
        name: 'Launch Plan',
        href: 'https://x.example/p',
      })),
    } as never);
    store.setGrant(async () => 'grant');
    render(
      <PageTree
        tabs={TABS}
        activeId="b"
        closed={new Set()}
        onSetOpen={vi.fn()}
        canEdit
        actions={actions()}
        connected={connectedOf(store)}
      />,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(plan().getAttribute('href')).toBe('https://x.example/p');
  });
});
