// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureIconCatalogs } from '@/lib/icon-registry';
import { ICON_CATEGORIES } from '@/lib/icons';
import { STICKER_CATEGORIES } from '@/lib/stickers';
import { catalogueStripGroups } from './catalogue-strip-groups';
import { BrowseStartGroup, PaletteCategoryBrowser } from './PaletteCategoryBrowser';

// Icons, Stickers and Technology's browse groups, which an opener for one group (palette-openers) wears and opens
// alone (docs/specs/007-editor/toolbar-layout.md "A tile's side panel").

beforeAll(() => ensureIconCatalogs());

describe('catalogueStripGroups', () => {
  it('is the browse groups for the three catalogues, in their order', () => {
    expect(catalogueStripGroups('icons')?.map((g) => g.id)).toEqual(
      ICON_CATEGORIES.map((c) => c.id),
    );
    expect(catalogueStripGroups('stickers')?.map((g) => g.id)).toEqual(
      STICKER_CATEGORIES.map((c) => c.id),
    );
    expect(catalogueStripGroups('technology')?.length).toBeGreaterThan(0);
  });

  it('is built once the catalogues have loaded, not on every render', () => {
    expect(catalogueStripGroups('technology')).toBe(catalogueStripGroups('technology'));
    const t = performance.now();
    for (let i = 0; i < 1000; i++) catalogueStripGroups('icons');
    expect(performance.now() - t).toBeLessThan(50);
  });

  it('is null for a category of tiles', () => {
    expect(catalogueStripGroups('shapes')).toBeNull();
  });
});

describe('BrowseStartGroup', () => {
  const browse = (
    <PaletteCategoryBrowser
      root="Things"
      categories={[
        { id: 'a', label: 'Alpha', icon: null, items: ['one'] },
        { id: 'b', label: 'Beta', icon: null, items: ['two'] },
      ]}
      search={() => []}
      renderItems={(items) => <p>{items.join(',')}</p>}
      query=""
      onQueryChange={() => {}}
      searchInput={{
        placeholder: 'Search',
        ariaLabel: 'Search',
        clearAriaLabel: 'Clear',
        clearDescription: 'Clear',
      }}
      telemetry={{ openedType: 'T', searchedType: 'S' }}
      things="things"
    />
  );

  it('opens the browse on the group it names', () => {
    render(
      <BrowseStartGroup.Provider value={{ id: 'b', bare: false }}>
        {browse}
      </BrowseStartGroup.Provider>,
    );
    expect(screen.getByText('two')).toBeTruthy();
    expect(screen.queryByText('one')).toBeNull();
    expect(screen.getByLabelText('Search')).toBeTruthy();
  });

  it('shows the group alone, without search or breadcrumb, when bare (an opener’s side panel)', () => {
    const { container } = render(
      <BrowseStartGroup.Provider value={{ id: 'b', bare: true }}>
        {browse}
      </BrowseStartGroup.Provider>,
    );
    expect(container.textContent).toBe('two');
  });

  it('opens the group grid without one', () => {
    render(browse);
    expect(screen.queryByText('two')).toBeNull();
  });
});
