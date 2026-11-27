import { describe, expect, it } from 'vitest';
import { item } from './test-items';
import type { ItemTypeDef } from './item-types';
import {
  SESSION_REASON_MAX,
  duplicateFieldOf,
  sessionCloseTarget,
  sessionReason,
} from './session-triage';

// docs/specs/026-plan/session-tabs.md "Bug Triage": where Close takes a card, the field a duplicate links through,
// and a reason as kept.
const bug: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'bug',
  color: '#dc2626',
  fields: ['title', 'status', 'priority', 'f-sev', 'f-impact', 'f-area', 'f-dup', 'f-parent'],
  statuses: ['new', 'confirmed', 'closed', 'wont-fix', 'duplicate'],
  custom: [
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['Low', 'High'] },
    { id: 'f-impact', label: 'Customer Impact', kind: 'choice', options: ['Some', 'All'] },
    { id: 'f-area', label: 'Area', kind: 'choice', options: ['Web'] },
    { id: 'f-empty', label: 'Urgency', kind: 'choice', options: [] },
    { id: 'f-dup', label: 'Duplicate Of', kind: 'card', linkType: 'bug' },
    { id: 'f-parent', label: 'Parent', kind: 'card', linkType: 'epic' },
    { id: 'f-off', label: 'Duplicates', kind: 'card', linkType: 'bug' },
  ],
};
const PLAN = ['new', 'confirmed', 'closed', 'wont-fix', 'duplicate'];
const NAMES = new Map([
  ['new', 'New'],
  ['confirmed', 'Confirmed'],
  ['closed', 'Closed'],
  ['wont-fix', 'Won’t Fix'],
  ['duplicate', 'Duplicate'],
]);
const card = (status: string) => item({ title: 'B', status }, { type: 'bug' });

describe('sessionCloseTarget', () => {
  it('prefers Won’t Fix over Closed, whatever their order', () => {
    expect(sessionCloseTarget(card('new'), [bug], PLAN, undefined, { names: NAMES })).toBe(
      'wont-fix',
    );
  });

  it('takes a Duplicate stage when a duplicate is linked', () => {
    expect(
      sessionCloseTarget(card('new'), [bug], PLAN, undefined, { names: NAMES, duplicate: true }),
    ).toBe('duplicate');
    const noDup = { ...bug, statuses: ['new', 'wont-fix'] };
    expect(
      sessionCloseTarget(card('new'), [noDup], PLAN, undefined, { names: NAMES, duplicate: true }),
    ).toBe('wont-fix');
  });

  it('takes the set-up’s stage for the type when the type uses it, over a duplicate’s', () => {
    expect(
      sessionCloseTarget(card('new'), [bug], PLAN, { bug: 'closed' }, { duplicate: true }),
    ).toBe('closed');
    // A stage the type does not use falls back to the close stage (here read by id alone: wont-fix is Won't Fix).
    expect(sessionCloseTarget(card('new'), [bug], PLAN, { bug: 'gone' })).toBe('wont-fix');
  });

  it('stays when the card is already there, or the type has no closing stage', () => {
    expect(sessionCloseTarget(card('wont-fix'), [bug], PLAN, undefined, { names: NAMES })).toBe(
      null,
    );
    expect(sessionCloseTarget(card('new'), [bug], PLAN, { bug: 'new' })).toBeNull();
    const open = { ...bug, statuses: ['new', 'confirmed'] };
    expect(sessionCloseTarget(card('new'), [open], PLAN)).toBeNull();
  });
});

describe('duplicateFieldOf', () => {
  it('finds the type’s Card field named like a duplicate that links to the duplicate’s type', () => {
    expect(duplicateFieldOf(bug, 'bug')?.id).toBe('f-dup');
    expect(duplicateFieldOf(bug, 'epic')).toBeUndefined();
    // A field the type has dropped from its fields is not offered.
    const dropped = { ...bug, fields: bug.fields.filter((f) => f !== 'f-dup') };
    expect(duplicateFieldOf(dropped, 'bug')).toBeUndefined();
    expect(duplicateFieldOf({ ...bug, custom: undefined }, 'bug')).toBeUndefined();
  });
});

describe('sessionReason', () => {
  it('keeps a trimmed reason up to the limit, and none for empty or not text', () => {
    expect(sessionReason('  Can’t reproduce ')).toBe('Can’t reproduce');
    expect(sessionReason('x'.repeat(SESSION_REASON_MAX + 5))).toHaveLength(SESSION_REASON_MAX);
    expect(sessionReason('   ')).toBeUndefined();
    expect(sessionReason(4)).toBeUndefined();
  });
});
