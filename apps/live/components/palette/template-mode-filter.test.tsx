// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  POPULAR_TEMPLATE_KINDS,
  TEMPLATES,
  templateCategory,
  templateEditorMode,
  type TemplateCategory,
  type TemplateKind,
} from '@livediagram/templates';
import { setIllustrateModeEnabled } from '@/lib/offered-editor-modes';
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
  const matches = query ? listed.filter((t) => t.title.toLowerCase().includes(query)) : [];
  return (
    <>
      <output data-testid="selected">{kind}</output>
      <TemplatePickerBrowse
        showIdentity={false}
        templateQuery={query}
        setTemplateQuery={() => {}}
        templateFilter={query}
        filteredTemplates={matches}
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

const choose = (name: string) => fireEvent.click(screen.getByRole('radio', { name }));
const stage = () => screen.getAllByRole('heading', { level: 3 })[0]!.closest('section') ?? document;
const tiles = () => screen.queryAllByRole('button', { name: /^Browse .* templates$/ });
const cardModes = () =>
  screen.getAllByRole('img', { name: /^Opens in / }).map((el) => el.getAttribute('aria-label'));

afterEach(() => {
  act(() => setIllustrateModeEnabled(true));
  trackMock.mockClear();
});

describe('the mode filter', () => {
  it('offers All, Diagram, Draw and Illustrate, All chosen', () => {
    render(<Step />);
    const group = screen.getByRole('radiogroup', { name: 'Show templates for' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['All', 'Diagram', 'Draw', 'Illustrate']);
    expect(screen.getByRole('radio', { name: 'All' }).getAttribute('aria-checked')).toBe('true');
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
    for (const tile of tiles()) expect(tile.textContent).toMatch(/1$/);
    expect(trackMock).toHaveBeenCalledWith('UI', 'Toggled', 'TemplateModeDraw');
  });

  it("moves a filtered-away selection to the mode's blank", () => {
    render(<Step />);
    choose('Illustrate');
    expect(screen.getByTestId('selected').textContent).toBe('blank-illustration');
    choose('Draw');
    expect(screen.getByTestId('selected').textContent).toBe('whiteboard');
    choose('All');
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

  it('moves with the arrow keys', () => {
    render(<Step />);
    const group = screen.getByRole('radiogroup', { name: 'Show templates for' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Diagram' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: 'Illustrate' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('offers no Illustrate option, and shows no Illustrate template, when Illustrate is off', () => {
    act(() => setIllustrateModeEnabled(false));
    render(<Step />);
    expect(screen.queryByRole('radio', { name: 'Illustrate' })).toBeNull();
    expect(cardModes()).not.toContain('Opens in Illustrate');
    expect(screen.queryByText('Blank Illustration')).toBeNull();
  });
});

describe('the mode on a card', () => {
  it('names the mode every card opens in', () => {
    render(<Step />);
    expect(cardModes().slice(0, 3)).toEqual([
      'Opens in Diagram',
      'Opens in Draw',
      'Opens in Illustrate',
    ]);
    expect(stage()).toBeTruthy();
  });
});
