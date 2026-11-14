import { describe, expect, it } from 'vitest';
import type { CustomFieldDef, ItemTypeDef } from './item-types';
import type { ItemFields } from './item';
import { typeChangeFields, withTypeChangeFields } from './card-retype-fields';

// docs/specs/026-plan/item-types.md "Changing a card's type": custom fields map by name and compatible kind, Choice
// values only as options, unmapped values kept (never cleared), a value the write gives never replaced.
const typeOf = (id: string, custom: CustomFieldDef[], extra: Partial<ItemTypeDef> = {}) =>
  ({
    id,
    label: id,
    newTitle: `New ${id}`,
    glyph: 'item',
    color: '#2563eb',
    fields: ['title', 'status', 'description', 'priority', ...custom.map((f) => f.id)],
    custom,
    ...extra,
  }) as ItemTypeDef;

const IDEA = typeOf('idea', [
  { id: 'f-apps', label: 'App', kind: 'multichoice', options: ['Editor', 'API', 'Help'] },
  { id: 'f-solution', label: 'Solution', kind: 'longtext' },
]);
const WORK = typeOf('work', [
  { id: 'f-app', label: 'App', kind: 'choice', options: ['editor', 'API'] },
  { id: 'f-criteria', label: 'Acceptance Criteria', kind: 'longtext' },
]);

describe('typeChangeFields', () => {
  it('maps the Idea App onto the Work Item App by name, keeping only its options, and nothing else', () => {
    const fields: ItemFields = {
      title: 'Ship it',
      priority: 'high',
      'f-apps': ['Help', 'Editor', 'API'],
      'f-solution': 'Do the thing',
    };
    // The first pick the new field holds, spelt as it spells it; Solution has no field of its name, so it stays put.
    expect(typeChangeFields(fields, IDEA, WORK)).toEqual({ 'f-app': 'editor' });
  });

  it('writes no Choice value outside the new options, and a Multiple Choice keeps the picks that are', () => {
    expect(typeChangeFields({ 'f-apps': ['Help'] }, IDEA, WORK)).toEqual({});
    const back = typeChangeFields({ 'f-app': 'API' }, WORK, IDEA);
    expect(back).toEqual({ 'f-apps': ['API'] });
    const many = typeOf('many', [
      { id: 'f-many', label: 'app', kind: 'multichoice', options: ['API', 'Editor'] },
    ]);
    expect(typeChangeFields({ 'f-apps': ['Help', 'editor', 'API'] }, IDEA, many)).toEqual({
      'f-many': ['Editor', 'API'],
    });
    expect(typeChangeFields({ 'f-apps': [7] as never }, IDEA, many)).toEqual({});
    const none = typeOf('none', [{ id: 'f-none', label: 'App', kind: 'choice' }]);
    expect(typeChangeFields({ 'f-apps': ['API'] }, IDEA, none)).toEqual({});
  });

  it('matches names ignoring case and end spaces, reading the first field of that name with a value', () => {
    const from = typeOf('a', [
      { id: 'f-one', label: 'Notes', kind: 'text' },
      { id: 'f-two', label: ' notes ', kind: 'text' },
    ]);
    const to = typeOf('b', [{ id: 'f-three', label: 'NOTES', kind: 'text' }]);
    expect(typeChangeFields({ 'f-two': 'second' }, from, to)).toEqual({ 'f-three': 'second' });
    expect(typeChangeFields({ 'f-one': 'first', 'f-two': 'second' }, from, to)).toEqual({
      'f-three': 'first',
    });
    expect(typeChangeFields({ 'f-one': '' }, from, to)).toEqual({});
  });

  it('maps Text and Long Text either way, a Long Text bringing its formatting into another', () => {
    const rich = [{ text: 'Bold', bold: true }];
    const solution = typeOf('s', [{ id: 'f-sol', label: 'Solution', kind: 'longtext' }]);
    expect(
      typeChangeFields({ 'f-solution': 'Line\nTwo', 'f-solutionRich': rich }, IDEA, solution),
    ).toEqual({ 'f-sol': 'Line\nTwo', 'f-solRich': rich });
    const short = typeOf('t', [{ id: 'f-line', label: 'Solution', kind: 'text' }]);
    expect(
      typeChangeFields({ 'f-solution': 'Line\n  Two', 'f-solutionRich': rich }, IDEA, short),
    ).toEqual({ 'f-line': 'Line Two' });
    expect(typeChangeFields({ 'f-line': 'One line' }, short, IDEA)).toEqual({
      'f-solution': 'One line',
    });
  });

  it('never maps an incompatible kind, a worked-out field, threads, votes or time tracking', () => {
    const pair = (
      a: Omit<CustomFieldDef, 'id' | 'label'>,
      b: Omit<CustomFieldDef, 'id' | 'label'>,
    ) =>
      [
        typeOf('a', [{ id: 'f-a', label: 'X', ...a }]),
        typeOf('b', [{ id: 'f-b', label: 'X', ...b }]),
      ] as const;
    const cases: [ReturnType<typeof pair>, unknown][] = [
      [pair({ kind: 'number' }, { kind: 'text' }), 3],
      [pair({ kind: 'text' }, { kind: 'calculated', calculation: 'formula', formula: '1' }), 'x'],
      [pair({ kind: 'calculated', calculation: 'formula', formula: '1' }, { kind: 'number' }), 1],
      [pair({ kind: 'comments' }, { kind: 'comments' }), 'x'],
      [pair({ kind: 'votes' }, { kind: 'votes' }), { p: 1 }],
      [pair({ kind: 'duration', timeSpent: true }, { kind: 'duration' }), 60],
      [pair({ kind: 'currency', currency: 'USD' }, { kind: 'currency' }), 10],
      [pair({ kind: 'rating', scale: 10 }, { kind: 'rating' }), 7],
      [pair({ kind: 'rating' }, { kind: 'rating' }), 'x'],
      [
        pair(
          { kind: 'card', linkType: 'a', linkTypes: ['a', 'b'] },
          { kind: 'card', linkType: 'a' },
        ),
        'c1',
      ],
      [pair({ kind: 'card' }, { kind: 'card', linkType: 'a' }), 'c1'],
    ];
    for (const [[from, to], value] of cases)
      expect(typeChangeFields({ 'f-a': value as never }, from, to)).toEqual({});
  });

  it('maps the same kind as it holds it: a Rating in scale, one currency, Card links it takes, one person', () => {
    const pair = (
      a: Omit<CustomFieldDef, 'id' | 'label'>,
      b: Omit<CustomFieldDef, 'id' | 'label'>,
    ) =>
      [
        typeOf('a', [{ id: 'f-a', label: 'X', ...a }]),
        typeOf('b', [{ id: 'f-b', label: 'X', ...b }]),
      ] as const;
    const sam = { id: 'p1', name: 'Sam', color: '#000000' };
    const ali = { id: 'p2', name: 'Ali', color: '#ffffff' };
    const cases: [ReturnType<typeof pair>, unknown, unknown][] = [
      [pair({ kind: 'rating', scale: 10 }, { kind: 'rating' }), 4, 4],
      [pair({ kind: 'currency' }, { kind: 'currency', currency: 'GBP' }), 10, 10],
      [
        pair(
          { kind: 'card', linkType: 'a' },
          { kind: 'card', linkType: 'b', linkTypes: ['b', 'a'] },
        ),
        'c1',
        'c1',
      ],
      [pair({ kind: 'card', linkType: 'a' }, { kind: 'card' }), 'c1', 'c1'],
      [pair({ kind: 'person', multiple: true }, { kind: 'person' }), [sam, ali], sam],
      [pair({ kind: 'number' }, { kind: 'number' }), 3, 3],
    ];
    for (const [[from, to], value, want] of cases)
      expect(typeChangeFields({ 'f-a': value as never }, from, to)).toEqual({ 'f-b': want });
  });

  it('leaves a field both types share by id alone, and puts the visible value over a hidden one', () => {
    const shared = { id: 'f-app', label: 'App', kind: 'choice', options: ['API'] } as const;
    const base = typeOf('base', [shared]);
    const child = typeOf('child', [shared, { id: 'f-more', label: 'More', kind: 'text' }]);
    expect(typeChangeFields({ 'f-app': 'API' }, base, child)).toEqual({});
    // Back to the Idea from a Work Item whose App was changed: the Work Item's API wins over the Idea's old Help.
    expect(typeChangeFields({ 'f-app': 'API', 'f-apps': ['Help'] }, WORK, IDEA)).toEqual({
      'f-apps': ['API'],
    });
  });

  it('maps nothing for the same type, or a type with no custom fields', () => {
    const bare = typeOf('bare', []);
    expect(typeChangeFields({ 'f-apps': ['API'] }, IDEA, IDEA)).toEqual({});
    expect(typeChangeFields({ 'f-apps': ['API'] }, IDEA, bare)).toEqual({});
    expect(typeChangeFields({ 'f-app': 'API' }, bare, IDEA)).toEqual({});
    expect(typeChangeFields({}, { ...IDEA, custom: undefined }, WORK)).toEqual({});
    expect(typeChangeFields({}, IDEA, { ...WORK, custom: undefined })).toEqual({});
  });
});

describe('withTypeChangeFields', () => {
  const card = { type: 'idea', fields: { title: 'T', 'f-apps': ['API'] } as ItemFields };
  const types = [IDEA, WORK];

  it('adds the mapped values to the write, beside its own', () => {
    expect(withTypeChangeFields(card, { type: 'work', set: { title: 'U' } }, types)).toEqual({
      type: 'work',
      set: { title: 'U', 'f-app': 'API' },
    });
  });

  it('hands back a write that changes no type, or maps nothing, as it was', () => {
    const plain = { set: { title: 'U' } };
    expect(withTypeChangeFields(card, plain, types)).toBe(plain);
    const same = { type: 'idea' };
    expect(withTypeChangeFields(card, same, types)).toBe(same);
    const nothing = { type: 'work' };
    expect(withTypeChangeFields({ type: 'idea', fields: {} }, nothing, types)).toBe(nothing);
  });

  it('never replaces a value the write sets or clears, and reads the card as the write leaves it', () => {
    expect(withTypeChangeFields(card, { type: 'work', set: { 'f-app': 'editor' } }, types)).toEqual(
      { type: 'work', set: { 'f-app': 'editor' } },
    );
    const cleared = { type: 'work', clear: ['f-app'] };
    expect(withTypeChangeFields(card, cleared, types)).toBe(cleared);
    expect(withTypeChangeFields(card, { type: 'work', clear: ['f-apps'] }, types)).toEqual({
      type: 'work',
      clear: ['f-apps'],
    });
    expect(
      withTypeChangeFields(card, { type: 'work', set: { 'f-apps': ['Editor'] } }, types),
    ).toEqual({ type: 'work', set: { 'f-apps': ['Editor'], 'f-app': 'editor' } });
  });
});
