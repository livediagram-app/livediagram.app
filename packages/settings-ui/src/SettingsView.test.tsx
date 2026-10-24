// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { SettingsCategory, SettingsRow } from './model';
import { SettingsView } from './SettingsView';
import { fixtureCategories } from './test/fixture';
import { renderWithKit, TEST_KIT } from './test/kit';

function view(
  props: Partial<Parameters<typeof SettingsView>[0]> & { categories?: SettingsCategory[] } = {},
) {
  const onClose = vi.fn();
  const result = renderWithKit(
    <SettingsView
      categories={props.categories ?? fixtureCategories()}
      isMobile={props.isMobile ?? false}
      onClose={onClose}
      {...props}
    />,
  );
  return { ...result, onClose };
}

const pane = () => document.querySelector<HTMLElement>('[data-settings-pane]')!;

describe('SettingsView on desktop', () => {
  it('shows the rail and the first category beside it, its sections headed', () => {
    view();
    expect(screen.getByRole('navigation', { name: 'Settings categories' })).toBeTruthy();
    expect(within(pane()).getByText('Canvas')).toBeTruthy();
    expect(within(pane()).getByRole('switch', { name: 'Alignment Guides' })).toBeTruthy();
  });

  it('opens a category from the rail and reports it', () => {
    const onCategoryOpened = vi.fn();
    view({ onCategoryOpened });
    fireEvent.click(screen.getByRole('button', { name: /^Privacy/ }));
    expect(within(pane()).getByRole('switch', { name: 'Usage Data' })).toBeTruthy();
    expect(onCategoryOpened).toHaveBeenCalledWith('privacy');
  });

  it('follows the search to the first category with a match, and says when nothing matches', () => {
    view();
    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'usage' } });
    expect(within(pane()).getByRole('switch', { name: 'Usage Data' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'zzzz' } });
    expect(screen.getByText(/No settings match zzzz/)).toBeTruthy();
  });

  it('finds a row by its keywords', () => {
    view();
    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'snap' } });
    expect(
      within(pane())
        .getAllByRole('switch')
        .map((s) => s.getAttribute('aria-labelledby')),
    ).toEqual(['alignmentGuides-label']);
  });

  it('flips a switch through its row, and closes', () => {
    const categories = fixtureCategories();
    const { onClose } = view({ categories });
    fireEvent.click(within(pane()).getByRole('switch', { name: 'Alignment Guides' }));
    const row = categories[0]!.rows[0] as Extract<SettingsRow, { kind: 'toggle' }>;
    expect(row.onChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('nests a row under its parent as a named group', () => {
    const categories = fixtureCategories({
      privacy: [
        {
          kind: 'toggle',
          key: 'pum',
          label: 'Power User Mode',
          description: '',
          value: true,
          onChange: vi.fn(),
        },
        {
          kind: 'toggle',
          key: 'mini',
          label: 'Minimal Chrome',
          description: '',
          parent: 'pum',
          value: false,
          onChange: vi.fn(),
        },
      ],
    });
    view({ categories, initialCategoryId: 'privacy' });
    const group = screen.getByRole('group', { name: 'Power User Mode settings' });
    expect(within(group).getByRole('switch', { name: 'Minimal Chrome' })).toBeTruthy();
  });

  it('draws a closed section with its switch count, opening on its heading', () => {
    const categories = fixtureCategories();
    categories[0] = { ...categories[0]!, collapsedSections: ['Mouse'] };
    view({ categories });
    const heading = screen.getByRole('button', { name: /Mouse/ });
    expect(heading.getAttribute('aria-expanded')).toBe('false');
    expect(heading.textContent).toContain('0 of 1 On');
    fireEvent.click(heading);
    expect(heading.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows a placeholder in place of the rail and pane', () => {
    view({ placeholder: <p>Loading</p>, title: 'livediagram Settings' });
    expect(screen.getByText('Loading')).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByRole('heading', { name: 'livediagram Settings' })).toBeTruthy();
  });
});

describe('SettingsView on a phone', () => {
  it('starts on the root list, pushes a pane with a back bar, and goes back', () => {
    view({ isMobile: true });
    expect(document.querySelector('[data-settings-pane]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Editor/ }));
    expect(screen.getByRole('heading', { name: 'Editor' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(document.querySelector('[data-settings-pane]')).toBeNull();
  });

  it('keeps a desktop-only row visible but inert, with its note', () => {
    view({ isMobile: true, initialCategoryId: 'editor' });
    const quickAdd = screen.getByRole('switch', {
      name: 'Quick-Add on Hover',
    }) as HTMLButtonElement;
    expect(quickAdd.disabled).toBe(true);
    expect(screen.getByRole('note').textContent).toContain('Desktop only.');
  });

  it('lists a parent’s sub-categories at the foot of its pane', () => {
    view({ isMobile: true, initialCategoryId: 'panels' });
    const links = screen.getByRole('navigation', { name: 'Panels sub-categories' });
    fireEvent.click(within(links).getByRole('button', { name: /^Map/ }));
    expect(screen.getByRole('heading', { name: 'Map' })).toBeTruthy();
    // A sub-category's back bar goes back to its parent.
    expect(screen.getByRole('button', { name: 'Panels' })).toBeTruthy();
  });
});

describe('SettingsView renders', () => {
  // The rows are memoised on the row object: typing in search or moving a slider must not re-render
  // every row (the owner's performance rule for this dialog).
  it('does not re-render the pane’s rows per search keystroke', () => {
    let customRenders = 0;
    const counted: SettingsRow = {
      kind: 'custom',
      key: 'counted',
      label: 'Counted Row',
      description: 'A row that counts its renders.',
      render: () => {
        customRenders += 1;
        return <p>Counted Row</p>;
      },
    };
    const categories = fixtureCategories({ editor: [counted] });
    view({ categories });
    const before = customRenders;
    const search = screen.getByLabelText('Search settings');
    // Single characters don't search yet; the pane keeps the same rows.
    fireEvent.change(search, { target: { value: 'c' } });
    fireEvent.change(search, { target: { value: 'co' } });
    fireEvent.change(search, { target: { value: 'cou' } });
    expect(customRenders).toBe(before);
  });

  it('moves a slider without re-rendering its neighbours, and commits once on release', () => {
    let renders = 0;
    const onCommit = vi.fn();
    const neighbour: SettingsRow = {
      kind: 'custom',
      key: 'neighbour',
      label: 'Neighbour',
      description: '',
      render: () => {
        renders += 1;
        return <p>Neighbour</p>;
      },
    };
    const slider: SettingsRow = {
      kind: 'slider',
      key: 'panelOpacity',
      label: 'Panel Opacity',
      description: 'How see-through panels are.',
      min: 0.5,
      max: 1,
      step: 0.05,
      format: (v) => `${Math.round(v * 100)}%`,
      value: 1,
      onCommit,
    };
    view({ categories: fixtureCategories({ editor: [slider, neighbour] }) });
    const before = renders;
    const range = screen.getByRole('slider', { name: 'Panel Opacity' });
    for (const value of ['0.95', '0.9', '0.85', '0.8'])
      fireEvent.change(range, { target: { value } });
    expect(onCommit).not.toHaveBeenCalled();
    expect(renders).toBe(before);
    fireEvent.pointerUp(range);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(0.8);
  });

  it('a change re-renders only the row whose object changed', () => {
    const counts: Record<string, number> = {};
    const custom = (key: string): SettingsRow => ({
      kind: 'custom',
      key,
      label: key,
      description: '',
      render: () => {
        counts[key] = (counts[key] ?? 0) + 1;
        return <p>{key}</p>;
      },
    });
    const a = custom('a');
    function Host() {
      const [b, setB] = useState(() => custom('b'));
      return (
        <>
          <button type="button" onClick={() => setB(custom('b'))}>
            bump
          </button>
          <SettingsView
            categories={[{ id: 'one', label: 'One', rows: [a, b] }]}
            isMobile={false}
            onClose={() => {}}
          />
        </>
      );
    }
    renderWithKit(<Host />, TEST_KIT);
    const before = { ...counts };
    act(() => screen.getByRole('button', { name: 'bump' }).click());
    expect(counts.a).toBe(before.a);
    expect(counts.b).toBe((before.b ?? 0) + 1);
  });
});
