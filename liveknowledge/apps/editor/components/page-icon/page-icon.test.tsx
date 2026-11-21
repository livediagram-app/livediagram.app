// @vitest-environment jsdom

// A page's icon in the editor (docs/specs/030-knowledgebase/page-surface.md "The page icon"): Add Icon and the head
// by role, the picker (its tabs, search, keys, Recent, Remove with Undo), and the icon in the tree and breadcrumb.
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveknowledge/document';
import { chromeValue, renderInEditor, type Role } from '@/components/ask/test-chrome';
import type { EditorChromeStore } from '@/app/document/[id]/EditorContext';
import { visiblePageRows } from '@/components/page-tree/page-tree-view';
import { PageBreadcrumb } from '@/components/page-tree/PageBreadcrumb';
import { PageMetaRowView } from '@/components/knowledge/PageMetaRow';
import { pageTrust } from '@/lib/knowledge/page-trust';
import { AddIconButton } from './AddIconButton';
import { PageIconHead } from './PageIconHead';
import { gridStep, loadEmojiCatalogue, PICKER_COLUMNS } from './PageIconPicker';
import { PAGE_ICON_RECENT_KEY, PAGE_ICON_RECENT_MAX, withRecentIcon } from './page-icon-recent';
import { iconOfTab, usePageIcon, withTabIcon } from './page-icon-state';
import { searchEmoji, EMOJI_GROUPS } from './emoji-catalogue';

const toast = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

beforeAll(() => {
  // A desktop window: the picker is a popover there.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
});

beforeEach(() => {
  toast.info.mockClear();
  track.mockClear();
  window.localStorage.clear();
});

/** The editor's store over one page, its commits applied as the editor's are. A Participant is a writer: in
 *  liveknowledge their session is not read-only (useParticipantSession). */
function mount(ui: React.ReactElement, icon: unknown, role: Role = 'edit', over = {}) {
  const tab = { id: 'p1', name: 'Release Process', elements: [], ...(icon ? { icon } : {}) } as Tab;
  const ref: { store?: EditorChromeStore } = {};
  const value = chromeValue(role, {
    tabs: [tab],
    activeTab: tab,
    isReadOnly: role === 'view',
    participating: false,
    commitTabs: (map: (ts: Tab[]) => Tab[]) => {
      const s = ref.store!.get();
      const tabs = map(s.tabs);
      ref.store!.set({ ...s, tabs, activeTab: tabs[0]! });
    },
    ...over,
  });
  const out = renderInEditor(ui, value);
  ref.store = out.store;
  return { ...out, icon: () => iconOfTab(out.store.get().activeTab) };
}

// The meta row's way: Add Icon while the page has none, then the head.
function AddAndHead() {
  const icon = usePageIcon();
  return (
    <>
      {icon ? null : <AddIconButton />}
      <PageIconHead />
    </>
  );
}

const NOW = Date.UTC(2026, 10, 21, 12);

describe('Add Icon in the meta row', () => {
  it('stands right after Add Cover, the pair with no dot between, with its hover card', () => {
    const { container } = renderInEditor(
      <PageMetaRowView
        minutes={3}
        trust={pageTrust(undefined, 90, NOW)}
        now={NOW}
        verifiedBy={undefined}
        changedSinceVerified={false}
        addCover
        addIcon
      />,
    );
    const row = container.querySelector('[data-page-meta]')!;
    const buttons = [...row.querySelectorAll('button')].map((b) => b.textContent);
    expect(buttons).toEqual(['Add Cover', 'Add Icon']);
    // One dot: between the reading time and the pair, none inside it.
    expect([...row.children].filter((c) => c.textContent === '·')).toHaveLength(1);
    const button = screen.getByRole('button', { name: /Add Icon/ });
    expect(button.className).toContain('cursor-pointer');
    const described = button.getAttribute('aria-describedby')!.split(' ').at(-1)!;
    expect(document.getElementById(described)?.textContent).toBe(
      "Add an emoji or an icon beside this page's title, shown in the page tree too.",
    );
  });

  it('stands alone where a cover is already set', () => {
    renderInEditor(
      <PageMetaRowView
        trust={pageTrust(undefined, 90, NOW)}
        now={NOW}
        verifiedBy={undefined}
        changedSinceVerified={false}
        addIcon
      />,
    );
    expect(screen.queryByRole('button', { name: /Add Cover/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Add Icon/ })).toBeTruthy();
  });
});

describe('who may change a page’s icon', () => {
  it.each<Role>(['edit', 'participate'])(
    'an %s picks one, and it is saved at once',
    async (role) => {
      const { icon, container } = mount(<AddAndHead />, undefined, role);
      fireEvent.click(screen.getByRole('button', { name: /Add Icon/ }));
      expect(screen.getByRole('heading', { name: 'Add Icon' })).toBeTruthy();
      const rocket = await screen.findByRole('button', { name: 'rocket' });
      fireEvent.click(rocket);
      expect(icon()).toEqual({ emoji: '🚀' });
      expect(track).toHaveBeenCalledWith('Element', 'Added', 'PageIcon');
      // Now the head: a button that opens the picker again.
      const head = container.querySelector('[data-page-icon]')!;
      expect(head.tagName).toBe('BUTTON');
      expect(head.textContent).toBe('🚀');
      expect(screen.queryByRole('button', { name: /Add Icon/ })).toBeNull();
    },
  );

  it.each<[Role, object]>([
    ['view', {}],
    ['edit', { pageEditing: { editing: false } }],
  ])('shows a %s (%o) the icon as a picture, with no control', (role, over) => {
    const { container } = mount(<PageIconHead />, { emoji: '📚' }, role, over);
    const head = container.querySelector('[data-page-icon]')!;
    expect(head.tagName).toBe('DIV');
    expect(head.getAttribute('role')).toBe('img');
    expect(head.textContent).toBe('📚');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws nothing for a page with no icon, or one it cannot read', () => {
    expect(mount(<PageIconHead />, undefined).container.innerHTML).toBe('');
    expect(mount(<PageIconHead />, { emoji: 'words' }).container.innerHTML).toBe('');
  });
});

describe('the picker', () => {
  it('changes the icon, counts the change, and takes Enter on a search as its best match', async () => {
    const { icon } = mount(<PageIconHead />, { emoji: '📚' });
    fireEvent.click(screen.getByRole('button', { name: 'Change Icon' }));
    expect(screen.getByRole('heading', { name: 'Change Icon' })).toBeTruthy();
    const search = await screen.findByRole('searchbox', { name: 'Search Emoji' });
    fireEvent.change(search, { target: { value: 'rocket' } });
    await screen.findByRole('button', { name: 'rocket' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(icon()).toEqual({ emoji: '🚀' });
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'PageIcon');
  });

  it('says so when a search finds nothing', async () => {
    mount(<AddIconButton />, undefined);
    fireEvent.click(screen.getByRole('button', { name: /Add Icon/ }));
    const search = await screen.findByRole('searchbox', { name: 'Search Emoji' });
    fireEvent.change(search, { target: { value: 'zzqqxx' } });
    expect(await screen.findByText('No emoji match')).toBeTruthy();
  });

  it('removes the icon at once, with an Undo that puts it back', () => {
    const { icon } = mount(<PageIconHead />, { iconId: 'rocket' });
    fireEvent.click(screen.getByRole('button', { name: 'Change Icon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(icon()).toBeUndefined();
    expect(track).toHaveBeenCalledWith('Element', 'Deleted', 'PageIcon');
    const [message, options] = toast.info.mock.calls[0]!;
    expect(message).toBe('Icon removed');
    act(() => options.action.onSelect());
    expect(icon()).toEqual({ iconId: 'rocket' });
  });

  it('opens on the Icons tab for a page whose icon is one', () => {
    mount(<PageIconHead />, { iconId: 'rocket' });
    fireEvent.click(screen.getByRole('button', { name: 'Change Icon' }));
    expect(screen.getByRole('button', { name: 'Icons', pressed: true })).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Search Icons' })).toBeTruthy();
  });

  it('leads with this browser’s Recent picks, each tab its own kind', async () => {
    window.localStorage.setItem(
      PAGE_ICON_RECENT_KEY,
      JSON.stringify(['e:🎯', 'i:rocket', 'x:bad']),
    );
    mount(<AddIconButton />, undefined);
    fireEvent.click(screen.getByRole('button', { name: /Add Icon/ }));
    const recent = await screen.findByRole('region', { name: 'Recent' });
    expect(recent.querySelectorAll('[data-icon-choice]')).toHaveLength(1);
    expect(recent.querySelector('[data-icon-choice="e:🎯"]')).toBeTruthy();
  });

  it('moves through the grid with the arrow keys', async () => {
    mount(<AddIconButton />, undefined);
    fireEvent.click(screen.getByRole('button', { name: /Add Icon/ }));
    const first = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-choice-at="0"]');
      expect(el).toBeTruthy();
      return el!;
    });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('data-choice-at')).toBe(String(PICKER_COLUMNS));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement?.getAttribute('data-choice-at')).toBe(String(PICKER_COLUMNS - 1));
  });
});

describe('gridStep', () => {
  it('steps a column or a row, and stops at the ends', () => {
    expect(gridStep('ArrowRight', 0, 20)).toBe(1);
    expect(gridStep('ArrowLeft', 0, 20)).toBe(0);
    expect(gridStep('ArrowDown', 3, 20)).toBe(3 + PICKER_COLUMNS);
    expect(gridStep('ArrowDown', 15, 20)).toBe(19);
    expect(gridStep('ArrowUp', 3, 20)).toBe(0);
    expect(gridStep('Home', 9, 20)).toBe(0);
    expect(gridStep('End', 0, 20)).toBe(19);
    expect(gridStep('a', 0, 20)).toBeNull();
    expect(gridStep('ArrowRight', 0, 0)).toBeNull();
  });
});

describe('the emoji list', () => {
  it('holds each emoji once, each a valid page emoji with a name', async () => {
    const { isPageEmoji } = await import('@liveknowledge/document');
    const all = EMOJI_GROUPS.flatMap((g) => g.emoji);
    expect(new Set(all.map((e) => e.emoji)).size).toBe(all.length);
    for (const e of all) {
      expect(isPageEmoji(e.emoji), e.emoji).toBe(true);
      expect(e.name.length, e.emoji).toBeGreaterThan(0);
    }
    expect(await loadEmojiCatalogue()).toBe(await loadEmojiCatalogue());
  });

  it('finds by name first, then by its words, every word of a query', () => {
    expect(searchEmoji('rocket')[0]?.emoji).toBe('🚀');
    expect(searchEmoji('book').map((e) => e.emoji)).toContain('📚');
    expect(searchEmoji('heart red')[0]?.emoji).toBe('❤️');
    expect(searchEmoji('  ')).toEqual([]);
  });
});

describe('Recent', () => {
  it('puts a pick first, once, and keeps the last few', () => {
    expect(withRecentIcon(['e:🎯', 'e:🚀'], { emoji: '🚀' })).toEqual(['e:🚀', 'e:🎯']);
    const many = Array.from({ length: 30 }, (_, i) => `i:icon-${i}`);
    expect(withRecentIcon(many, { emoji: '🚀' })).toHaveLength(PAGE_ICON_RECENT_MAX);
  });
});

describe('withTabIcon', () => {
  it('is the same tab when nothing changes', () => {
    const tab = { id: 'p', name: 'P', elements: [], icon: { emoji: '🚀' } } as Tab;
    expect(withTabIcon(tab, { emoji: '🚀' })).toBe(tab);
    const none = { id: 'p', name: 'P', elements: [] } as Tab;
    expect(withTabIcon(none, undefined)).toBe(none);
    expect('icon' in withTabIcon(tab, undefined)).toBe(false);
  });
});

describe('the icon in the tree and the breadcrumb', () => {
  const tabs = [
    { id: 'a', name: 'Handbook', icon: { emoji: '📚' } },
    { id: 'b', name: 'Deploys', parent: 'a', icon: { iconId: 'rocket' } },
    { id: 'c', name: 'Plain', parent: 'b' },
  ];

  it('rides each row as one plain key', () => {
    const rows = visiblePageRows(tabs, new Set(), 'c');
    expect(rows.map((r) => r.icon)).toEqual(['e:📚', 'i:rocket', null]);
  });

  it('names each ancestor with its icon', () => {
    const { container } = renderInEditor(
      <PageBreadcrumb />,
      chromeValue('view', { tabs, activeId: 'c' }),
    );
    const crumbs = [...container.querySelectorAll('[data-page-breadcrumb] a')];
    expect(crumbs.map((a) => a.textContent)).toEqual(['📚Handbook', 'Deploys']);
    expect(crumbs[1]!.querySelector('[data-page-icon-glyph="icon"]')).toBeTruthy();
  });
});
