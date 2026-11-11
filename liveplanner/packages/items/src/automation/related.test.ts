import { describe, expect, it } from 'vitest';
import { relatedCards } from './related';
import { BUG, NOTE, OUTLINE, SAM, bug, ctxFor } from './test-fixtures';
import type { ItemTypeDef } from '../item-types';
import type { AutomationOutline } from './outline';
import { item } from '../test-items';
import type { Item } from '../item';

// docs/specs/026-plan/automations.md "For Related Cards": linked, blocked by, blocking, children, a saved filter;
// live cards only, never the card itself, by number, at most 100.
const TASK: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'item',
  color: '#000000',
  fields: ['title', 'status', 'priority', 'f-blocked'],
  custom: [
    {
      id: 'f-blocked',
      label: 'Blocked By',
      kind: 'card',
      blocks: true,
      multiple: true,
      linkType: 'task',
    },
  ],
  statuses: ['todo', 'doing', 'done'],
};
const outline: AutomationOutline = { ...OUTLINE, types: [BUG, NOTE, TASK] };
const ctx = (card: Item) => ({ ...ctxFor(card), outline });
const task = (fields: Record<string, unknown> = {}, extra: Partial<Item> = {}) =>
  item({ title: 'T', status: 'todo', ...fields }, { type: 'task', ...extra });
const keys = (cards: Item[]) => cards.map((c) => c.key);

describe('relatedCards', () => {
  it('finds the cards a Card field points at, one field or any', () => {
    const a = bug();
    const b = bug();
    const n = item(
      { title: 'N', status: 'todo', 'f-links': [a.id, b.id, 'gone'] },
      { type: 'note' },
    );
    const all = [a, b, n];
    expect(keys(relatedCards(n, { kind: 'linked' }, all, ctx(n)).cards)).toEqual([a.key, b.key]);
    expect(relatedCards(n, { kind: 'linked', field: 'f-other' }, all, ctx(n)).cards).toEqual([]);
    const child = bug({ 'f-parent': a.id });
    expect(
      keys(
        relatedCards(child, { kind: 'linked', field: 'f-parent' }, [a, child], ctx(child)).cards,
      ),
    ).toEqual([a.key]);
  });

  it('finds the cards blocking a card and those it blocks', () => {
    const first = task();
    const second = task();
    const blocked = task({ 'f-blocked': [first.id, second.id] });
    const all = [first, second, blocked];
    expect(keys(relatedCards(blocked, { kind: 'blocked_by' }, all, ctx(blocked)).cards)).toEqual([
      first.key,
      second.key,
    ]);
    expect(keys(relatedCards(first, { kind: 'blocking' }, all, ctx(first)).cards)).toEqual([
      blocked.key,
    ]);
    expect(relatedCards(first, { kind: 'blocked_by' }, all, ctx(first)).cards).toEqual([]);
    expect(relatedCards(blocked, { kind: 'blocking' }, all, ctx(blocked)).cards).toEqual([]);
  });

  it('finds a card’s children', () => {
    const parent = bug();
    const kids = [bug({ 'f-parent': parent.id }), bug({ 'f-parent': parent.id })];
    const r = relatedCards(parent, { kind: 'children' }, [parent, ...kids], ctx(parent));
    expect(keys(r.cards)).toEqual(keys(kids));
  });

  it('finds every card a saved filter matches, as whoever triggered it sees it', () => {
    const me = bug({ assignee: SAM });
    const mine = bug({ assignee: SAM });
    const theirs = bug();
    const r = relatedCards(
      me,
      { kind: 'saved_filter', tab: 't1', filter: 'sf-mine' },
      [me, mine, theirs],
      ctx(me),
    );
    expect(keys(r.cards)).toEqual([mine.key]);
  });

  it('leaves out trashed and archived cards and the card itself, sorts by number, caps at 100', () => {
    const parent = bug();
    const trashed = bug({ 'f-parent': parent.id, status: 'trash' });
    const archived = bug({ 'f-parent': parent.id, archived: true });
    const kids = Array.from({ length: 120 }, (_, i) =>
      bug({ 'f-parent': parent.id }, { key: 1000 - i }),
    );
    const self = { ...parent, fields: { ...parent.fields, 'f-parent': parent.id } };
    const r = relatedCards(
      self,
      { kind: 'children' },
      [self, trashed, archived, ...kids],
      ctx(self),
    );
    expect(r.total).toBe(120);
    expect(r.cards).toHaveLength(100);
    expect(r.cards[0]!.key).toBe(881);
    expect(
      r.cards.some((c) => c.id === parent.id || c.id === trashed.id || c.id === archived.id),
    ).toBe(false);
  });
});

describe('relatedCards, a type with no custom fields', () => {
  it('finds no linked cards', () => {
    const bare: ItemTypeDef = { ...TASK, id: 'bare', fields: ['title'], custom: undefined };
    const card = item({ title: 'B' }, { type: 'bare' });
    const o = { ...outline, types: [...outline.types, bare] };
    expect(
      relatedCards(card, { kind: 'linked' }, [card], { ...ctxFor(card), outline: o }).cards,
    ).toEqual([]);
  });
});
