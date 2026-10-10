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
} from './palette-layouts';
import { tileById, tilesForCategory } from './palette-tile-defs';

// The palette per mode (docs/specs/007-editor/editor-modes.md "The palette per mode").
const ids = (mode: 'diagram' | 'illustrate' | 'plan', esBoard = false) =>
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
        for (const t of e.tiles ?? []) expect(tileById(t), `${mode}: ${t}`).toBeDefined();
        if (CATALOGUE_CATEGORIES.has(e.id)) expect(e.tiles, `${mode}: ${e.id}`).toBeUndefined();
      }
      expect(seen, `${mode} lands on one of its own`).toContain(layout.landing);
    }
  });

  it('gives Diagram Popular, then every category but the mock-up kit and the charts', () => {
    expect(ids('diagram')).toEqual([
      'popular',
      'shapes',
      'my-shapes',
      'write',
      'draw',
      'build',
      'icons',
      'stickers',
      'technology',
      'media',
      'behaviour',
    ]);
  });

  it('offers Event Storming on a board only', () => {
    expect(ids('diagram', true)).toContain('event-storming');
    expect(paletteCategoryOffered('diagram', 'event-storming')).toBe(false);
  });

  it('narrows Illustrate to the categories a visual page is made of', () => {
    expect(ids('illustrate')).toEqual([
      'popular',
      'shapes',
      'my-shapes',
      'write',
      'build',
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
    expect(paletteLandingCategory('illustrate', false)).toBe('popular');
    expect(paletteLandingCategory('diagram', true)).toBe('event-storming');
  });

  it('holds the same tile in different categories per mode: Page is in Write for Diagram only', () => {
    expect(tileIds('diagram', 'write')).toContain('tools:page');
    expect(tileIds('illustrate', 'write')).not.toContain('tools:page');
    expect(tileIds('illustrate', 'write')).toEqual(['tools:text', 'tools:sticky']);
  });

  it('leaves mind nodes, lanes, frames, annotations and entities out of Illustrate', () => {
    const everywhere = paletteCategoriesFor('illustrate').flatMap((c) =>
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
    expect(tileIds('illustrate', 'build')).toEqual(['tools:table', 'tools:timeline']);
    expect(tileIds('diagram', 'build')).toContain('tools:mind-node');
    expect(tileIds('diagram', 'write')).toContain('tools:annotation');
  });

  it("leaves Media's embeds out of Diagram, keeping its own two", () => {
    expect(tileIds('diagram', 'media')).toEqual(['tools:image', 'tools:avatar']);
    expect(tileIds('illustrate', 'media')).toContain('media:embed-youtube');
  });

  it('defaults a category to its own tiles', () => {
    expect(tileIds('diagram', 'shapes')).toEqual(tilesForCategory('shapes').map((t) => t.id));
  });

  it("fills Diagram's Popular with what used to be the default Favourites", () => {
    expect(tileIds('diagram', 'popular')).toEqual([
      'shapes:square',
      'shapes:circle',
      'shapes:diamond',
      'tools:text',
      'tools:arrow',
      'tools:frame',
      'tools:sticky',
      'tools:image',
      'tools:shape-pen',
      'tools:table',
      'tools:code-block',
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
      'plan-widgets',
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
      expect(ids(mode)).not.toContain('plan-widgets');
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
