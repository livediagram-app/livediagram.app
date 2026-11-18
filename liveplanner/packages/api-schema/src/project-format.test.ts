import { describe, expect, it } from 'vitest';
import {
  CALCULATIONS,
  CARD_TEMPLATE_KEYS,
  CUSTOM_FIELD_KEYS,
  CUSTOM_FIELD_KINDS,
  ITEM_TYPE_KEYS,
  ITEM_TYPE_TAB_KEYS,
} from '@liveplanner/items';
import { PROJECT_FORMAT, PROJECT_FORMAT_HEADER } from './project-format';

// docs/specs/016-platform/new-version-prompt.md "The project format number".
describe('the project format number', () => {
  it('is 8, card prefixes, carried in one header', () => {
    expect(PROJECT_FORMAT).toBe(8);
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
  5: {
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
      'risk',
      'text',
      'votes',
    ],
    calculations: ['childCount', 'childrenDone', 'formula', 'lookup', 'rollup'],
  },
  6: {
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
      'risk',
      'text',
      'votes',
    ],
    calculations: ['childCount', 'childrenDone', 'formula', 'lookup', 'rollup'],
  },
  7: {
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
      'risk',
      'text',
      'votes',
    ],
    calculations: ['childCount', 'childrenDone', 'formula', 'lookup', 'rollup'],
  },
};
// Format 8 adds a card type's prefix and no field kind or calculation.
const READS_NOW: typeof READS = { ...READS, 8: READS[7]! };

describe('a new card field kind or calculation bumps the format', () => {
  it('reads exactly the kinds and calculations this format names', () => {
    const reads = READS_NOW[PROJECT_FORMAT];
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

// The keys a card type, a panel tab and a custom field are stored with (docs/specs/016-platform/new-version-prompt.md
// "The project format number", Work Tracker 368). Editors built before format 6 drop a key they do not know when they
// save a type, so a new key bumps PROJECT_FORMAT: the open editors are then offered "Reload". Each list in
// @liveplanner/items is typed to name every key of its shape, so a new key fails the typecheck until listed there,
// then this test until the number is bumped and the new format's keys are written here.
const TYPE_SHAPE = {
  type: [
    'assigneeNotifies',
    'color',
    'colourField',
    'custom',
    'defaultStatus',
    'detailsGlyph',
    'detailsLabel',
    'display',
    'excludedStatuses',
    'fieldLabels',
    'fields',
    'glyph',
    'id',
    'inherits',
    'label',
    'newTitle',
    'ownFields',
    'statuses',
    'tabs',
  ],
  tab: ['fields', 'glyph', 'id', 'label'],
  template: [] as string[],
  field: [
    'aggregate',
    'blocks',
    'calculation',
    'currency',
    'formula',
    'id',
    'kind',
    'label',
    'linkType',
    'linkTypes',
    'multiple',
    'notifies',
    'onCard',
    'options',
    'required',
    'result',
    'scale',
    'showAs',
    'source',
    'through',
    'timeSpent',
    'withTime',
  ],
};
// Format 7 adds a type's card templates (docs/specs/026-plan/item-types.md "Card templates") and their own keys.
const TYPE_SHAPE_7 = {
  ...TYPE_SHAPE,
  type: [...TYPE_SHAPE.type, 'templates'].sort(),
  template: ['fields', 'id', 'name'],
};
// Format 8 adds a type's card prefix (docs/specs/026-plan/item-types.md "Card number prefixes").
const TYPE_SHAPE_8 = { ...TYPE_SHAPE_7, type: [...TYPE_SHAPE_7.type, 'prefix'].sort() };
const KEYS: Readonly<Record<number, typeof TYPE_SHAPE>> = {
  6: TYPE_SHAPE,
  7: TYPE_SHAPE_7,
  8: TYPE_SHAPE_8,
};

describe("a new key in a card type's stored shape bumps the format", () => {
  it('reads exactly the type, tab and field keys this format names', () => {
    const keys = KEYS[PROJECT_FORMAT];
    expect(keys, `no keys listed for format ${PROJECT_FORMAT}`).toBeDefined();
    expect(
      [...ITEM_TYPE_KEYS].sort(),
      'ITEM_TYPE_KEYS changed: bump PROJECT_FORMAT and list the keys the new format reads',
    ).toEqual(keys!.type);
    expect(
      [...ITEM_TYPE_TAB_KEYS].sort(),
      'ITEM_TYPE_TAB_KEYS changed: bump PROJECT_FORMAT and list the keys the new format reads',
    ).toEqual(keys!.tab);
    expect(
      [...CUSTOM_FIELD_KEYS].sort(),
      'CUSTOM_FIELD_KEYS changed: bump PROJECT_FORMAT and list the keys the new format reads',
    ).toEqual(keys!.field);
    expect(
      [...CARD_TEMPLATE_KEYS].sort(),
      'CARD_TEMPLATE_KEYS changed: bump PROJECT_FORMAT and list the keys the new format reads',
    ).toEqual(keys!.template);
  });
});
