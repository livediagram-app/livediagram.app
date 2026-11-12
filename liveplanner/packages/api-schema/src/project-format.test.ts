import { describe, expect, it } from 'vitest';
import { CALCULATIONS, CUSTOM_FIELD_KINDS } from '@liveplanner/items';
import { PROJECT_FORMAT, PROJECT_FORMAT_HEADER } from './project-format';

// docs/specs/016-platform/new-version-prompt.md "The project format number".
describe('the project format number', () => {
  it('is 4, the Pull Request field, carried in one header', () => {
    expect(PROJECT_FORMAT).toBe(4);
    expect(PROJECT_FORMAT_HEADER).toBe('X-Liveplanner-Format');
  });
});

// The card field kinds and Calculated field calculations each format reads. An editor built before a kind keeps a
// field of it read-only (docs/specs/026-plan/item-types.md "Fields from a newer version"), and editors built before
// format 3 refuse the whole catalogue, so a new kind or calculation must bump PROJECT_FORMAT: the open editors are
// then offered "Reload". Adding one fails this test until the number is bumped, a line is added to project-format.ts
// and the spec, and the new format's lists are written here.
const READS: Readonly<
  Record<number, { kinds: readonly string[]; calculations: readonly string[] }>
> = {
  3: {
    kinds: [
      'calculated',
      'card',
      'checkbox',
      'checklist',
      'choice',
      'colour',
      'comments',
      'currency',
      'date',
      'daterange',
      'datetime',
      'duration',
      'email',
      'image',
      'labels',
      'link',
      'longtext',
      'multichoice',
      'number',
      'percent',
      'person',
      'phone',
      'rating',
      'text',
      'votes',
    ],
    calculations: ['childCount', 'childrenDone', 'formula', 'lookup', 'rollup'],
  },
  4: {
    kinds: [
      'calculated',
      'card',
      'checkbox',
      'checklist',
      'choice',
      'colour',
      'comments',
      'currency',
      'date',
      'daterange',
      'datetime',
      'duration',
      'email',
      'image',
      'labels',
      'link',
      'longtext',
      'multichoice',
      'number',
      'percent',
      'person',
      'phone',
      'pullrequest',
      'rating',
      'text',
      'votes',
    ],
    calculations: ['childCount', 'childrenDone', 'formula', 'lookup', 'rollup'],
  },
};

describe('a new card field kind or calculation bumps the format', () => {
  it('reads exactly the kinds and calculations this format names', () => {
    const reads = READS[PROJECT_FORMAT];
    expect(reads, `no kinds listed for format ${PROJECT_FORMAT}`).toBeDefined();
    expect(
      [...CUSTOM_FIELD_KINDS].sort(),
      'CUSTOM_FIELD_KINDS changed: bump PROJECT_FORMAT and list the kinds the new format reads',
    ).toEqual(reads!.kinds);
    expect(
      [...CALCULATIONS].sort(),
      'CALCULATIONS changed: bump PROJECT_FORMAT and list the calculations the new format reads',
    ).toEqual(reads!.calculations);
  });
});
