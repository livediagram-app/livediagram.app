import { describe, expect, it } from 'vitest';
import { barCategoriesFor } from './bar-categories';
import { paletteCategoriesFor } from './palette-layouts';
import { SESSION_CATEGORY_ID, SESSION_GROUP_IDS } from './session-category';
import type { EditorMode } from '@livehuddle/document';

// What the category bar offers (docs/specs/007-editor/toolbar-layout.md "The category bar").

const bar = (mode: EditorMode) =>
  barCategoriesFor(
    paletteCategoriesFor(mode).map((c) => ({ ...c, content: null })),
    (groups) => groups.map((g) => g.id).join(','),
  );

describe('the category bar’s categories', () => {
  it('gathers Workshop’s session tools into Session, Ask keeping its own button', () => {
    const cats = bar('workshop');
    expect(cats.map((c) => c.id)).toEqual([
      'shapes',
      'my-shapes',
      'write',
      'draw',
      'layout',
      'collab-ask',
      SESSION_CATEGORY_ID,
      'icons',
      'stickers',
      'media',
      'data',
    ]);
    const session = cats.find((c) => c.id === SESSION_CATEGORY_ID)!;
    expect(session.tiles).toBeNull();
    // Its body is drawn from the groups it gathered, in order.
    expect(session.content).toBe(SESSION_GROUP_IDS.join(','));
  });
});
