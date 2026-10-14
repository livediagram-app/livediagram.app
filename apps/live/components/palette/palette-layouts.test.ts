import { openerById } from './palette-openers';
import { describe, expect, it } from 'vitest';
import { isPlanViewId } from '@livediagram/items';
import { PALETTE_CATEGORIES } from './palette-categories';
import {
  CATALOGUE_CATEGORIES,
  COVERED_PALETTE_CATEGORY,
  PALETTE_LAYOUTS,
  coveredPaletteCategories,
  paletteCategoriesFor,
  paletteCategoryOffered,
  paletteLandingCategory,
  participantTiles,
} from './palette-layouts';
import { tileById, tilesForCategory } from './palette-tile-defs';

// The palette per mode (docs/specs/007-editor/editor-modes.md "The palette per mode").
const ids = (mode: 'diagram' | 'illustrate' | 'plan' | 'facilitate', esBoard = false) =>
  paletteCategoriesFor(mode, { esBoard }).map((c) => c.id);
const tileIds = (mode: 'diagram' | 'illustrate' | 'plan', category: string) =>
  paletteCategoriesFor(mode)
    .find((c) => c.id === category)!
    .tiles!.map((t) => t.id);

describe('palette layouts', () => {
  it('name only known categories, once each, and only known tiles', () => {
    const known = new Set(PALETTE_CATEGORIES.map((c) => c.id));
    for (const [mode, layout] of Object.entries(PALETTE_LAYOUTS)) {
      const seen = layout.categories.map((e) => e.id);
      expect(new Set(seen).size, mode).toBe(seen.length);
      for (const e of layout.categories) {
        expect(known.has(e.id), `${mode}: ${e.id}`).toBe(true);
        for (const t of e.tiles ?? [])
          expect(tileById(t) ?? openerById(t), `${mode}: ${t}`).toBeDefined();
        if (CATALOGUE_CATEGORIES.has(e.id)) expect(e.tiles, `${mode}: ${e.id}`).toBeUndefined();
      }
      expect(seen, `${mode} lands on one of its own`).toContain(layout.landing);
    }
  });

  it('gives Diagram Popular, then every category but the mock-up kit, the charts and the session kit', () => {
    expect(ids('diagram')).toEqual([
      'popular',
      'shapes',
      'my-shapes',
      'write',
      'draw',
      'build',
      'icons',
      'technology',
      'media',
    ]);
  });

  // Comments and assigned actions belong to every mode (docs/specs/012-collaboration/facilitate-mode.md).
  it("keeps the Comment panel and the Action card at the end of Diagram's Write", () => {
    const write = paletteCategoriesFor('diagram').find((c) => c.id === 'write')!;
    expect(write.tiles!.slice(-2).map((t) => t.id)).toEqual([
      'collab:comment-pin',
      'collab:action-card',
    ]);
  });

  // Facilitate mode (docs/specs/012-collaboration/facilitate-mode.md "The palette").
  it('gives Facilitate Popular, the drawing basics, the decorations and the six Collaborate categories', () => {
    expect(ids('facilitate')).toEqual([
      'popular',
      'shapes',
      'my-shapes',
      'write',
      'draw',
      'build',
      'icons',
      'stickers',
      'media',
      'collab-ask',
      'collab-tools',
      'collab-record',
      'collab-react',
      'collab-mode',
      'collab-navigate',
    ]);
    expect(paletteLandingCategory('facilitate', false)).toBe('popular');
  });

  it("puts the session kit on Facilitate's Popular as four openers", () => {
    const popular = paletteCategoriesFor('facilitate').find((c) => c.id === 'popular')!;
    expect(popular.tiles!.map((t) => t.id)).toEqual([
      'tools:sticky',
      'tools:text',
      'tools:frame',
      'tools:arrow',
      'open:collab-ask',
      'open:collab-tools',
      'open:collab-record',
      'open:collab-react',
    ]);
    // Each opens a category Facilitate offers.
    const offered = new Set(paletteCategoriesFor('facilitate').map((c) => c.id));
    for (const t of popular.tiles!)
      if (t.action.type === 'open') expect(offered.has(t.action.category), t.id).toBe(true);
  });

  it('defaults a category to its own tiles', () => {
    expect(tileIds('diagram', 'shapes')).toEqual(tilesForCategory('shapes').map((t) => t.id));
  });

  it("fills Diagram's Popular with the shapes, the structures and the AWS marks", () => {
    expect(tileIds('diagram', 'popular')).toEqual([
      'shapes:square',
      'shapes:circle',
      'shapes:diamond',
      'tools:text',
      'tools:arrow',
      'tools:frame',
      'tools:mind-node',
      'tools:flowchart',
      'tools:sankey',
      'tools:table',
      'open:technology/aws',
      'tools:entity',
    ]);
  });

  it('picks twelve Popular tiles, each reachable from another Illustrate category', () => {
    const popular = tileIds('illustrate', 'popular');
    expect(popular).toHaveLength(12);
    const reachable = new Set(
      paletteCategoriesFor('illustrate')
        .filter((c) => c.id !== 'popular')
        .flatMap((c) => (c.tiles ?? []).map((t) => t.id)),
    );
    for (const id of popular) expect(reachable.has(id), id).toBe(true);
  });

  // docs/specs/026-plan/plan-mode.md "The palette".
  it('narrows Plan to its own categories, and borrows the notes and team tools', () => {
    expect(ids('plan')).toEqual([
      'plan-cards',
      'plan-boards',
      'plan-metrics',
      'plan-visualisations',
      'plan-sheets',
      'plan-content',
      'plan-tools',
    ]);
    expect(tileIds('plan', 'plan-content')).toEqual([
      'tools:sticky',
      'tools:text',
      'tools:image',
      'tools:page',
    ]);
    expect(tileIds('plan', 'plan-tools')).toEqual([
      'collab:temperature',
      'collab:estimate',
      'collab:idea-box',
      'tools:picker',
      'tools:session-timer',
      'tools:session-stopwatch',
    ]);
    expect(paletteLandingCategory('plan', false)).toBe('plan-cards');
    // A tab without a board opens on Boards: a card lands on a board.
    expect(paletteLandingCategory('plan', false, false)).toBe('plan-boards');
    expect(paletteLandingCategory('diagram', false, false)).toBe('popular');
    expect(paletteLandingCategory('plan', true, false)).toBe('event-storming');
    for (const mode of ['diagram', 'illustrate'] as const) {
      expect(ids(mode)).not.toContain('plan-boards');
      expect(ids(mode)).not.toContain('plan-cards');
      expect(ids(mode)).not.toContain('plan-visualisations');
      expect(ids(mode)).not.toContain('plan-sheets');
    }
  });

  it('offers a board per preset and a card per item type', () => {
    const boards = tileIds('plan', 'plan-boards');
    const cards = tileIds('plan', 'plan-cards');
    expect(boards).toHaveLength(10);
    expect(boards.every((id) => id.startsWith('plan:board-'))).toBe(true);
    expect(cards).toHaveLength(5);
    expect(cards.every((id) => id.startsWith('plan:card-'))).toBe(true);
  });

  // docs/specs/026-plan/plan-views.md: every tile places a plan view naming its view.
  it('offers a metric per read-out kind and a tile per visualisation', () => {
    const widgets = paletteCategoriesFor('plan').find((c) => c.id === 'plan-metrics')!;
    const charts = paletteCategoriesFor('plan').find((c) => c.id === 'plan-visualisations')!;
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

  it('offers Logo in Illustrate only while the tab has a logo page (logo-pages.md)', () => {
    expect(ids('illustrate')).not.toContain('logo');
    const withLogo = paletteCategoriesFor('illustrate', { logoPages: true });
    const logo = withLogo.find((c) => c.id === 'logo')!;
    expect(logo.tiles!.map((t) => t.id)).toEqual([
      'logo:pen',
      'tools:pencil',
      'tools:text',
      'shapes:square',
      'shapes:circle',
      'shapes:diamond',
    ]);
    expect(paletteCategoriesFor('diagram', { logoPages: true }).map((c) => c.id)).not.toContain(
      'logo',
    );
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
    expect(paletteCategoriesFor('plan').some((c) => c.id === 'dashboard-layout')).toBe(false);
  });
});
