import { describe, expect, it } from 'vitest';
import { CUSTOM_FIELD_KINDS, type CustomFieldKind } from '@liveplanner/items';
import {
  KIND_ALIASES,
  KIND_DESCRIPTIONS,
  KIND_GROUPS,
  builtInMatches,
  groupOfKind,
  kindMatches,
  kindReadiness,
  searchKey,
} from './add-field-kinds';
import { CUSTOM_KIND_LABELS } from './ItemTypeFieldForms';

// docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field's groups, lines, words and readiness.
const found = (query: string): CustomFieldKind[] =>
  CUSTOM_FIELD_KINDS.filter((k) => kindMatches(k, CUSTOM_KIND_LABELS[k], searchKey(query)));

describe('the kinds’ groups', () => {
  it('holds every kind once, in the owner’s four groups', () => {
    expect(KIND_GROUPS.map((g) => g.label)).toEqual([
      'Text & links',
      'Numbers & dates',
      'Choices',
      'Linked cards',
    ]);
    const grouped = KIND_GROUPS.flatMap((g) => g.kinds);
    expect([...grouped].sort()).toEqual([...CUSTOM_FIELD_KINDS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(KIND_GROUPS.find((g) => g.id === 'cards')!.kinds).toEqual(['card', 'calculated']);
    expect(groupOfKind('rating')).toBe('numbers');
  });

  it('gives every kind a one-line description and some words', () => {
    for (const k of CUSTOM_FIELD_KINDS) {
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
    expect(found('tick')).toEqual(['checkbox']);
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

  it('finds every kind with no search, and a built-in by its name', () => {
    expect(found('')).toEqual([...CUSTOM_FIELD_KINDS]);
    expect(builtInMatches('Due Date', searchKey('due'))).toBe(true);
    expect(builtInMatches('Assignee', searchKey('date'))).toBe(false);
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
