import { describe, expect, it } from 'vitest';
import type { Item } from '../item';
import type { ItemTypeDef } from '../item-types';
import { item, SAM } from '../test-items';
import { derivedTargets, isDerivedTrigger } from './derived';
import type { AutomationEvent } from './matches';

// docs/specs/026-plan/automations.md "Triggers": Card Unblocked, Related Cards Done and Column Over Limit, worked out
// from the plan's cards when another card moves or is archived.
const TASK: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'item',
  color: '#2563eb',
  fields: ['title', 'status', 'f-blocked', 'f-parent', 'f-links'],
  custom: [
    { id: 'f-blocked', label: 'Blocked By', kind: 'card', multiple: true, blocks: true },
    { id: 'f-parent', label: 'Parent', kind: 'card', linkType: 'task' },
    { id: 'f-links', label: 'Links', kind: 'card', multiple: true },
    { id: 'f-off', label: 'Off the type', kind: 'card' },
  ],
  statuses: ['todo', 'doing', 'done'],
};
const TYPES = [TASK];
const isDone = (s: string | undefined) => s === 'done';
const name = (c: Item) => c.fields['title'];
const task = (title: string, fields: Record<string, unknown> = {}): Item =>
  item({ title, status: 'todo', ...fields }, { type: 'task' });
const moved = (card: Item, from: string, to: string): AutomationEvent => ({
  id: `${card.id}:2`,
  kind: 'moved',
  cardId: card.id,
  by: SAM,
  role: 'editor',
  from,
  to,
  at: 1,
});

describe('derived triggers', () => {
  it('knows which triggers are worked out at run time', () => {
    expect(isDerivedTrigger({ kind: 'card_unblocked' })).toBe(true);
    expect(isDerivedTrigger({ kind: 'related_done', related: 'linked' })).toBe(true);
    expect(isDerivedTrigger({ kind: 'column_limit', status: 'doing', limit: 2 })).toBe(true);
    expect(isDerivedTrigger({ kind: 'card_moved' })).toBe(false);
  });

  it('answers nothing for a card the plan no longer holds', () => {
    const gone = task('Gone');
    expect(
      derivedTargets({ kind: 'card_unblocked' }, moved(gone, 'doing', 'done'), [], TYPES, isDone),
    ).toEqual([]);
  });

  it('Card Unblocked: the cards the finished one blocked that have no open blocker left', () => {
    const a = task('A', { status: 'done' });
    const b = task('B');
    const free = task('Free', { 'f-blocked': [a.id] });
    const still = task('Still', { 'f-blocked': [a.id, b.id] });
    const items = [a, b, free, still];
    const fire = (e: AutomationEvent) =>
      derivedTargets({ kind: 'card_unblocked' }, e, items, TYPES, isDone).map(name);
    expect(fire(moved(a, 'doing', 'done'))).toEqual(['Free']);
    // Done to done, or into an open column, finishes nothing.
    expect(fire(moved(a, 'done', 'done'))).toEqual([]);
    expect(fire(moved(b, 'todo', 'doing'))).toEqual([]);
    // Archiving a blocker frees what it blocked.
    const archivedA = { ...a, fields: { ...a.fields, status: 'doing', archived: true } } as Item;
    expect(
      derivedTargets(
        { kind: 'card_unblocked' },
        { ...moved(a, 'doing', 'doing'), kind: 'archived' },
        [archivedA, b, free, still],
        TYPES,
        isDone,
      ).map(name),
    ).toEqual(['Free']);
    // Archiving a blocker already done frees nothing again: it unblocked them when it finished.
    const archivedDoneA = { ...a, fields: { ...a.fields, archived: true } } as Item;
    expect(
      derivedTargets(
        { kind: 'card_unblocked' },
        { ...moved(a, 'done', 'done'), kind: 'archived' },
        [archivedDoneA, b, free, still],
        TYPES,
        isDone,
      ),
    ).toEqual([]);
    // A card with no one it blocks answers nothing.
    expect(fire(moved(free, 'doing', 'done'))).toEqual([]);
  });

  it('Related Cards Done (children): the parent once all its live children are done', () => {
    const parent = task('Parent');
    const doneParent = task('Done parent', { status: 'done' });
    const one = task('One', { status: 'done', 'f-parent': parent.id });
    const two = task('Two', { status: 'done', 'f-parent': parent.id });
    const open = task('Open', { 'f-parent': doneParent.id });
    const last = task('Last', { status: 'done', 'f-parent': doneParent.id });
    const items = [parent, doneParent, one, two, open, last];
    const fire = (card: Item, all = items) =>
      derivedTargets(
        { kind: 'related_done', related: 'children' },
        moved(card, 'doing', 'done'),
        all,
        TYPES,
        isDone,
      ).map(name);
    expect(fire(two)).toEqual(['Parent']);
    // Not every child is done.
    expect(
      fire(one, [parent, one, { ...two, fields: { ...two.fields, status: 'doing' } }]),
    ).toEqual([]);
    // A parent already done is left alone.
    expect(fire(last)).toEqual([]);
    // A move that is not into done starts nothing.
    expect(
      derivedTargets(
        { kind: 'related_done', related: 'children' },
        moved(two, 'todo', 'doing'),
        items,
        TYPES,
        isDone,
      ),
    ).toEqual([]);
  });

  it('Related Cards Done (linked): the cards whose Card fields point at only done cards', () => {
    const a = task('A', { status: 'done' });
    const b = task('B', { status: 'done' });
    const holder = task('Holder', { 'f-links': [a.id, b.id, 'missing'] });
    const c = task('C');
    const waiting = task('Waiting', { 'f-links': [a.id, c.id] });
    const self = task('Self', { 'f-links': [a.id] });
    const items = [
      a,
      b,
      c,
      holder,
      waiting,
      self,
      { ...waiting, id: 'w2', fields: { ...waiting.fields, 'f-links': [] } } as Item,
    ];
    expect(
      derivedTargets(
        { kind: 'related_done', related: 'linked' },
        moved(a, 'doing', 'done'),
        items,
        TYPES,
        isDone,
      ).map(name),
    ).toEqual(['Holder', 'Self']);
  });

  it('Column Over Limit: the card that takes its column exactly one past the limit', () => {
    const cards = [
      task('1', { status: 'doing' }),
      task('2', { status: 'doing' }),
      task('3', { status: 'doing' }),
    ];
    const trigger = { kind: 'column_limit' as const, status: 'doing', limit: 2 };
    const e = moved(cards[2]!, 'todo', 'doing');
    expect(derivedTargets(trigger, e, cards, TYPES, isDone).map(name)).toEqual(['3']);
    // Two past: it went over already.
    expect(
      derivedTargets(trigger, e, [...cards, task('4', { status: 'doing' })], TYPES, isDone),
    ).toEqual([]);
    // The card is no longer in the column.
    const left = { ...cards[2]!, fields: { ...cards[2]!.fields, status: 'todo' } } as Item;
    expect(derivedTargets(trigger, e, [cards[0]!, cards[1]!, left], TYPES, isDone)).toEqual([]);
  });
});
