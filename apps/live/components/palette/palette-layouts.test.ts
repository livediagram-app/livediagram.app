import { openerById } from './palette-openers';
import { describe, expect, it } from 'vitest';
import { isPlanViewId } from '@liveplanner/items';
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
const ids = (mode: 'diagram' | 'pages' | 'plan' | 'workshop', esBoard = false) =>
  paletteCategoriesFor(mode, { esBoard }).map((c) => c.id);
const tileIds = (mode: 'diagram' | 'pages' | 'plan' | 'workshop', category: string) =>
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

  it('offers every Data tile in Workshop and Pages, Pages adding the Table', () => {
    const data = tilesForCategory('data').map((t) => t.id);
    expect(tileIds('workshop', 'data')).toEqual(data);
    expect(tileIds('pages', 'data')).toEqual([...data, 'tools:table']);
    // The Timeline is a concept graphic (docs/specs/009-elements/concept-graphics.md "Timeline"), in Concepts.
    expect(tileIds('pages', 'concepts')).toContain('tools:timeline');
    expect(tileIds('diagram', 'concepts')).toContain('tools:timeline');
  });

  // Comments and assigned actions belong to every mode (docs/specs/012-collaboration/workshop-mode.md).
  it("keeps the Comment panel and the Action card at the end of Diagram's Write", () => {
    const write = paletteCategoriesFor('diagram').find((c) => c.id === 'write')!;
    expect(write.tiles!.slice(-2).map((t) => t.id)).toEqual([
      'collab:comment-pin',
      'collab:action-card',
    ]);
  });

  // Workshop mode (docs/specs/012-collaboration/workshop-mode.md "The palette").
  it('gives Workshop Popular, the drawing basics, Layout, the six Collaborate categories, the decorations and the charts', () => {
    expect(ids('workshop')).toEqual([
      'popular',
      'shapes',
      'my-shapes',
      'write',
      'draw',
      'layout',
      'collab-ask',
      'collab-tools',
      'collab-record',
      'collab-react',
      'collab-mode',
      'collab-navigate',
      'icons',
      'stickers',
      'media',
      'data',
    ]);
    expect(paletteLandingCategory('workshop', false)).toBe('popular');
  });

  it("puts the session kit on Workshop's Popular as four openers", () => {
    const popular = paletteCategoriesFor('workshop').find((c) => c.id === 'popular')!;
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
    // Each opens a category Workshop offers.
    const offered = new Set(paletteCategoriesFor('workshop').map((c) => c.id));
    for (const t of popular.tiles!)
      if (t.action.type === 'open') expect(offered.has(t.action.category), t.id).toBe(true);
  });

  // A layout that drops a group's last tile keeps the group's end: Diagram and Workshop leave out the Tab Window,
  // which ends Media's first group, and Image ends it there instead.
  it("keeps Media's divider after Image where the Tab Window is left out", () => {
    for (const mode of ['diagram', 'workshop'] as const) {
      const media = paletteCategoriesFor(mode).find((c) => c.id === 'media')!;
      const ids = media.tiles!.map((t) => t.id);
      expect(ids, mode).not.toContain('media:tab-window');
      expect(media.tiles!.find((t) => t.id === 'tools:image')?.dividerAfter, mode).toBe(true);
      // Never one at the very end.
      expect(media.tiles!.at(-1)?.dividerAfter, mode).toBeFalsy();
    }
  });

  it('holds every Collaborate tile in Workshop, across its six categories', () => {
    const held = paletteCategoriesFor('workshop')
      .filter((c) => c.id.startsWith('collab-'))
      .flatMap((c) => c.tiles!.map((t) => t.id));
    expect(held.sort()).toEqual(
      tilesForCategory('behaviour')
        .map((t) => t.id)
        .sort(),
    );
  });

  it("leaves Page, Annotation, Shape Pen and Polygon out of Workshop's Write and Draw, and gives it Diagram's Layout", () => {
    const tilesOf = (id: string) =>
      paletteCategoriesFor('workshop')
        .find((c) => c.id === id)!
        .tiles!.map((t) => t.id);
    const write = paletteCategoriesFor('workshop').find((c) => c.id === 'write')!;
    expect(write.label).toBe('Write');
    expect(tilesOf('write')).toEqual([
      'tools:text',
      'tools:sticky',
      'tools:pointer-note',
      'tools:table',
      'tools:checklist',
    ]);
    // Diagram's Layout, with the Timeline after the containers: Workshop has no Concepts to find it in.
    const layout = tileIds('diagram', 'layout');
    expect(layout).not.toContain('tools:timeline');
    expect(tilesOf('layout')).toEqual([
      ...layout.slice(0, layout.indexOf('tools:boundary') + 1),
      'tools:timeline',
      ...layout.slice(layout.indexOf('tools:boundary') + 1),
    ]);
    expect(tilesOf('draw')).toEqual([
      'tools:pencil',
      'tools:highlighter',
      'tools:arrow',
      'tools:line',
    ]);
  });

  it('gives a Workshop Participant Sticky and Text, and an image', () => {
    expect(participantTiles('workshop', false).map((t) => t.id)).toEqual([
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
    for (const mode of ['diagram', 'workshop', 'pages'] as const) {
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
    // Components leads with its Layout group: the Hero, Header and Banner, then the Stack.
    expect(tileIds('pages', 'components').slice(0, 4)).toEqual([
      'components:hero',
      'components:header',
      'components:banner',
      'tools:stack',
    ]);
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

  it('gives a logo page its own palette: Draw, Shapes, Write, Icons, Library, Media (logo-pages.md)', () => {
    const logo = paletteCategoriesFor('pages', { pagesKind: 'logo' });
    expect(logo.map((c) => c.id)).toEqual([
      'popular',
      'draw',
      'shapes',
      'write',
      'icons',
      'my-shapes',
      'media',
    ]);
    const tilesOf = (id: string) => logo.find((c) => c.id === id)!.tiles!.map((t) => t.id);
    expect(tilesOf('draw')).toEqual([
      'logo:pen',
      'tools:pencil',
      'tools:shape-pen',
      'tools:polygon',
    ]);
    expect(tilesOf('write')).toEqual(['tools:text', 'tools:sticky']);
    expect(tilesOf('media')).toEqual(['tools:image']);
    // No Logo category anywhere: its tools are Draw's.
    for (const kind of ['design', 'slide', 'wireframe', 'logo'] as const)
      expect(paletteCategoriesFor('pages', { pagesKind: kind }).map((c) => c.id)).not.toContain(
        'logo',
      );
  });

  it('gives a slide page words, shapes and media first, then what makes a point (pages-mode.md)', () => {
    const slide = paletteCategoriesFor('pages', { pagesKind: 'slide' });
    expect(slide.map((c) => c.id)).toEqual([
      'popular',
      'write',
      'shapes',
      'media',
      'my-shapes',
      'data',
      'concepts',
      'components',
      'devices',
      'icons',
      'stickers',
    ]);
    expect(slide.find((c) => c.id === 'media')!.group).toBe(0);
    expect(slide.find((c) => c.id === 'components')!.tiles!.map((t) => t.id)).not.toContain(
      'components:header',
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

// docs/specs/007-editor/pages-mode.md "The palette's kind": each kind's tiles in one category each.
describe('the Pages kinds', () => {
  const wireframe = paletteCategoriesFor('pages', { pagesKind: 'wireframe' });

  it('leads Wireframe with Components then Elements, in a band of their own, and no Concepts or Devices', () => {
    const ids = wireframe.map((c) => c.id);
    expect(ids.slice(0, 3)).toEqual(['popular', 'components', 'wireframe']);
    expect(ids).not.toContain('concepts');
    expect(ids).not.toContain('devices');
    const band = wireframe[1]!.group;
    expect(wireframe[2]!.group).toBe(band);
    expect(wireframe[3]!.group).not.toBe(band);
  });

  it('keeps the Card, the Badge and the Checklist in Elements alone', () => {
    const components = wireframe.find((c) => c.id === 'components')!.tiles!.map((t) => t.id);
    expect(components).not.toContain('components:card');
    expect(components).not.toContain('components:badge');
    expect(components).not.toContain('tools:checklist');
    expect(tileIds('pages', 'components')).toContain('components:card');
  });

  it.each(['design', 'slide', 'wireframe', 'logo'] as const)(
    'shares no tile between two categories in %s, Popular aside',
    (kind) => {
      const seen = new Map<string, string>();
      for (const c of paletteCategoriesFor('pages', { pagesKind: kind })) {
        if (c.id === 'popular') continue;
        for (const t of c.tiles ?? []) {
          expect(seen.get(t.id), `${t.id} in ${c.id}`).toBeUndefined();
          seen.set(t.id, c.id);
        }
      }
    },
  );

  it('fills each kind’s Popular from its own categories', () => {
    for (const kind of ['design', 'slide', 'wireframe', 'logo'] as const) {
      const cats = paletteCategoriesFor('pages', { pagesKind: kind });
      const popular = cats.find((c) => c.id === 'popular')!.tiles!.map((t) => t.id);
      const rest = new Set(
        cats.filter((c) => c.id !== 'popular').flatMap((c) => (c.tiles ?? []).map((t) => t.id)),
      );
      for (const id of popular) expect(rest.has(id), `${kind}: ${id}`).toBe(true);
    }
  });
});
