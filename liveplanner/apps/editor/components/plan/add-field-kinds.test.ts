import { describe, expect, it } from 'vitest';
import { BUILT_IN_FIELD_IDS, CUSTOM_FIELD_KINDS } from '@liveplanner/items';
import {
  BUILT_INS_OF_KIND,
  BUILT_IN_ROLES,
  KIND_ALIASES,
  KIND_DESCRIPTIONS,
  KIND_CATEGORIES,
  KIND_VARIANTS,
  categoryOfKind,
  pickOf,
  presetOf,
  storedKindOf,
  kindMatches,
  kindReadiness,
  readyBuiltIns,
  searchKey,
  shownCategories,
  type PickKind,
} from './add-field-kinds';
import { BUILT_IN_FIELD_LABELS, PICK_KIND_LABELS } from './ItemTypeFieldForms';

// docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field's categories, lines, words and readiness.
const PICK_KINDS: readonly PickKind[] = [
  ...CUSTOM_FIELD_KINDS,
  ...(Object.keys(KIND_VARIANTS) as PickKind[]),
];
const found = (query: string): PickKind[] =>
  PICK_KINDS.filter((k) =>
    kindMatches(
      k,
      PICK_KIND_LABELS[k],
      searchKey(query),
      (BUILT_INS_OF_KIND[k] ?? []).map((id) => BUILT_IN_FIELD_LABELS[id]),
    ),
  );

const labelOf = (k: PickKind) => PICK_KIND_LABELS[k];
const builtInNamesOf = (k: PickKind) =>
  (BUILT_INS_OF_KIND[k] ?? []).map((id) => BUILT_IN_FIELD_LABELS[id]);

describe('the kinds’ categories', () => {
  it('holds every kind once, built-in and custom alike, in nine plainly named categories, each with a line', () => {
    expect(KIND_CATEGORIES.map((c) => c.label)).toEqual([
      'Text',
      'Numbers',
      'Dates',
      'Time',
      'Choices',
      'People',
      'Links and Images',
      'Cards',
      'Calculated',
    ]);
    const placed = KIND_CATEGORIES.flatMap((c) => c.kinds);
    expect([...placed].sort()).toEqual([...PICK_KINDS].sort());
    expect(new Set(placed).size).toBe(placed.length);
    for (const c of KIND_CATEGORIES) expect(c.line).toMatch(/^[A-Z].+\.$/);
    expect(KIND_CATEGORIES.find((c) => c.id === 'cards')!.kinds).toEqual([
      'card',
      'cards',
      'blocked-by',
    ]);
    expect(KIND_CATEGORIES.find((c) => c.id === 'calculated')!.kinds).toEqual([
      'calculated',
      'formula',
      'rollup',
      'lookup',
    ]);
    expect(categoryOfKind('rating').id).toBe('numbers');
    expect(categoryOfKind('duration').id).toBe('time');
    expect(categoryOfKind('colour').id).toBe('choices');
    expect(categoryOfKind('image').id).toBe('links');
    expect(KIND_CATEGORIES.find((c) => c.id === 'links')!.kinds).toEqual([
      'link',
      'pullrequest',
      'email',
      'phone',
      'image',
      'images',
    ]);
  });

  it('leaves each category the kinds a search finds, every kind with none', () => {
    expect(shownCategories('', labelOf, builtInNamesOf).map((c) => c.shown)).toEqual(
      KIND_CATEGORIES.map((c) => c.kinds),
    );
    const dates = shownCategories('date', labelOf, builtInNamesOf);
    expect(dates.find((c) => c.id === 'dates')!.shown).toEqual([
      'date',
      'datetime',
      'daterange',
      'datetime-range',
    ]);
    expect(dates.find((c) => c.id === 'text')!.shown).toEqual([]);
    // A category's own name is not searched: money finds Currency alone.
    const money = shownCategories('money', labelOf, builtInNamesOf).flatMap((c) => c.shown);
    expect(money).toEqual(['currency']);
  });

  it('offers every built-in field a type can add under one kind, each with what uses it', () => {
    const offered = Object.values(BUILT_INS_OF_KIND).flat();
    const addable = BUILT_IN_FIELD_IDS.filter((f) => f !== 'title' && f !== 'status');
    expect([...offered].sort()).toEqual([...addable].sort());
    for (const id of offered) expect(BUILT_IN_ROLES[id]).toBeTruthy();
    expect(readyBuiltIns('date', ['due', 'assignee'])).toEqual(['due']);
    expect(readyBuiltIns('date', ['start', 'due'])).toEqual(['start', 'due']);
    expect(readyBuiltIns('text', ['due'])).toEqual([]);
    expect(readyBuiltIns('votes', ['votes'])).toEqual(['votes']);
  });

  it('gives every kind a one-line description and some words', () => {
    for (const k of PICK_KINDS) {
      expect(KIND_DESCRIPTIONS[k].length).toBeGreaterThan(5);
      expect(KIND_DESCRIPTIONS[k]).not.toContain('\n');
      expect(KIND_ALIASES[k].length).toBeGreaterThan(0);
    }
  });
});

describe('variants', () => {
  it('makes each variant its stored kind with its option preset, and knows a field back by it', () => {
    expect(Object.keys(KIND_VARIANTS)).toEqual([
      'people',
      'time-tracking',
      'datetime-range',
      'cards',
      'images',
      'blocked-by',
      'formula',
      'rollup',
      'lookup',
    ]);
    for (const v of Object.keys(KIND_VARIANTS) as PickKind[]) {
      const field = { kind: storedKindOf(v), ...presetOf(v) };
      expect(pickOf(field)).toBe(v);
      // A variant sits in its kind's category, right after it or another variant of it.
      expect(categoryOfKind(v).id).toBe(categoryOfKind(storedKindOf(v)).id);
      expect(PICK_KIND_LABELS[v]).toMatch(/^[A-Z]/);
    }
    expect(presetOf('people')).toEqual({ multiple: true });
    expect(presetOf('blocked-by')).toEqual({ blocks: true, multiple: true });
    expect(presetOf('person')).toEqual({});
    expect(storedKindOf('person')).toBe('person');
    // The plain kind once the option is off.
    expect(pickOf({ kind: 'person' })).toBe('person');
    expect(pickOf({ kind: 'card', multiple: true })).toBe('cards');
    expect(pickOf({ kind: 'calculated', calculation: 'childCount' })).toBe('calculated');
    expect(PICK_KIND_LABELS.people).toBe('Several People');
    // A Several Images field is an Image holding several (item-types.md "Image fields").
    expect(presetOf('images')).toEqual({ multiple: true });
    expect(storedKindOf('images')).toBe('image');
    expect(pickOf({ kind: 'image', multiple: true })).toBe('images');
    expect(pickOf({ kind: 'image' })).toBe('image');
    expect(PICK_KIND_LABELS.images).toBe('Several Images');
    expect(KIND_DESCRIPTIONS.images).toBe('Up to 20 pictures, like a set of designs');
  });
});

describe('searching', () => {
  it('finds a kind by its name, its line or an everyday word', () => {
    // "rat" is in duRATion too.
    expect(found('rat')).toEqual(['duration', 'rating']);
    expect(found('money')).toEqual(['currency']);
    expect(found('stars')).toEqual(['rating']);
    expect(found('yes/no')).toEqual(['checkbox']);
    expect(found('tick')).toEqual(['checkbox', 'checklist']);
    expect(found('parent')).toContain('card');
    expect(found('percent')).toEqual(['percent']);
    expect(found('progress')).toEqual(['percent']);
    expect(found('formula')).toEqual(['formula']);
    expect(found('timer')).toEqual(['time-tracking']);
    expect(found('reviewers')).toEqual(['people']);
    expect(found('blocker')).toEqual(['blocked-by']);
    expect(found('url')).toEqual(['link']);
    expect(found('dropdown')).toEqual(['choice']);
    expect(found('select')).toContain('choice');
    expect(found('  Long   TEXT ')).toEqual(['longtext']);
  });

  it('takes every word of a search found somewhere', () => {
    expect(found('amount money')).toEqual(['currency']);
    expect(found('qwerty')).toEqual([]);
  });

  it('finds every kind with no search, and a kind by its built-ins’ names', () => {
    expect(found('')).toEqual([...PICK_KINDS]);
    expect(found('due')).toEqual(['date']);
    expect(found('assignee')).toEqual(['person']);
    expect(found('priority')).toEqual(['choice']);
    expect(found('photo')).toEqual(['image']);
    expect(found('designs')).toEqual(['images']);
    expect(found('gallery')).toEqual(['images']);
    expect(found('screenshots')).toEqual(['images']);
  });
});

describe('readiness', () => {
  it('asks for a name, then an option, then a linked type', () => {
    expect(kindReadiness({ label: ' ', kind: 'text' })).toBe('name');
    expect(kindReadiness({ label: 'Size', kind: 'text' })).toBeNull();
    expect(kindReadiness({ label: 'Size', kind: 'choice' })).toBe('options');
    expect(kindReadiness({ label: 'Size', kind: 'multichoice', options: ['S'] })).toBeNull();
    expect(kindReadiness({ label: 'Parent', kind: 'card' })).toBe('links');
    expect(kindReadiness({ label: 'Parent', kind: 'card', linkType: 'project' })).toBeNull();
  });
});
