import { describe, expect, it } from 'vitest';
import { BUILT_IN_FIELD_IDS, CUSTOM_FIELD_KINDS } from '@liveplanner/items';
import {
  BUILT_INS_OF_KIND,
  BUILT_IN_ROLES,
  KIND_ALIASES,
  KIND_DESCRIPTIONS,
  KIND_GROUPS,
  groupOfKind,
  kindMatches,
  kindReadiness,
  readyBuiltIns,
  searchKey,
  type PickKind,
} from './add-field-kinds';
import { BUILT_IN_FIELD_LABELS, PICK_KIND_LABELS } from './ItemTypeFieldForms';

// docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field's groups, lines, words and readiness.
const PICK_KINDS: readonly PickKind[] = CUSTOM_FIELD_KINDS;
const found = (query: string): PickKind[] =>
  PICK_KINDS.filter((k) =>
    kindMatches(
      k,
      PICK_KIND_LABELS[k],
      searchKey(query),
      (BUILT_INS_OF_KIND[k] ?? []).map((id) => BUILT_IN_FIELD_LABELS[id]),
    ),
  );

describe('the kinds’ groups', () => {
  it('holds every kind once, built-in and custom alike, in six groups', () => {
    expect(KIND_GROUPS.map((g) => g.label)).toEqual([
      'Text & links',
      'Numbers & dates',
      'Choices',
      'People & teamwork',
      'Colour & images',
      'Linked cards',
    ]);
    const grouped = KIND_GROUPS.flatMap((g) => g.kinds);
    expect([...grouped].sort()).toEqual([...PICK_KINDS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(KIND_GROUPS.find((g) => g.id === 'cards')!.kinds).toEqual(['card', 'calculated']);
    expect(groupOfKind('rating')).toBe('numbers');
    expect(groupOfKind('image')).toBe('look');
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

describe('searching', () => {
  it('finds a kind by its name, its line or an everyday word', () => {
    expect(found('rat')).toEqual(['rating']);
    expect(found('money')).toEqual(['currency']);
    expect(found('stars')).toEqual(['rating']);
    expect(found('yes/no')).toEqual(['checkbox']);
    expect(found('tick')).toEqual(['checkbox', 'checklist']);
    expect(found('parent')).toContain('card');
    expect(found('percent')).toEqual(['calculated']);
    expect(found('progress')).toEqual(['calculated']);
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
