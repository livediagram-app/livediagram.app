import { describe, expect, it } from 'vitest';
import { approvalStatus, isApprovalDay, parseApprovalNotice } from './approvals';

const notice = {
  type: 'approval_requested',
  approvalId: 'ap_1',
  requesterId: 'user_a',
  requesterName: 'Ada',
  approverIds: ['user_b', 'user_c'],
  itemTitle: 'Roadmap',
  note: 'Check the dates',
  due: '2026-11-20',
};

describe('approvalStatus', () => {
  const people = (...d: ('pending' | 'approved' | 'changes_requested')[]) =>
    d.map((decision) => ({ decision }));
  it('says nothing for a cancelled request', () => {
    expect(approvalStatus({ state: 'cancelled', closedAt: 5, approvers: [] }, null)).toBeNull();
  });
  it('awaits while open, unless someone asked for changes', () => {
    expect(
      approvalStatus(
        { state: 'open', closedAt: null, approvers: people('approved', 'pending') },
        9,
      ),
    ).toBe('awaiting');
    expect(
      approvalStatus(
        { state: 'open', closedAt: null, approvers: people('approved', 'changes_requested') },
        9,
      ),
    ).toBe('changes_requested');
  });
  it('is approved until the content is saved after the last approval', () => {
    const done = { state: 'approved' as const, closedAt: 100, approvers: people('approved') };
    expect(approvalStatus(done, null)).toBe('approved');
    expect(approvalStatus(done, 100)).toBe('approved');
    expect(approvalStatus(done, 99)).toBe('approved');
    expect(approvalStatus(done, 101)).toBe('changed');
  });
});

describe('isApprovalDay', () => {
  it('takes real days only', () => {
    expect(isApprovalDay('2026-11-20')).toBe(true);
    expect(isApprovalDay('2028-02-29')).toBe(true);
    expect(isApprovalDay('2026-02-31')).toBe(false);
    expect(isApprovalDay('2026-13-01')).toBe(false);
    expect(isApprovalDay('2026/11/20')).toBe(false);
    expect(isApprovalDay('2026-1a-20')).toBe(false);
    expect(isApprovalDay('20261120')).toBe(false);
    expect(isApprovalDay(20261120)).toBe(false);
  });
});

describe('parseApprovalNotice', () => {
  it('reads a well-formed notice', () => {
    expect(parseApprovalNotice(notice)).toEqual(notice);
  });
  it('reads a notice without a name, note or due day', () => {
    expect(
      parseApprovalNotice({ ...notice, requesterName: null, note: undefined, due: null }),
    ).toEqual({ ...notice, requesterName: null, note: null, due: null });
  });
  it('refuses anything else', () => {
    for (const bad of [
      null,
      'x',
      { ...notice, type: 'shared' },
      { ...notice, approvalId: '' },
      { ...notice, requesterId: 7 },
      { ...notice, approverIds: [] },
      { ...notice, approverIds: 'user_b' },
      { ...notice, approverIds: Array.from({ length: 11 }, (_, i) => `user_${i}`) },
      { ...notice, approverIds: [''] },
      { ...notice, itemTitle: 3 },
      { ...notice, itemTitle: 'x'.repeat(501) },
      { ...notice, note: 'x'.repeat(501) },
      { ...notice, requesterName: 5 },
      { ...notice, due: '2026-02-31' },
    ]) {
      expect(parseApprovalNotice(bad)).toBeNull();
    }
  });
});
