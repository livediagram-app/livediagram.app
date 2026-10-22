import { openerById } from './palette-openers';
import { describe, expect, it } from 'vitest';
import { isPlanViewId } from '@liveplanner/items';
import { PALETTE_CATEGORIES } from './palette-categories';
import {
  CATALOGUE_CATEGORIES,
  DIVIDE,
  COVERED_PALETTE_CATEGORY,
  PLAN_PALETTE,
  coveredPaletteCategories,
  paletteCategoriesFor,
  paletteCategoryOffered,
  paletteLandingCategory,
} from './palette-layouts';
import { tileById, tilesForCategory } from './palette-tile-defs';

// Plan's palette (docs/specs/026-plan/plan-mode.md "The palette").
const ids = () => paletteCategoriesFor().map((c) => c.id);
const tileIds = (category: string) =>
  paletteCategoriesFor()
    .find((c) => c.id === category)!
    .tiles!.map((t) => t.id);

describe('palette layouts', () => {
  it('name only known categories, once each, and only known tiles', () => {
    const known = new Set(PALETTE_CATEGORIES.map((c) => c.id));
    const seen = PLAN_PALETTE.categories.map((e) => e.id);
    expect(new Set(seen).size).toBe(seen.length);
    for (const e of PLAN_PALETTE.categories) {
      expect(known.has(e.id), e.id).toBe(true);
      for (const t of e.tiles ?? [])
        if (t !== DIVIDE) expect(tileById(t) ?? openerById(t), t).toBeDefined();
      if (CATALOGUE_CATEGORIES.has(e.id)) expect(e.tiles, e.id).toBeUndefined();
    }
    expect(seen, 'Plan lands on one of its own').toContain(PLAN_PALETTE.landing);
  });

  it('defaults a category to its own tiles', () => {
    expect(tileIds('plan-boards')).toEqual(tilesForCategory('plan-boards').map((t) => t.id));
  });

  it('offers only the categories in its layout', () => {
    for (const id of ids()) expect(paletteCategoryOffered(id), id).toBe(true);
    for (const id of ['popular', 'shapes', 'dashboard-layout'])
      expect(paletteCategoryOffered(id), id).toBe(false);
  });

  // docs/specs/026-plan/plan-mode.md "The palette".
  it('narrows Plan to its own categories, and borrows the notes and team tools', () => {
    expect(ids()).toEqual([
      'plan-cards',
      'plan-boards',
      'plan-metrics',
      'plan-visualisations',
      'plan-sheets',
      'plan-content',
      'plan-tools',
    ]);
    expect(tileIds('plan-content')).toEqual(['tools:sticky', 'tools:text', 'tools:page']);
    expect(tileIds('plan-tools')).toEqual([
      'collab:temperature',
      'tools:picker',
      'tools:session-timer',
      'tools:session-stopwatch',
    ]);
    expect(paletteLandingCategory()).toBe('plan-cards');
    // A tab without a board opens on Boards: a card lands on a board.
    expect(paletteLandingCategory(false)).toBe('plan-boards');
  });

  it('offers a board per preset and a card per item type', () => {
    const boards = tileIds('plan-boards');
    const cards = tileIds('plan-cards');
    expect(boards).toHaveLength(10);
    expect(boards.every((id) => id.startsWith('plan:board-'))).toBe(true);
    expect(cards).toHaveLength(5);
    expect(cards.every((id) => id.startsWith('plan:card-'))).toBe(true);
  });

  // docs/specs/026-plan/plan-views.md: every tile places a plan view naming its view.
  it('offers a metric per read-out kind and a tile per visualisation', () => {
    const widgets = paletteCategoriesFor().find((c) => c.id === 'plan-metrics')!;
    const charts = paletteCategoriesFor().find((c) => c.id === 'plan-visualisations')!;
    expect(widgets.tiles).toHaveLength(10);
    expect(charts.tiles!.map((t) => t.caption)).toEqual([
      'Gantt Chart',
      'Due Calendar',
      'Start Calendar',
      'Cards by Field',
      'Priority Matrix',
      'Card Search',
    ]);
    for (const t of [...widgets.tiles!, ...charts.tiles!]) {
      expect(t.action).toMatchObject({ type: 'shape', kind: 'plan-view' });
      expect(isPlanViewId((t.action as { plan?: string }).plan)).toBe(true);
    }
  });
});

// docs/specs/026-plan/plan-board.md "Maximised board": a board covering the canvas leaves the palette only Cards.
describe('coveredPaletteCategories', () => {
  it('is Plan’s Cards alone', () => {
    expect(coveredPaletteCategories().map((c) => c.id)).toEqual([COVERED_PALETTE_CATEGORY]);
    expect(COVERED_PALETTE_CATEGORY).toBe('plan-cards');
  });
});

// docs/specs/026-plan/plan-tabs.md "Dashboard tab": a Dashboard's own palette.
describe('the Dashboard palette', () => {
  it('opens on Popular, every tile of it a real one, then what a slot takes', async () => {
    const { dashboardPaletteCategories, DASHBOARD_PALETTE_LANDING } =
      await import('./palette-layouts');
    const cats = dashboardPaletteCategories();
    expect(DASHBOARD_PALETTE_LANDING).toBe('popular');
    expect(cats.map((c) => c.id)).toEqual([
      'popular',
      'dashboard-layout',
      'dashboard-tabs',
      'plan-boards',
      'plan-metrics',
      'plan-visualisations',
      'plan-sheets',
      'plan-content',
    ]);
    expect(cats[0]!.tiles).toHaveLength(13);
    expect(cats.at(-1)!.tiles?.map((t) => t.id)).toEqual([
      'tools:sticky',
      'dashboard:card-title',
      'dashboard:card-status',
      'dashboard:card-checklist',
      'dashboard:card-key-date',
      'dashboard:card-links',
    ]);
    // Layout is a Dashboard's alone.
    expect(paletteCategoriesFor().some((c) => c.id === 'dashboard-layout')).toBe(false);
  });
});
