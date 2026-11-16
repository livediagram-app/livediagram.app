// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { StickerDef } from '@liveworkspace/icons';
import type { IconDef } from '../../lib/icon-types';
import type { CategoryBrowserProps } from './category-browser-types';
import {
  createIconsCategoryTab,
  ICONS_SIDE_KEY,
  openedPaletteCategory,
  setIconsSide,
} from './IconsCategoryTab';

// docs/specs/008-canvas/canvas-and-palette.md "Icons category": the icons and the stickers in one category, a switch
// beside its search picking which it browses, and one search over both in two labelled groups.

const icon = (id: string): IconDef => ({ id, label: id, keywords: '', prims: [] });
const sticker = (id: string): StickerDef => ({
  id,
  label: id,
  keywords: '',
  kind: 'emoji',
  glyph: '★',
});

// A browse that shows what it was handed: its root and rail name, its accessory, and the items it would render (the
// search's hits while searching, else the first group's).
function FakeBrowser<T>(props: CategoryBrowserProps<T>) {
  const q = props.query.trim();
  const items = q ? props.search(q) : (props.categories[0]?.items ?? []);
  return (
    <div
      data-root={props.root}
      data-things={props.things}
      data-telemetry={props.telemetry.openedType}
    >
      <input
        placeholder={props.searchInput.placeholder}
        value={props.query}
        onChange={(e) => props.onQueryChange(e.target.value)}
      />
      {props.searchAccessory}
      <div data-items="">{props.renderItems(items)}</div>
    </div>
  );
}

const { IconsCategoryTab } = createIconsCategoryTab({
  PaletteCategoryBrowser: FakeBrowser,
  IconGrid: ({ icons, bounded = true }) => (
    <ul data-grid="icons" data-bounded={String(bounded)}>
      {icons.map((i) => (
        <li key={i.id}>{i.id}</li>
      ))}
    </ul>
  ),
  StickerGrid: ({ stickers, bounded = true }) => (
    <ul data-grid="stickers" data-bounded={String(bounded)}>
      {stickers.map((s) => (
        <li key={s.id}>{s.id}</li>
      ))}
    </ul>
  ),
  iconBrowseGroups: () => [{ id: 'ui', label: 'UI', icon: null, items: [icon('gear')] }],
  stickerBrowseGroups: () => [
    { id: 'reactions', label: 'Reactions', icon: null, items: [sticker('thumbs')] },
  ],
});

function show(
  over: { query?: string; stickers?: boolean; icons?: IconDef[]; found?: StickerDef[] } = {},
) {
  const setQuery = vi.fn();
  const view = render(
    <IconsCategoryTab
      addIcon={vi.fn()}
      addSticker={vi.fn()}
      query={over.query ?? ''}
      setQuery={setQuery}
      iconResults={over.icons ?? []}
      stickerResults={over.found ?? []}
      stickers={over.stickers ?? true}
    />,
  );
  const root = () => view.container.firstElementChild as HTMLElement;
  return { setQuery, root };
}

afterEach(() => {
  cleanup();
  act(() => setIconsSide('icons'));
  window.localStorage.clear();
});

describe('the Icons category', () => {
  it('opens on Icons, with a switch to its Stickers side that it remembers', () => {
    const { root } = show();
    const browse = within(screen.getByRole('group', { name: 'Browse' }));
    expect(browse.getByRole('button', { name: 'Icons' }).getAttribute('aria-pressed')).toBe('true');
    expect(root().dataset.root).toBe('Icons');
    expect(root().dataset.things).toBe('icons');
    expect(screen.getByText('gear')).toBeTruthy();
    fireEvent.click(browse.getByRole('button', { name: 'Stickers' }));
    expect(root().dataset.root).toBe('Stickers');
    // The rail is named for the side, as the tours find it ("stickers groups").
    expect(root().dataset.things).toBe('stickers');
    expect(root().dataset.telemetry).toBe('StickerGroup');
    expect(screen.getByText('thumbs')).toBeTruthy();
    expect(window.localStorage.getItem(ICONS_SIDE_KEY)).toBe('stickers');
  });

  it('searches both, in two labelled groups, Icons first, leaving out a group with no match', () => {
    show({ query: 'heart', icons: [icon('heart')], found: [sticker('red-heart')] });
    expect(screen.getByPlaceholderText('Search icons and stickers')).toBeTruthy();
    const groups = screen.getAllByRole('region');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Icons', 'Stickers']);
    // The pane scrolls the results, so neither group holds a scroller of its own.
    expect(within(groups[0]!).getByRole('list').dataset.bounded).toBe('false');
    expect(within(groups[1]!).getByText('red-heart')).toBeTruthy();
    cleanup();
    show({ query: 'heart', found: [sticker('red-heart')] });
    expect(screen.getAllByRole('region').map((g) => g.getAttribute('aria-label'))).toEqual([
      'Stickers',
    ]);
  });

  it('says a miss covers both catalogues', () => {
    const { root } = show({ query: 'zzz' });
    expect(root().dataset.things).toBe('icons or stickers');
  });

  it('shows the icons alone, with no switch, where the palette offers no stickers', () => {
    act(() => setIconsSide('stickers'));
    const { root } = show({
      stickers: false,
      query: 'heart',
      icons: [icon('heart')],
      found: [sticker('x')],
    });
    expect(screen.queryByRole('group', { name: 'Browse' })).toBeNull();
    expect(root().dataset.root).toBe('Icons');
    expect(screen.getByPlaceholderText('Search icons')).toBeTruthy();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByText('heart')).toBeTruthy();
    expect(screen.queryByText('x')).toBeNull();
  });
});

describe('openedPaletteCategory', () => {
  it('opens Icons on its Stickers side for a request for Stickers, and passes any other id through', () => {
    expect(openedPaletteCategory('shapes')).toBe('shapes');
    expect(window.localStorage.getItem(ICONS_SIDE_KEY)).toBeNull();
    act(() => {
      expect(openedPaletteCategory('stickers')).toBe('icons');
    });
    expect(window.localStorage.getItem(ICONS_SIDE_KEY)).toBe('stickers');
  });
});
