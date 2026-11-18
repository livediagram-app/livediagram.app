// A card found by its number in every form, "#12", "12" and "WI-12", wherever people or agents name one, and named
// with its type's prefix (docs/specs/026-plan/item-types.md "Card number prefixes").
import { describe, expect, it } from 'vitest';
import { cardMatches, findCards } from './card-finder';
import { resolveItemRef } from './refs';
import { resolveItem } from './plan-names';
import { quickFilterMatches } from './board';
import { itemAccessibleName, itemNumberedTitle, itemSummary } from './views';
import { prefixOf } from './card-prefix';
import { defaultCatalogue } from './type-catalogue';
import { item } from './test-items';

const types = defaultCatalogue().types;
const card = item(
  { title: 'Fix login', status: 'todo' },
  { id: 'card-100', key: 100, type: 'task' },
);
const other = item(
  { title: 'Plan launch', status: 'todo' },
  { id: 'card-101', key: 101, type: 'project' },
);
const FORMS = ['100', '#100', 'T-100', 't-100', '#T-100', 'WI-100'];

describe('finding a card by its number', () => {
  it('reads every form in resolveItemRef, as the MCP and the CLI do', () => {
    for (const ref of FORMS)
      expect(resolveItemRef([card, other], ref)).toEqual({ ok: true, item: card });
    expect(resolveItemRef([card, other], 'P-101')).toEqual({ ok: true, item: other });
  });

  it('reads every form, and a card link with its title, in resolveItem', () => {
    for (const ref of FORMS)
      expect(resolveItem(ref, [card, other])).toMatchObject({ ok: true, item: card });
    expect(resolveItem('T-100 Fix login', [card, other])).toMatchObject({ ok: true, item: card });
    expect(resolveItem('#100 Fix login', [card, other])).toMatchObject({ ok: true, item: card });
  });

  it('reads every form in a search, and the prefix alone finds its type’s cards', () => {
    for (const q of FORMS) expect(cardMatches(card, q, 'Task', 'T')).toBe(true);
    expect(cardMatches(card, 't', 'Task', 'T')).toBe(true);
    expect(cardMatches(card, 'P', 'Task', 'T')).toBe(false);
    const found = findCards([card, other], {
      query: 'p',
      show: 'all',
      boardStatuses: new Map(),
      typePrefix: (id) => prefixOf(types, id),
    });
    expect(found.map((c) => c.id)).toEqual(['card-101']);
  });

  it('reads every form in a board’s quick filter', () => {
    for (const text of FORMS) expect(quickFilterMatches({ text }, card, types)).toBe(true);
    expect(quickFilterMatches({ text: 'T-101' }, card, types)).toBe(false);
  });
});

describe('naming a card', () => {
  it('reads its type’s prefix with its number, #N without a catalogue', () => {
    expect(itemNumberedTitle(card, types)).toBe('T-100 Fix login');
    expect(itemNumberedTitle(card)).toBe('#100 Fix login');
    expect(itemSummary(card, types)).toBe('T-100 [task] Fix login');
    expect(itemSummary(card)).toBe('#100 [task] Fix login');
    expect(itemAccessibleName(card, types)).toMatch(/^T-100 Fix login, Task/);
  });

  it('names several matches with their numbers when a ref is ambiguous', () => {
    const twin = { ...card, id: 'card-100b' };
    const r = resolveItem('card-1', [card, twin]);
    expect(r.ok).toBe(false);
  });
});
