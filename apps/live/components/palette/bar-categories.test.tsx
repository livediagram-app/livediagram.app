import { describe, expect, it } from 'vitest';
import { barCategoriesFor } from './bar-categories';
import { flyoutGroups } from './category-flyout-groups';
import { tilesForCategory } from './palette-tile-defs';
import { paletteCategoriesFor } from './palette-layouts';
import { SESSION_CATEGORY_ID, SESSION_GROUP_IDS } from './session-category';
import type { EditorMode } from '@livediagram/document';

// What the category bar offers (docs/specs/007-editor/toolbar-layout.md "The category bar").

const bar = (mode: EditorMode) =>
  barCategoriesFor(
    paletteCategoriesFor(mode).map((c) => ({ ...c, content: null })),
    (groups) => groups.map((g) => g.id).join(','),
  );

describe('the category bar’s categories', () => {
  it('drops Popular and offers Write, Draw, Diagrams and Layout apart in Diagram', () => {
    // My shapes is in the layout; the palette leaves it out until there is a library to place from.
    expect(bar('diagram').map((c) => c.id)).toEqual([
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

  // docs/specs/007-editor/toolbar-layout.md "What is on it": Draw holds only what a stroke or a drag makes.
  it('keeps the words and comments out of Draw', () => {
    for (const mode of ['diagram', 'facilitate'] as const) {
      const draw = bar(mode).find((c) => c.id === 'draw')!;
      expect(draw.label).toBe('Draw');
      for (const id of draw.tiles!.map((t) => t.id))
        expect(id, `${mode} ${id}`).toMatch(
          /^tools:(pencil|shape-pen|highlighter|polygon|arrow|line)$/,
        );
    }
  });

  // docs/specs/010-palette/build-category.md "In Diagram: Diagrams and Layout".
  it('offers every Build tile in Diagram through Diagrams, Layout or Concepts, each once', () => {
    const cats = bar('diagram');
    const ids = (id: string) => cats.find((c) => c.id === id)!.tiles!.map((t) => t.id);
    const placed = [...ids('diagrams'), ...ids('layout'), ...ids('concepts')];
    expect(cats.map((c) => c.id)).not.toContain('build');
    for (const tile of tilesForCategory('build'))
      expect(
        placed.filter((id) => id === tile.id),
        tile.id,
      ).toHaveLength(1);
  });

  it('heads the Diagram flyouts’ groups', () => {
    const groups = (id: string) =>
      flyoutGroups(id, bar('diagram').find((c) => c.id === id)!.tiles!).map((g) => g.title);
    expect(groups('write')).toEqual(['Text', 'Notes', 'Comments']);
    expect(groups('draw')).toEqual(['Pens', 'Outlines', 'Connectors']);
    expect(groups('layout')).toEqual(['Containers', 'Parts']);
  });

  it('gathers Facilitate’s session tools into Session, Ask keeping its own button', () => {
    const cats = bar('facilitate');
    expect(cats.map((c) => c.id)).toEqual([
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
      SESSION_CATEGORY_ID,
    ]);
    const session = cats.find((c) => c.id === SESSION_CATEGORY_ID)!;
    expect(session.tiles).toBeNull();
    // Its body is drawn from the groups it gathered, in order.
    expect(session.content).toBe(SESSION_GROUP_IDS.join(','));
  });

  it('leaves a mode with no Draw or session tools as it is, names shortened', () => {
    const cats = bar('pages');
    expect(cats.map((c) => c.id)).not.toContain('draw');
    expect(cats.map((c) => c.id)).not.toContain(SESSION_CATEGORY_ID);
    expect(cats.find((c) => c.id === 'write')?.label).toBe('Write');
  });

  it('names every category in one word', () => {
    for (const mode of ['diagram', 'facilitate', 'pages'] as const)
      for (const c of bar(mode)) expect(c.label, `${mode} ${c.id}`).not.toMatch(/\s|&/);
  });
});
