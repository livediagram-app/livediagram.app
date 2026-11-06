// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogueGroupTile } from './catalogue-strip-groups';
import { BrowseStartGroup, PaletteCategoryBrowser } from './PaletteCategoryBrowser';

// docs/specs/007-editor/toolbar-layout.md: a group tile toggles its popover, and the browse opens on a group.

describe('CatalogueGroupTile', () => {
  it('toggles from its own tile, marked as the popover’s button', () => {
    const onToggle = vi.fn();
    render(
      <CatalogueGroupTile
        group={{ id: 'g', label: 'People', icon: null }}
        open
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'People' }));
    const anchor = onToggle.mock.calls[0]![0] as HTMLElement;
    expect(anchor.hasAttribute('data-toolbar-more-button')).toBe(true);
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

  it('shows the group alone, without search or breadcrumb, when bare (a strip group’s popover)', () => {
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
