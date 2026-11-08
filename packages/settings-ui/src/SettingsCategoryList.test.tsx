// @vitest-environment jsdom

// Sub-categories in the category list (each app's docs/specs/007-editor/user-preferences.md): Panels is an
// accordion over Layers, Activity and Map, collapsed until opened, and held open while one of them is
// the current pane or holds a search hit.

import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FOCUS_INSIDE, SettingsCategoryList } from './SettingsCategoryList';
import { fixtureCategories } from './test/fixture';
import { renderWithKit } from './test/kit';

const SETTINGS_CATEGORIES = fixtureCategories();

afterEach(cleanup);

function mount(
  selected: string | null,
  {
    matchCounts,
    variant = 'sidebar',
  }: { matchCounts?: Record<string, number>; variant?: 'sidebar' | 'root' } = {},
) {
  const onSelect = vi.fn();
  const ui = (sel: string | null) => (
    <SettingsCategoryList
      categories={SETTINGS_CATEGORIES.map((c) => ({ ...c, matchCount: matchCounts?.[c.id] ?? 0 }))}
      selected={sel}
      onSelect={onSelect}
      variant={variant}
      searching={matchCounts !== undefined}
    />
  );
  const view = renderWithKit(ui(selected));
  return { onSelect, reselect: (sel: string | null) => view.rerender(ui(sel)) };
}

const row = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const queryRow = (name: string) => screen.queryByRole('button', { name: new RegExp(`^${name}`) });
const disclosure = () => screen.getByRole('button', { name: /Panels sub-categories/ });

describe('SettingsCategoryList sub-categories', () => {
  it('starts with Panels collapsed', () => {
    mount('editor');
    expect(row('Panels').getAttribute('aria-expanded')).toBe('false');
    expect(queryRow('Layers')).toBeNull();
  });

  it('opens Panels and its sub-categories from the Panels row, in order', () => {
    const { onSelect } = mount('editor');
    fireEvent.click(row('Panels'));
    expect(onSelect).toHaveBeenCalledWith('panels');
    const labels = screen.getAllByRole('button').map((b) => b.textContent);
    const at = labels.indexOf('Panels');
    expect(labels.slice(at + 2, at + 5)).toEqual(['Layers', 'Map', 'Collaborate']);
  });

  it('folds away again on a second click, handing a sub-category’s selection back to Panels', () => {
    const { onSelect, reselect } = mount('editor');
    fireEvent.click(row('Panels'));
    reselect('map');
    onSelect.mockClear();
    fireEvent.click(row('Panels'));
    expect(onSelect).toHaveBeenCalledWith('panels');
    reselect('panels');
    expect(queryRow('Map')).toBeNull();
  });

  it('toggles with the disclosure chevron without changing the pane', () => {
    const { onSelect } = mount('editor');
    fireEvent.click(disclosure());
    expect(queryRow('Layers')).not.toBeNull();
    fireEvent.click(disclosure());
    expect(queryRow('Layers')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('is held open while a sub-category is the current pane, marking only that one current', () => {
    mount('map');
    expect(row('Map').getAttribute('aria-current')).toBe('page');
    expect(row('Panels').getAttribute('aria-current')).toBeNull();
    expect((disclosure() as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens for a search hit inside it, and keeps Panels reachable on the way down', () => {
    mount('editor', { matchCounts: { map: 2 } });
    expect(row('Map').textContent).toBe('Map2');
    expect((row('Layers') as HTMLButtonElement).disabled).toBe(true);
    expect((row('Panels') as HTMLButtonElement).disabled).toBe(false);
  });

  it('pushes the Panels pane from its row on a phone, with no accordion to work', () => {
    const { onSelect } = mount(null, { variant: 'root' });
    expect(screen.queryByRole('button', { name: /Panels sub-categories/ })).toBeNull();
    fireEvent.click(row('Panels'));
    expect(onSelect).toHaveBeenCalledWith('panels');
    expect(queryRow('Layers')).toBeNull();
  });

  it('shows a sub-category search hit beneath Panels on a phone', () => {
    const { onSelect } = mount(null, { variant: 'root', matchCounts: { layers: 1 } });
    fireEvent.click(row('Layers'));
    expect(onSelect).toHaveBeenLastCalledWith('layers');
  });
});

describe('the panel’s label headings', () => {
  // The account's categories, the apps' merged ones and the developers', as the panel hands them in.
  const categories = [
    { id: 'account:account', label: 'Profile', group: 'account', rows: [] },
    { id: 'account:privacy', label: 'Privacy', group: 'account', rows: [] },
    { id: 'apps:editor', label: 'Editor', group: 'apps', rows: [] },
    { id: 'account:tokens', label: 'API Tokens', group: 'developers', rows: [] },
  ] as unknown as Parameters<typeof SettingsCategoryList>[0]['categories'];
  const groups = [
    { id: 'account', label: 'Account' },
    { id: 'apps', label: 'Apps' },
    { id: 'developers', label: 'Developers' },
    { id: 'empty', label: 'Empty' },
  ];
  const ui = (variant: 'root' | 'sidebar', searching = false) => (
    <SettingsCategoryList
      categories={categories}
      groups={groups}
      selected={null}
      onSelect={() => {}}
      variant={variant}
      searching={searching}
    />
  );

  it.each(['root', 'sidebar'] as const)(
    'lists every %s category under its plain label, every one always shown',
    (variant) => {
      renderWithKit(ui(variant));
      const rail = screen.getByRole('navigation', { name: 'Settings categories' });
      // Labels, not buttons: nothing to fold, and a heading with no category is left out.
      expect([...rail.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
        'Account',
        'Apps',
        'Developers',
      ]);
      const buttons = screen.getAllByRole('button');
      expect(buttons.map((b) => b.textContent)).toEqual([
        'Profile',
        'Privacy',
        'Editor',
        'API Tokens',
      ]);
      for (const b of buttons) expect(b.getAttribute('aria-expanded')).toBeNull();
      const account = screen.getByRole('group', { name: 'Account' });
      expect(account.querySelectorAll('button')).toHaveLength(2);
      expect(screen.getByRole('group', { name: 'Developers' }).textContent).toContain('API Tokens');
    },
  );

  it('keeps every heading and row while searching', () => {
    renderWithKit(ui('sidebar', true));
    expect(screen.getAllByRole('group')).toHaveLength(3);
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });
});

describe('focus rings on the phone and in the sidebar', () => {
  // The phone's card clips at its rounded edge, and a parent row's disclosure sits beside it.
  it.each(['root', 'sidebar'] as const)('keeps every %s ring inside its row', (variant) => {
    mount('editor', { variant });
    for (const b of screen.getAllByRole('button'))
      expect(b.className.split(' ')).toContain(FOCUS_INSIDE);
  });
});
