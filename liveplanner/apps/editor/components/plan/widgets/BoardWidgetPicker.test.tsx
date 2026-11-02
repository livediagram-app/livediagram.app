// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BOARD_WIDGET_KINDS,
  boardFields,
  fieldWidgetKey,
  presetSetup,
  type BoardWidgetId,
  type CustomFieldDef,
  type ItemTypeDef,
} from '@liveplanner/items';
import type { WidgetSuggestion } from '@liveplanner/plan-art';
import { planPalette } from '../plan-palette';
import { BoardWidgetPicker } from './BoardWidgetPicker';
import { FIELD_CAP_HINT } from './WidgetGalleryTile';
import { gallerySections, sectionSize, WIDGET_GROUPS } from './widget-gallery-model';

// docs/specs/026-plan/board-widgets.md "The widget gallery".
afterEach(cleanup);

const budget = { id: 'f-budget', label: 'Budget', kind: 'currency' } as CustomFieldDef;
const severity = {
  id: 'f-sev',
  label: 'Severity',
  kind: 'choice',
  options: ['High', 'Low'],
} as CustomFieldDef;
const type = (id: string, label: string, custom: CustomFieldDef[]): ItemTypeDef => ({
  id,
  label,
  newTitle: 'New',
  glyph: 'task',
  color: '#7c3aed',
  fields: ['title', ...custom.map((c) => c.id)],
  custom,
});
const types = [type('feature', 'Feature', [budget, severity]), type('bug', 'Bug', [severity])];
const fields = boardFields({ ...presetSetup('kanban'), addTypes: ['feature', 'bug'] }, types);
const suggestions: WidgetSuggestion[] = [
  { id: 'field:sum:f-budget', score: 2, reason: 'Every Feature card has a Budget' },
  { id: 'progress', score: 0.9, reason: 'This board has a done column' },
];

function show(
  over: {
    widgets?: BoardWidgetId[];
    fields?: typeof fields;
    suggestions?: WidgetSuggestion[];
    render?: (id: BoardWidgetId) => React.ReactNode;
  } = {},
) {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  const onToggle = vi.fn();
  const onClose = vi.fn();
  const props = {
    anchor,
    widgets: over.widgets ?? [],
    fields: over.fields ?? fields,
    suggestions: over.suggestions ?? suggestions,
    onToggle,
    onClose,
    render: over.render ?? ((id: BoardWidgetId) => <span data-preview={id}>{id}</span>),
    palette: planPalette('light', {}),
  };
  const view = render(<BoardWidgetPicker {...props} />);
  const rerender = (widgets: BoardWidgetId[]) =>
    view.rerender(<BoardWidgetPicker {...props} widgets={widgets} />);
  return { onToggle, onClose, rerender };
}
const rail = () => screen.getByRole('navigation', { name: 'Widget sections' });
const section = (key: string) =>
  document.querySelector<HTMLElement>(`[data-gallery-section="${key}"]`);

describe('BoardWidgetPicker', () => {
  it('lists For You, the built-in groups and each card type’s fields, in the rail and the list', () => {
    show();
    const entries = [...rail().querySelectorAll('[data-rail-entry]')].map((e) =>
      e.getAttribute('data-rail-entry'),
    );
    expect(entries).toEqual(['for-you', ...WIDGET_GROUPS.map((g) => g.key), 'type:feature']);
    expect(within(rail()).getByText('Fields')).toBeTruthy();
    // For You names the whole widget and says why.
    expect(within(section('for-you')!).getByText('Budget Sum')).toBeTruthy();
    expect(screen.getByText('Every Feature card has a Budget')).toBeTruthy();
    // Severity sits under Feature, the first type offering it, and says it is on Bug cards too.
    const feature = section('type:feature')!;
    expect(within(feature).getByText('Feature Fields')).toBeTruthy();
    expect(within(feature).getByText('Also on Bug cards')).toBeTruthy();
    expect(within(feature).getByText('Choice')).toBeTruthy();
    // Previews draw (no IntersectionObserver here, so every tile counts as seen).
    expect(document.querySelector('[data-preview="field:sum:f-budget"]')).toBeTruthy();
  });

  it('adds a widget, says so, and shows the board’s own On Board; a press takes one off', () => {
    const { onToggle, rerender } = show();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Budget Sum' })[0]!);
    expect(onToggle).toHaveBeenCalledWith('field:sum:f-budget');
    expect(screen.getByText('Budget Sum added')).toBeTruthy();
    rerender(['field:sum:f-budget']);
    const on = screen.getAllByRole('button', { name: 'Remove Budget Sum' });
    expect(on).toHaveLength(2);
    expect(on[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByText('On Board')).toHaveLength(2);
    fireEvent.click(on[0]!);
    expect(screen.getByText('Budget Sum taken off the board')).toBeTruthy();
  });

  it('keeps For You as it was when the gallery opened', () => {
    const { rerender } = show();
    rerender(['progress']);
    expect(
      within(section('for-you')!).getByRole('button', { name: 'Remove Completion' }),
    ).toBeTruthy();
  });

  it('holds back field widgets past the cap, saying why, but still takes one off', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => fieldWidgetKey(`f-x${i}`, 'sum'));
    const { onToggle } = show({ widgets: twelve });
    const capped = screen.getAllByRole('button', { name: `Add Budget Sum: ${FIELD_CAP_HINT}` })[0]!;
    expect(capped.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(capped);
    expect(onToggle).not.toHaveBeenCalled();
    // A built-in is never capped.
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Completion' })[0]!);
    expect(onToggle).toHaveBeenCalledWith('progress');
  });

  it('says so when there is nothing to suggest and no field to chart', () => {
    show({ fields: [], suggestions: [] });
    expect(screen.getByText('Nothing to suggest yet')).toBeTruthy();
    expect(screen.getByText('No fields to chart')).toBeTruthy();
    expect(rail().querySelector('[data-rail-entry="fields"]')).toBeTruthy();
  });

  it('finds widgets by field, kind and card type, and says when nothing matches', () => {
    show();
    const find = screen.getByRole('textbox', { name: 'Find a widget' });
    fireEvent.change(find, { target: { value: 'bug' } });
    // Severity is on Bug cards: its views stay; Budget's go.
    expect(screen.getAllByRole('button', { name: /Severity/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Add Budget Sum' })).toBeNull();
    fireEvent.change(find, { target: { value: 'currency' } });
    expect(screen.getAllByRole('button', { name: 'Add Budget Sum' }).length).toBeGreaterThan(0);
    fireEvent.change(find, { target: { value: 'zzz' } });
    expect(screen.queryByRole('navigation', { name: 'Widget sections' })).toBeNull();
    expect(screen.getAllByText(/zzz/).length).toBeGreaterThan(0);
    expect(document.querySelector('button[data-widget-card]')).toBeNull();
  });

  it('moves between tiles with the arrow keys, from the search box on', () => {
    show();
    const find = screen.getByRole('textbox', { name: 'Find a widget' });
    fireEvent.keyDown(find, { key: 'Enter' });
    fireEvent.keyDown(find, { key: 'ArrowDown' });
    const tiles = [...document.querySelectorAll<HTMLButtonElement>('button[data-widget-card]')];
    expect(document.activeElement).toBe(tiles[0]);
    fireEvent.keyDown(tiles[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tiles[1]);
    fireEvent.keyDown(tiles[1]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tiles[0]);
    // Laid out with no size (jsdom), down and up move two tiles: a row.
    fireEvent.keyDown(tiles[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tiles[2]);
    fireEvent.keyDown(tiles[2]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(tiles[0]);
    // Another key does nothing.
    fireEvent.keyDown(tiles[0]!, { key: 'a' });
    expect(document.activeElement).toBe(tiles[0]);
  });

  it('steps by where tiles sit when laid out', () => {
    show();
    const tiles = [...document.querySelectorAll<HTMLButtonElement>('button[data-widget-card]')];
    tiles.forEach((t, i) => {
      t.getBoundingClientRect = () =>
        ({
          top: Math.floor(i / 2) * 100,
          bottom: Math.floor(i / 2) * 100 + 90,
          left: (i % 2) * 200,
          height: 90,
        }) as DOMRect;
    });
    tiles[1]!.focus();
    fireEvent.keyDown(tiles[1]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tiles[3]);
    fireEvent.keyDown(tiles[3]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(tiles[1]);
  });

  it('scrolls to a section from the rail, and marks the section in view as current', () => {
    show();
    const list = document.querySelector<HTMLElement>('[data-gallery-list]')!;
    const people = section('people')!;
    // The list starts under the gallery's header (120 px down the screen); People 400 px into it. Its offsetTop is
    // from the list itself (the list is `relative`), so taking the list's own offset off too landed it 120 px short.
    const at = (top: number) => () =>
      ({
        top,
        bottom: top + 10,
        left: 0,
        right: 10,
        x: 0,
        y: top,
        width: 10,
        height: 10,
      }) as DOMRect;
    list.getBoundingClientRect = at(120);
    people.getBoundingClientRect = at(520);
    Object.defineProperty(people, 'offsetTop', { value: 400, configurable: true });
    Object.defineProperty(list, 'offsetTop', { value: 120, configurable: true });
    fireEvent.click(rail().querySelector('[data-rail-entry="people"]')!);
    expect(list.scrollTop).toBe(400);
    expect(rail().querySelector('[aria-current="true"]')?.getAttribute('data-rail-entry')).toBe(
      'people',
    );
    list.scrollTop = 0;
    act(() => {
      fireEvent.scroll(list);
    });
    expect(rail().querySelector('[aria-current="true"]')?.getAttribute('data-rail-entry')).not.toBe(
      'people',
    );
  });

  it('marks the last section current once the list is scrolled to its end, though it never reaches the top', () => {
    show();
    const list = document.querySelector<HTMLElement>('[data-gallery-list]')!;
    const all = [...document.querySelectorAll<HTMLElement>('[data-gallery-section]')];
    const last = all[all.length - 1]!;
    Object.defineProperty(list, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(list, 'clientHeight', { value: 600, configurable: true });
    list.scrollTop = 400;
    const at = (top: number) => () =>
      ({
        top,
        bottom: top + 10,
        left: 0,
        right: 10,
        x: 0,
        y: top,
        width: 10,
        height: 10,
      }) as DOMRect;
    list.getBoundingClientRect = at(0);
    // Every other section above the top; the last starts 300 px down the view.
    for (const el of all) {
      el.getBoundingClientRect = at(el === last ? 300 : -50);
      Object.defineProperty(el, 'offsetTop', {
        value: el === last ? 700 : 350,
        configurable: true,
      });
    }
    act(() => {
      fireEvent.scroll(list);
    });
    expect(rail().querySelector('[aria-current="true"]')?.getAttribute('data-rail-entry')).toBe(
      last.dataset.gallerySection,
    );
  });

  it('closes on Escape', () => {
    const { onClose } = show();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('gallerySections', () => {
  it('drops a suggestion whose field has gone, and every built-in kind is in one group', () => {
    const out = gallerySections({
      fields,
      suggestions: [{ id: 'field:sum:f-gone', score: 2, reason: 'x' }, ...suggestions],
    });
    expect(out[0]!.tiles.map((t) => t.id)).toEqual(['field:sum:f-budget', 'progress']);
    expect(WIDGET_GROUPS.flatMap((g) => g.kinds).sort()).toEqual([...BOARD_WIDGET_KINDS].sort());
  });

  it('leaves out sections a search empties', () => {
    const out = gallerySections({ fields, suggestions, query: 'severity' });
    expect(out.map((s) => s.key)).toEqual(['type:feature']);
    expect(sectionSize(out[0]!)).toBe(2);
  });
});
