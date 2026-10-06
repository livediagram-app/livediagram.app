// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  POPULAR_TEMPLATE_KINDS,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  templateCategory,
  templateEditorMode,
  type TemplateCategory,
  type TemplateKind,
} from '@livediagram/templates';
import { TemplatePickerBrowse, type ShelfCategory } from './TemplatePickerBrowse';
import { useTemplateModeFilter } from './useTemplateModeFilter';

const trackMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track: trackMock }));

// The template step's mode filter and the mode glyph on every card
// (docs/specs/007-editor/templates-by-mode.md).

globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.scrollTo ??= () => {};

// The picker's composition (TemplatePicker): every list narrowed by the filter before the browse.
function Step({ initial = null, query = '' }: { initial?: ShelfCategory | null; query?: string }) {
  const [open, setOpen] = useState<ShelfCategory | null>(initial);
  const [kind, setKind] = useState<TemplateKind>('blank');
  const filter = useTemplateModeFilter({ selected: kind, onSelect: setKind });
  const listed = TEMPLATES.filter(filter.shows);
  const popular = POPULAR_TEMPLATE_KINDS.flatMap((k) => listed.filter((t) => t.kind === k));
  const inCategory = (c: TemplateCategory) =>
    listed.filter((t) => t.kind !== 'blank' && templateCategory(t.kind) === c);
  const matching = (t: (typeof TEMPLATES)[number]) => t.title.toLowerCase().includes(query);
  const matches = query ? listed.filter(matching) : [];
  const everywhere = query ? TEMPLATES.filter(matching).length : 0;
  return (
    <>
      <output data-testid="selected">{kind}</output>
      <TemplatePickerBrowse
        showIdentity={false}
        templateQuery={query}
        setTemplateQuery={() => {}}
        templateFilter={query}
        filteredTemplates={matches}
        matchesInEveryMode={matches.length === 0 && filter.choice !== 'all' ? everywhere : 0}
        openCategory={open}
        setOpenCategory={setOpen}
        shelfExpanded={false}
        setShelfExpanded={() => {}}
        popularTemplates={popular}
        categoryTemplates={inCategory}
        templateKind={kind}
        onTemplateCommit={setKind}
        modeFilter={filter}
      />
    </>
  );
}

const chip = () => screen.getByRole('button', { name: /^Show templates for:/ });
const choose = (name: string) => {
  fireEvent.click(chip());
  fireEvent.click(screen.getByRole('menuitemradio', { name: new RegExp(`^${name}`) }));
};
const stage = () => screen.getAllByRole('heading', { level: 3 })[0]!.closest('section') ?? document;
const tiles = () => screen.queryAllByRole('button', { name: /^Browse .* templates$/ });
const cardModes = () =>
  Array.from(document.querySelectorAll('[data-template-mode]')).map(
    (el) =>
      `Opens in ${el.getAttribute('data-template-mode')![0]!.toUpperCase()}${el.getAttribute('data-template-mode')!.slice(1)}`,
  );

afterEach(() => {
  trackMock.mockClear();
});

describe('the mode filter', () => {
  it('offers Everything, Diagram, Draw, Illustrate and Plan, Everything chosen, with their counts', () => {
    render(<Step />);
    expect(chip().getAttribute('aria-label')).toBe('Show templates for: Everything');
    fireEvent.click(chip());
    const rows = screen.getAllByRole('menuitemradio');
    expect(rows.map((r) => r.textContent?.replace(/\d+/g, ''))).toEqual([
      'Everything',
      'Diagram',
      'Draw',
      'Illustrate',
      'Plan',
    ]);
    expect(rows[0]!.getAttribute('aria-checked')).toBe('true');
    const draw = TEMPLATES.filter((t) => templateEditorMode(t.kind) === 'draw').length;
    expect(rows[2]!.textContent).toBe(`Draw${draw}`);
  });

  it('narrows Popular, the category tiles and their counts to the chosen mode', () => {
    render(<Step />);
    choose('Draw');
    expect(cardModes().every((m) => m === 'Opens in Draw')).toBe(true);
    const drawCategories = new Set(
      TEMPLATES.filter((t) => templateEditorMode(t.kind) === 'draw' && t.kind !== 'whiteboard').map(
        (t) => templateCategory(t.kind),
      ),
    );
    expect(tiles()).toHaveLength(drawCategories.size);
    for (const tile of tiles()) {
      const category = [...drawCategories].find((c) =>
        tile
          .getAttribute('aria-label')!
          .includes(TEMPLATE_CATEGORIES.find((x) => x.id === c)!.label),
      )!;
      const inCategory = TEMPLATES.filter(
        (t) =>
          templateEditorMode(t.kind) === 'draw' &&
          t.kind !== 'whiteboard' &&
          templateCategory(t.kind) === category,
      ).length;
      expect(tile.textContent).toMatch(new RegExp(`${inCategory}$`));
    }
    expect(trackMock).toHaveBeenCalledWith('UI', 'Toggled', 'TemplateModeDraw');
  });

  it("moves a filtered-away selection to the mode's blank", () => {
    render(<Step />);
    choose('Illustrate');
    expect(screen.getByTestId('selected').textContent).toBe('blank-illustration');
    choose('Draw');
    expect(screen.getByTestId('selected').textContent).toBe('whiteboard');
    choose('Everything');
    expect(screen.getByTestId('selected').textContent).toBe('whiteboard');
  });

  it('opens Popular when the open shelf has none of the mode', () => {
    render(<Step initial="technical" />);
    expect(screen.getAllByRole('heading', { level: 3 })[0]!.textContent).toContain('Technical');
    choose('Illustrate');
    expect(screen.getAllByRole('heading', { level: 3 })[0]!.textContent).toContain('Popular');
  });

  it('names the mode when a search finds nothing', () => {
    render(<Step query="zzz" />);
    choose('Draw');
    expect(screen.getByText(/No Draw/).textContent).toContain('templates match');
  });

  it('offers Everything when a search finds nothing in the mode but does elsewhere', () => {
    render(<Step query="mind" />);
    choose('Draw');
    const offer = screen.getByRole('button', { name: /in Everything$/ });
    fireEvent.click(offer);
    expect(chip().getAttribute('aria-label')).toBe('Show templates for: Everything');
    expect(screen.queryByText(/templates match/)).toBeNull();
  });

  it('stays open when a pointer arrives and presses in one moment', () => {
    render(<Step />);
    const root = chip().parentElement!;
    // Both in one batch, as when the open has not rendered before the press lands.
    act(() => {
      fireEvent.pointerEnter(root, { pointerType: 'mouse' });
      fireEvent.click(chip());
    });
    expect(screen.getByRole('menu', { name: 'Show templates for' })).toBeTruthy();
  });

  it('opens on a mouse hover without taking focus, and closes once the pointer leaves', () => {
    vi.useFakeTimers();
    try {
      render(<Step />);
      const root = chip().parentElement!;
      fireEvent.pointerEnter(root, { pointerType: 'mouse' });
      expect(screen.getByRole('menu', { name: 'Show templates for' })).toBeTruthy();
      expect(document.activeElement).not.toBe(screen.getAllByRole('menuitemradio')[0]);
      fireEvent.pointerLeave(root, { pointerType: 'mouse' });
      act(() => vi.advanceTimersByTime(250));
      expect(screen.queryByRole('menu', { name: 'Show templates for' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the mode on a card', () => {
  it('names the mode every card opens in, after its title', () => {
    render(<Step />);
    expect(screen.getAllByRole('button', { pressed: true })[0]!.textContent).toMatch(
      /^Blank Diagram, Opens in Diagram/,
    );
    expect(cardModes().slice(0, 3)).toEqual([
      'Opens in Diagram',
      'Opens in Draw',
      'Opens in Illustrate',
    ]);
    expect(stage()).toBeTruthy();
  });
});
