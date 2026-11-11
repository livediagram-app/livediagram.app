import { describe, expect, it } from 'vitest';
import { historyChangesOf } from '../item-history';
import { eventOfWrite, triggerMatches, TRIGGER_EVENT_KINDS, type AutomationEvent } from './matches';
import { ALI, SAM, bug } from './test-fixtures';
import type { Item } from '../item';

// docs/specs/026-plan/automations.md "Triggers"; blueprint "The event".
const after = (before: Item, fields: Record<string, unknown>): Item => ({
  ...before,
  fields: { ...before.fields, ...fields } as Item['fields'],
  rev: before.rev + 1,
  updatedBy: ALI,
  updatedAt: 99,
});
const eventOf = (before: Item | null, next: Item, source = { role: 'editor' as const }) =>
  eventOfWrite(before, next, historyChangesOf(before, next), source);

describe('eventOfWrite', () => {
  it('makes a created event with the status it was made in and its Form tab', () => {
    const card = bug();
    expect(eventOf(null, card)).toMatchObject({
      kind: 'created',
      to: 'todo',
      by: SAM,
      id: `${card.id}:1`,
    });
    expect(
      eventOfWrite(null, bug({ status: undefined }), [{ kind: 'created' }], {
        role: 'system',
        form: 'form1',
      }),
    ).toMatchObject({ kind: 'created', form: 'form1' });
    expect(
      eventOfWrite(null, bug({ status: undefined }), [{ kind: 'created' }], { role: 'system' }),
    ).not.toHaveProperty('to');
  });

  it('makes a moved event, with the fields that changed alongside', () => {
    const card = bug();
    expect(eventOf(card, after(card, { status: 'done', priority: 'high' }))).toMatchObject({
      kind: 'moved',
      from: 'todo',
      to: 'done',
      fields: ['priority'],
      by: ALI,
      at: 99,
    });
    const unplaced = bug({ status: undefined });
    const e = eventOf(unplaced, after(unplaced, { status: 'done' }))!;
    expect(e).not.toHaveProperty('from');
    expect(e).not.toHaveProperty('fields');
    const out = eventOf(card, {
      ...after(card, {}),
      fields: { ...card.fields, status: undefined } as never,
    })!;
    expect(out).not.toHaveProperty('to');
  });

  it('makes a changed event naming the fields, a flag as flagged', () => {
    const card = bug();
    expect(eventOf(card, after(card, { flagged: true, labels: ['a'] }))).toMatchObject({
      kind: 'changed',
      fields: expect.arrayContaining(['flagged', 'labels']),
    });
    expect(eventOf(card, after(card, { 'f-severity': undefined }))?.fields).toEqual(['f-severity']);
  });

  it('carries the rule and chain of a change a rule made', () => {
    const card = bug();
    const e = eventOfWrite(
      card,
      after(card, { labels: ['a'] }),
      historyChangesOf(card, after(card, { labels: ['a'] })),
      {
        role: 'automation',
        rule: 'r1',
        chain: 2,
      },
    );
    expect(e).toMatchObject({ rule: 'r1', chain: 2, role: 'automation' });
    const unchained = eventOfWrite(
      card,
      after(card, { labels: ['b'] }),
      [{ kind: 'set', field: 'labels' }],
      {
        role: 'automation',
        rule: 'r1',
      },
    );
    expect(unchained?.chain).toBe(0);
  });

  it('makes nothing for the Trash, the Archive, a type change alone or nothing changed', () => {
    const card = bug();
    expect(eventOf(card, after(card, { status: 'trash', trashedFrom: 'todo' }))).toBeNull();
    expect(eventOf(card, after(card, { archived: true }))).toBeNull();
    expect(
      eventOfWrite(card, after(card, {}), [{ kind: 'type', from: 'bug', to: 'note' }], {
        role: 'editor',
      }),
    ).toBeNull();
  });
});

const ev = (e: Partial<AutomationEvent>): AutomationEvent => ({
  id: 'e',
  kind: 'changed',
  cardId: 'c',
  by: SAM,
  role: 'editor',
  at: 0,
  ...e,
});

describe('triggerMatches', () => {
  it('hears a card made, in a column when it names one, form cards too', () => {
    expect(triggerMatches({ kind: 'card_created' }, ev({ kind: 'created' }), 'r')).toBe(true);
    expect(
      triggerMatches(
        { kind: 'card_created', status: 'todo' },
        ev({ kind: 'created', to: 'done' }),
        'r',
      ),
    ).toBe(false);
    expect(triggerMatches({ kind: 'card_created' }, ev({ kind: 'created', form: 'f' }), 'r')).toBe(
      true,
    );
    expect(triggerMatches({ kind: 'card_created' }, ev({ kind: 'moved' }), 'r')).toBe(false);
  });

  it('hears only form cards for Form Response, from one tab when it names one', () => {
    expect(triggerMatches({ kind: 'form_response' }, ev({ kind: 'created' }), 'r')).toBe(false);
    expect(triggerMatches({ kind: 'form_response' }, ev({ kind: 'created', form: 'f' }), 'r')).toBe(
      true,
    );
    expect(
      triggerMatches(
        { kind: 'form_response', formTab: 'g' },
        ev({ kind: 'created', form: 'f' }),
        'r',
      ),
    ).toBe(false);
    expect(triggerMatches({ kind: 'form_response' }, ev({ kind: 'moved', form: 'f' }), 'r')).toBe(
      false,
    );
  });

  it('hears a move from and to the columns it names', () => {
    const t = { kind: 'card_moved' as const, from: ['todo'], to: ['done'] };
    expect(triggerMatches(t, ev({ kind: 'moved', from: 'todo', to: 'done' }), 'r')).toBe(true);
    expect(triggerMatches(t, ev({ kind: 'moved', from: 'doing', to: 'done' }), 'r')).toBe(false);
    expect(triggerMatches(t, ev({ kind: 'moved', to: 'done' }), 'r')).toBe(false);
    expect(triggerMatches(t, ev({ kind: 'moved', from: 'todo' }), 'r')).toBe(false);
    expect(triggerMatches({ kind: 'card_moved' }, ev({ kind: 'moved' }), 'r')).toBe(true);
    expect(
      triggerMatches({ kind: 'card_moved', from: [], to: [] }, ev({ kind: 'changed' }), 'r'),
    ).toBe(false);
  });

  it('hears a change to one of its fields, in a move too', () => {
    const t = { kind: 'field_changed' as const, fields: ['priority'] };
    expect(triggerMatches(t, ev({ fields: ['labels', 'priority'] }), 'r')).toBe(true);
    expect(triggerMatches(t, ev({ kind: 'moved', fields: ['priority'] }), 'r')).toBe(true);
    expect(triggerMatches(t, ev({ kind: 'moved' }), 'r')).toBe(false);
    expect(triggerMatches(t, ev({ kind: 'created', fields: ['priority'] }), 'r')).toBe(false);
  });

  it('hears comments, and a manual run of this rule alone', () => {
    expect(triggerMatches({ kind: 'comment_added' }, ev({ kind: 'comment' }), 'r')).toBe(true);
    expect(triggerMatches({ kind: 'comment_added' }, ev({}), 'r')).toBe(false);
    expect(triggerMatches({ kind: 'manual' }, ev({ kind: 'manual', ruleId: 'r' }), 'r')).toBe(true);
    expect(triggerMatches({ kind: 'manual' }, ev({ kind: 'manual', ruleId: 's' }), 'r')).toBe(
      false,
    );
  });

  it('lists the event kinds each trigger hears', () => {
    expect(TRIGGER_EVENT_KINDS.field_changed).toEqual(['changed', 'moved']);
  });
});
