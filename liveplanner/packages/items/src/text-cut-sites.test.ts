import { describe, expect, it } from 'vitest';
import { normaliseBoardSetup } from './board';
import { fieldLabelsWith, FIELD_LABEL_MAX } from './built-in-field-labels';
import { ITEM_LABEL_MAX, PLAN_COLUMN_NAME_MAX, PLAN_TITLE_MAX } from './limits';
import { SAVED_FILTER_NAME_MAX, SAVED_FILTER_TEXT_MAX, savedFilterFrom } from './saved-filters';
import { cutText as trackerCut } from './tracker-import/tracker-text';
import { boardCsvImport } from './board-csv';
import { ITEM_TYPES } from './item-types';

// Capped names are cut by the shared cutText (@liveworkspace/model-core/text-cut): a plain `slice` at the cap left half
// an emoji (a lone surrogate), drawn as a replacement box and stored as U+FFFD.
const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const over = (max: number) => `${'a'.repeat(max - 1)}😀 more`;

describe('capped names in items', () => {
  it('never keep half an emoji at the cap', () => {
    const saved = savedFilterFrom(
      { text: over(SAVED_FILTER_TEXT_MAX) },
      over(SAVED_FILTER_NAME_MAX),
      'f1',
    );
    expect(saved.name).toBe('a'.repeat(SAVED_FILTER_NAME_MAX - 1));
    expect(saved.text).toBe('a'.repeat(SAVED_FILTER_TEXT_MAX - 1));
    expect(fieldLabelsWith(undefined, 'due', over(FIELD_LABEL_MAX))?.due).toBe(
      'a'.repeat(FIELD_LABEL_MAX - 1),
    );
    const setup = normaliseBoardSetup({
      title: over(PLAN_TITLE_MAX),
      columns: [{ id: 'c1', status: 'todo', name: over(PLAN_COLUMN_NAME_MAX) }],
    })!;
    expect(setup.title).not.toMatch(LONE);
    expect(setup.columns[0]!.name).not.toMatch(LONE);
    expect(trackerCut('a😀b', 3)).toBe('a…');
  });

  it('cuts an imported CSV row’s title and labels whole', () => {
    const setup = normaliseBoardSetup({
      title: 'Board',
      columns: [{ id: 'c1', status: 'todo', name: 'To Do' }],
    })!;
    const { creates } = boardCsvImport(
      [
        ['Title', 'Labels'],
        [`${'t'.repeat(499)}😀`, over(ITEM_LABEL_MAX)],
      ],
      { setup, types: ITEM_TYPES, people: [], room: 10 },
    );
    const fields = creates[0]!.fields as Record<string, unknown>;
    expect(fields['title']).toBe('t'.repeat(499));
    expect(fields['labels']).toEqual(['a'.repeat(ITEM_LABEL_MAX - 1)]);
  });
});
