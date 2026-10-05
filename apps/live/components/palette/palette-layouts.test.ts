import { describe, expect, it } from 'vitest';
import { PALETTE_CATEGORIES } from './palette-categories';
import {
  CATALOGUE_CATEGORIES,
  PALETTE_LAYOUTS,
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

  // docs/specs/025-plan/plan-mode.md "The palette".
  it('narrows Plan to boards, cards and what sits round a board', () => {
    expect(ids('plan')).toEqual([
      'popular',
      'plan-boards',
      'plan-cards',
      'write',
      'shapes',
      'icons',
      'stickers',
      'media',
    ]);
    for (const mode of ['diagram', 'illustrate'] as const) {
      expect(ids(mode)).not.toContain('plan-boards');
      expect(ids(mode)).not.toContain('plan-cards');
    }
    expect(tileIds('plan', 'write')).not.toContain('tools:page');
    expect(tileIds('plan', 'media')).not.toContain('media:embed-youtube');
  });

  it('offers a board per preset and a card per item type, twelve Popular tiles all reachable', () => {
    const boards = tileIds('plan', 'plan-boards');
    const cards = tileIds('plan', 'plan-cards');
    expect(boards).toHaveLength(7);
    expect(boards.every((id) => id.startsWith('plan:board-'))).toBe(true);
    expect(cards).toHaveLength(8);
    expect(cards.every((id) => id.startsWith('plan:card-'))).toBe(true);
    const popular = tileIds('plan', 'popular');
    expect(popular).toHaveLength(12);
    const reachable = new Set(
      paletteCategoriesFor('plan')
        .filter((c) => c.id !== 'popular')
        .flatMap((c) => (c.tiles ?? []).map((t) => t.id)),
    );
    for (const id of popular) expect(reachable.has(id), id).toBe(true);
    expect(paletteLandingCategory('plan', false)).toBe('popular');
  });
});
