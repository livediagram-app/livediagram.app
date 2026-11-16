// Approvals in an item's History and a team's Audit Log (approvals.md "History and the audit log").
import { describe, expect, it } from 'vitest';
import type { ItemEvent, TeamAuditEvent } from '@liveworkspace/index-client';
import { auditDetail, auditSentence } from '../explorer/audit/rows';
import { CATEGORY_LABELS, eventCategory, eventLabel, eventTone } from '../library/history-model';
import { eventWords } from '../library/history-render';

const item = (type: ItemEvent['type'], detail: Record<string, string | null> = {}): ItemEvent => ({
  id: 'e',
  app: 'livedesign',
  type,
  actorId: 'user_a',
  actorName: 'Ada',
  itemId: 'i1',
  title: 'Logo',
  detail,
  occurredAt: 1,
  item: null,
});
const audit = (
  type: TeamAuditEvent['type'],
  detail: Record<string, string | null> = {},
): TeamAuditEvent => ({
  id: 'e',
  type,
  app: 'livedesign',
  actor: { id: 'user_a', name: 'Ada' },
  subject: null,
  itemId: 'i1',
  title: 'Logo',
  detail,
  occurredAt: 1,
});
const words = (e: ItemEvent) => eventWords(e, null, () => null);

describe('approvals in History', () => {
  it('labels each step under the Approvals filter', () => {
    expect(eventLabel(item('approval_requested'))).toBe('Approval Requested');
    expect(eventLabel(item('approval_approved'))).toBe('Approved');
    expect(eventLabel(item('approval_changes_requested'))).toBe('Changes Requested');
    expect(eventLabel(item('approval_cancelled'))).toBe('Approval Cancelled');
    expect(eventLabel(item('approval_cancelled', { replaced: 'true' }))).toBe(
      'Approval Asked Again',
    );
    expect(eventCategory('approval_approved')).toBe('approvals');
    expect(CATEGORY_LABELS.approvals).toBe('Approvals');
    expect(eventTone('approval_approved')).toBe('create');
  });

  it('says how many were asked, by when, and quotes the notes', () => {
    expect(words(item('approval_requested', { approvers: '1', due: null })).detail).toBe(
      'From 1 person',
    );
    expect(words(item('approval_requested', { approvers: '3', due: '2026-12-01' })).detail).toMatch(
      /^From 3 people, by /,
    );
    expect(words(item('approval_requested', {})).detail).toBeNull();
    expect(words(item('approval_approved', { note: 'Fine', complete: 'true' }))).toEqual({
      detail: 'Approved by everyone',
      quote: 'Fine',
    });
    expect(words(item('approval_approved', {}))).toEqual({ detail: null, quote: null });
    expect(words(item('approval_changes_requested', { note: 'Fix' })).quote).toBe('Fix');
    expect(words(item('approval_changes_requested', {})).quote).toBeNull();
  });
});

describe('approvals in the Audit Log', () => {
  it('says who did what to which item', () => {
    const line = (t: TeamAuditEvent['type']) => auditSentence(audit(t), 'team_1').action;
    expect(line('approval_requested')).toBe('asked for approval of');
    expect(line('approval_approved')).toBe('approved');
    expect(line('approval_changes_requested')).toBe('requested changes to');
    expect(line('approval_cancelled')).toBe('cancelled the approval request on');
  });

  it('gives the detail that matters', () => {
    expect(auditDetail(audit('approval_requested', { approvers: '1' }))).toBe('1 approver');
    expect(auditDetail(audit('approval_requested', { approvers: '4' }))).toBe('4 approvers');
    expect(auditDetail(audit('approval_requested'))).toBeNull();
    expect(auditDetail(audit('approval_approved', { complete: 'true' }))).toBe(
      'Approved by everyone',
    );
    expect(auditDetail(audit('approval_approved'))).toBeNull();
    expect(auditDetail(audit('approval_cancelled', { replaced: 'true' }))).toBe('Asked again');
    expect(auditDetail(audit('approval_cancelled'))).toBeNull();
  });
});
