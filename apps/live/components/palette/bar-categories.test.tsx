import { describe, expect, it } from 'vitest';
import { barCategoriesFor, WRITE_DRAW_ID } from './bar-categories';
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
  it('drops Popular and joins Write and Draw in Diagram', () => {
    // My shapes is in the layout; the palette leaves it out until there is a library to place from.
    expect(bar('diagram').map((c) => c.id)).toEqual([
      'shapes',
      'my-shapes',
      WRITE_DRAW_ID,
      'build',
      'concepts',
      'icons',
      'technology',
      'media',
    ]);
  });

  it('keeps Write and Draw apart inside the joined category, Write first', () => {
    const joined = bar('diagram').find((c) => c.id === WRITE_DRAW_ID)!;
    expect(joined.label).toBe('Draw');
    expect(joined.sections?.map((s) => s.title)).toEqual(['Write', 'Draw']);
    const write = paletteCategoriesFor('diagram').find((c) => c.id === 'write')!.tiles!;
    const draw = paletteCategoriesFor('diagram').find((c) => c.id === 'draw')!.tiles!;
    expect(joined.tiles).toEqual([...write, ...draw]);
  });

  it('gathers Facilitate’s session tools into Session, Ask keeping its own button', () => {
    const cats = bar('facilitate');
    expect(cats.map((c) => c.id)).toEqual([
      'shapes',
      'my-shapes',
      WRITE_DRAW_ID,
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
    const cats = bar('illustrate');
    expect(cats.map((c) => c.id)).not.toContain(WRITE_DRAW_ID);
    expect(cats.map((c) => c.id)).not.toContain(SESSION_CATEGORY_ID);
    expect(cats.find((c) => c.id === 'write')?.label).toBe('Write');
  });

  it('names every category in one word', () => {
    for (const mode of ['diagram', 'facilitate', 'illustrate'] as const)
      for (const c of bar(mode)) expect(c.label, `${mode} ${c.id}`).not.toMatch(/\s|&/);
  });
});
