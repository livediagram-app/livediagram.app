import { describe, expect, it } from 'vitest';
import type { Approval } from '@liveworkspace/index-client';
import {
  badgeSummary,
  decidedWords,
  dueWords,
  isOverdue,
  personName,
  statusWords,
  todayKey,
} from './approval-words';
import { filterNameable, mergeNameable } from './approval-people';

const NOW = new Date(2026, 10, 16, 12).getTime();

function approvalOf(over: Partial<Approval> = {}): Approval {
  return {
    id: 'ap_1',
    itemId: 'i1',
    state: 'open',
    status: 'awaiting',
    requestedBy: { id: 'user_a', name: 'Ada' },
    note: null,
    due: null,
    snapshotId: null,
    createdAt: NOW - 1000,
    closedAt: null,
    approved: 1,
    approvers: [
      { id: 'user_b', name: 'Bo', decision: 'approved', note: null, decidedAt: NOW },
      { id: 'user_c', name: null, decision: 'pending', note: null, decidedAt: null },
      { id: 'deleted', name: null, decision: 'changes_requested', note: 'x', decidedAt: NOW },
    ],
    ...over,
  };
}

describe('approval words', () => {
  it('reads the status pill for every status, and none without one', () => {
    expect(statusWords(approvalOf())).toEqual({ label: 'Awaiting 1 of 3', tone: 'awaiting' });
    expect(statusWords(approvalOf({ status: 'changes_requested' }))?.tone).toBe('changes');
    expect(statusWords(approvalOf({ status: 'approved' }))?.label).toBe('Approved');
    expect(statusWords(approvalOf({ status: 'changed' }))?.label).toBe('Changed Since Approval');
    expect(statusWords(approvalOf({ status: null }))).toBeNull();
    expect(statusWords(null)).toBeNull();
  });

  it('says a due day, its year only when it is not this one, and when it has passed', () => {
    expect(todayKey(NOW)).toBe('2026-11-16');
    expect(dueWords('2026-11-20', NOW)).not.toContain('2026');
    expect(dueWords('2027-01-02', NOW)).toContain('2027');
    expect(isOverdue('2026-11-15', NOW)).toBe(true);
    expect(isOverdue('2026-11-16', NOW)).toBe(false);
    expect(isOverdue(null, NOW)).toBe(false);
  });

  it('names people, a closed account and someone unnamed', () => {
    expect(personName({ id: 'user_b', name: ' Bo ' })).toBe('Bo');
    expect(personName({ id: 'user_c', name: null })).toBe('A teammate');
    expect(personName({ id: 'deleted', name: null })).toBe('A closed account');
  });

  it('sums up the request for the badge’s card', () => {
    expect(badgeSummary(approvalOf({ due: '2026-11-10' }), NOW)).toMatch(
      /^Asked by Ada\. Due .*, Overdue\. Approved: Bo\. Changes Requested: A closed account\. Waiting: A teammate$/,
    );
    expect(badgeSummary(approvalOf({ due: '2026-12-01', state: 'approved' }), NOW)).not.toContain(
      'Due',
    );
    expect(badgeSummary(approvalOf({ due: '2026-12-01' }), NOW)).not.toContain('Overdue');
  });

  it('says what its reader answered', () => {
    const a = approvalOf();
    expect(decidedWords(a, 'user_b')).toBe('You approved this. Waiting on 2 more.');
    expect(decidedWords(a, 'deleted')).toBe('You asked for changes.');
    expect(decidedWords(a, 'user_c')).toBeNull();
    expect(decidedWords(a, 'user_z')).toBeNull();
    expect(decidedWords(approvalOf({ state: 'approved' }), 'user_b')).toBe(
      'You approved this. Everyone has approved.',
    );
  });
});

describe('approval people', () => {
  it('lists the team first, then the owner and link visitors, each once and never the asker', () => {
    const merged = mergeNameable(
      [
        { id: 'user_b', name: 'Bo' },
        { id: 'user_a', name: 'Ada' },
      ],
      [
        { id: 'user_b', name: 'Bo', via: 'link' },
        { id: 'user_o', name: 'Olu', via: 'owner' },
      ],
      'user_a',
    );
    expect(merged).toEqual([
      { id: 'user_b', name: 'Bo', via: 'team' },
      { id: 'user_o', name: 'Olu', via: 'owner' },
    ]);
  });

  it('filters on every word, any case', () => {
    const people = [
      { id: '1', name: 'Ada Lovelace', via: 'team' as const },
      { id: '2', name: 'Bo Diddley', via: 'link' as const },
      { id: '3', name: null, via: 'link' as const },
    ];
    expect(filterNameable(people, '  ').length).toBe(3);
    expect(filterNameable(people, 'love ADA').map((p) => p.id)).toEqual(['1']);
    expect(filterNameable(people, 'zz')).toEqual([]);
  });
});
