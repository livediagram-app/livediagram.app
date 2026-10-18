import { openerById } from './palette-openers';
import { describe, expect, it } from 'vitest';
import { isPlanViewId } from '@livediagram/items';
import { PALETTE_CATEGORIES } from './palette-categories';
import {
  CATALOGUE_CATEGORIES,
  DIVIDE,
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
const ids = (mode: 'diagram' | 'pages' | 'plan' | 'facilitate', esBoard = false) =>
  paletteCategoriesFor(mode, { esBoard }).map((c) => c.id);
const tileIds = (mode: 'diagram' | 'pages' | 'plan', category: string) =>
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
          if (t !== DIVIDE) expect(tileById(t) ?? openerById(t), `${mode}: ${t}`).toBeDefined();
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
      'diagrams',
      'concepts',
      'layout',
      'icons',
      'technology',
      'media',
    ]);
  });

  // A headed note belongs to a diagram as much as a page (docs/specs/007-editor/editor-modes.md).
  it("puts the Callout in Diagram's Write, before the Comment panel", () => {
    const write = paletteCategoriesFor('diagram').find((c) => c.id === 'write')!;
    expect(write.tiles!.slice(-3)[0]!.id).toBe('components:callout');
  });

  it('offers every Data tile in Facilitate and Pages, Pages adding the Table and the Timeline', () => {
    const data = tilesForCategory('data').map((t) => t.id);
    expect(tileIds('facilitate', 'data')).toEqual(data);
    expect(tileIds('pages', 'data')).toEqual([...data, 'tools:timeline', 'tools:table']);
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
  it('gives Facilitate Popular, the drawing basics, Layout, the decorations, the charts and the six Collaborate categories', () => {
    expect(ids('facilitate')).toEqual([
      'popular',
      'shapes',
      'my-shapes',
      'write',
      'draw',
      'layout',
      'icons',
      'stickers',
      'media',
      'data',
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
      'shapes:square',
      'tools:sticky',
      'tools:text',
      'tools:frame',
      'tools:arrow',
      'tools:image',
      'open:collab-ask',
      'open:collab-tools',
      'open:collab-record',
      'open:collab-react',
    ]);
    // A divider of its own between the tiles and the openers, here only.
    expect(popular.tiles!.filter((t) => t.dividerAfter).map((t) => t.id)).toContain('tools:image');
    // Each opens a category Facilitate offers.
    const offered = new Set(paletteCategoriesFor('facilitate').map((c) => c.id));
    for (const t of popular.tiles!)
      if (t.action.type === 'open') expect(offered.has(t.action.category), t.id).toBe(true);
  });

  // A layout that drops a group's last tile keeps the group's end: Diagram and Facilitate leave out the Tab Window,
  // which ends Media's first group, and Image ends it there instead.
  it("keeps Media's divider after Image where the Tab Window is left out", () => {
    for (const mode of ['diagram', 'facilitate'] as const) {
      const media = paletteCategoriesFor(mode).find((c) => c.id === 'media')!;
      const ids = media.tiles!.map((t) => t.id);
      expect(ids, mode).not.toContain('media:tab-window');
      expect(media.tiles!.find((t) => t.id === 'tools:image')?.dividerAfter, mode).toBe(true);
      // Never one at the very end.
      expect(media.tiles!.at(-1)?.dividerAfter, mode).toBeFalsy();
    }
  });

  it('holds every Collaborate tile in Facilitate, across its six categories', () => {
    const held = paletteCategoriesFor('facilitate')
      .filter((c) => c.id.startsWith('collab-'))
      .flatMap((c) => c.tiles!.map((t) => t.id));
    expect(held.sort()).toEqual(
      tilesForCategory('behaviour')
        .map((t) => t.id)
        .sort(),
    );
  });

  it("leaves Page, Annotation, Shape Pen and Polygon out of Facilitate's Write and Draw, and gives it Diagram's Layout", () => {
    const tilesOf = (id: string) =>
      paletteCategoriesFor('facilitate')
        .find((c) => c.id === id)!
        .tiles!.map((t) => t.id);
    const write = paletteCategoriesFor('facilitate').find((c) => c.id === 'write')!;
    expect(write.label).toBe('Write');
    expect(tilesOf('write')).toEqual([
      'tools:text',
      'tools:sticky',
      'tools:pointer-note',
      'tools:table',
      'tools:checklist',
    ]);
    expect(tilesOf('layout')).toEqual(tileIds('diagram', 'layout'));
    expect(tilesOf('draw')).toEqual([
      'tools:pencil',
      'tools:highlighter',
      'tools:arrow',
      'tools:line',
    ]);
  });

  it('gives a Facilitate Participant Sticky and Text, and an image', () => {
    expect(participantTiles('facilitate', false).map((t) => t.id)).toEqual([
      'tools:sticky',
      'tools:text',
      'tools:image',
    ]);
  });

  it('offers Event Storming on a board only', () => {
    expect(ids('diagram', true)).toContain('event-storming');
    expect(paletteCategoryOffered('diagram', 'event-storming')).toBe(false);
  });

  it('narrows Pages to the categories a visual page is made of', () => {
    expect(ids('pages')).toEqual([
      'popular',
      'shapes',
      'my-shapes',
      'write',
      'concepts',
      'components',
      'devices',
      'icons',
      'stickers',
      'media',
      'data',
    ]);
  });

  it('lands every mode on its Popular, a board on its notation', () => {
    expect(paletteLandingCategory('diagram', false)).toBe('popular');
    expect(paletteLandingCategory('pages', false)).toBe('popular');
    expect(paletteLandingCategory('diagram', true)).toBe('event-storming');
  });

  it('holds the same tile in different categories per mode: Page is in Write for Diagram only', () => {
    expect(tileIds('diagram', 'write')).toContain('tools:page');
    expect(tileIds('pages', 'write')).not.toContain('tools:page');
    expect(tileIds('pages', 'write')).toEqual(['tools:text', 'tools:sticky', 'tools:pointer-note']);
  });

  // Every Popular tile is in another category of its mode too: the category bar has no Popular.
  it('offers every Popular tile in another category of its mode', () => {
    for (const mode of ['diagram', 'facilitate', 'pages'] as const) {
      const cats = paletteCategoriesFor(mode);
      const elsewhere = new Set(
        cats.filter((c) => c.id !== 'popular').flatMap((c) => (c.tiles ?? []).map((t) => t.id)),
      );
      for (const tile of cats.find((c) => c.id === 'popular')?.tiles ?? [])
        if (tile.action.type !== 'open')
          expect(elsewhere.has(tile.id), `${mode} ${tile.id}`).toBe(true);
    }
  });

  it('files the Sankey under Concepts, not Build, in Diagram and Pages', () => {
    for (const mode of ['diagram', 'pages'] as const)
      expect(tileIds(mode, 'concepts').at(-1), mode).toBe('tools:sankey');
    expect(tileIds('diagram', 'diagrams')).not.toContain('tools:sankey');
  });

  it('leaves mind nodes, lanes, frames, annotations and entities out of Pages', () => {
    const everywhere = paletteCategoriesFor('pages').flatMap((c) =>
      (c.tiles ?? []).map((t) => t.id),
    );
    for (const id of [
      'tools:mind-node',
      'tools:lane',
      'tools:frame',
      'tools:annotation',
      'tools:entity',
    ]) {
      expect(everywhere, id).not.toContain(id);
    }
    // No Build: its three page tiles sit in Components and Data.
    expect(ids('pages')).not.toContain('build');
    expect(tileIds('pages', 'components').at(-1)).toBe('tools:stack');
    expect(tileIds('diagram', 'diagrams')).toContain('tools:mind-node');
    expect(tileIds('diagram', 'write')).toContain('tools:annotation');
  });

  it("leaves Media's embeds out of Diagram, keeping its own two", () => {
    expect(tileIds('diagram', 'media')).toEqual(['tools:image', 'tools:avatar']);
    expect(tileIds('pages', 'media')).toContain('media:embed-youtube');
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

  it('picks twelve Popular tiles, each reachable from another Pages category', () => {
    const popular = tileIds('pages', 'popular');
    expect(popular).toHaveLength(12);
    const reachable = new Set(
      paletteCategoriesFor('pages')
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
    for (const mode of ['diagram', 'pages'] as const) {
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

  it('offers Logo in Pages only while the tab has a logo page (logo-pages.md)', () => {
    expect(ids('pages')).not.toContain('logo');
    const withLogo = paletteCategoriesFor('pages', { logoPages: true });
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
