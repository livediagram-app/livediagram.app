import { describe, expect, it } from 'vitest';
import {
  APPROVAL_NOTE_MAX,
  applyApproval,
  approvalActions,
  approvalRefusal,
  isApprovalAction,
  parseApproval,
  parseKnowledgeFields,
  type ApprovalCaller,
  type PageApproval,
} from './index';

const priya: ApprovalCaller = { account: 'priya', role: 'participate', agent: null };
const sam: ApprovalCaller = { account: 'sam', role: 'edit', agent: null };
const tom: ApprovalCaller = { account: 'tom', role: 'participate', agent: null };
const viewer: ApprovalCaller = { account: 'vic', role: 'view', agent: null };
const guest: ApprovalCaller = { account: null, role: 'participate', agent: null };
const claude: ApprovalCaller = { account: 'priya', role: 'participate', agent: 'Claude' };

const pending: PageApproval = { state: 'pending', requestedBy: 'priya', requestedAt: 10 };

describe('parseApproval', () => {
  it('reads a whole approval and drops what does not belong', () => {
    expect(
      parseApproval({
        state: 'rejected',
        requestedBy: 'priya',
        requestedAt: 10.7,
        requestedByAgent: '  Claude ',
        decidedBy: 'sam',
        decidedAt: 20,
        note: '  Fix the dates. ',
        extra: 1,
      }),
    ).toEqual({
      state: 'rejected',
      requestedBy: 'priya',
      requestedAt: 10,
      requestedByAgent: 'Claude',
      decidedBy: 'sam',
      decidedAt: 20,
      note: 'Fix the dates.',
    });
  });

  it('keeps no decision on a pending page and no note on an approved one', () => {
    expect(parseApproval({ ...pending, decidedBy: 'sam', decidedAt: 3, note: 'x' })).toEqual(
      pending,
    );
    expect(
      parseApproval({ ...pending, state: 'approved', decidedBy: 'sam', decidedAt: 3, note: 'x' }),
    ).toEqual({ ...pending, state: 'approved', decidedBy: 'sam', decidedAt: 3 });
  });

  it('refuses what does not read', () => {
    for (const bad of [
      null,
      'pending',
      { state: 'maybe', requestedBy: 'a', requestedAt: 1 },
      { state: 'pending', requestedAt: 1 },
      { state: 'pending', requestedBy: '', requestedAt: 1 },
      { state: 'pending', requestedBy: 'a'.repeat(129), requestedAt: 1 },
      { state: 'pending', requestedBy: 'a', requestedAt: -1 },
      { state: 'pending', requestedBy: 'a', requestedAt: Number.NaN },
    ])
      expect(parseApproval(bad)).toBeUndefined();
  });

  it('caps a note and an agent name, and drops blank ones', () => {
    const long = parseApproval({ ...pending, state: 'rejected', note: 'n'.repeat(900) });
    expect(long?.note).toHaveLength(APPROVAL_NOTE_MAX);
    expect(parseApproval({ ...pending, requestedByAgent: '  ' })).toEqual(pending);
    expect(
      parseApproval({ ...pending, requestedByAgent: 'a'.repeat(200) })?.requestedByAgent,
    ).toHaveLength(80);
    expect(parseApproval({ ...pending, state: 'rejected', note: '   ' })).toEqual({
      ...pending,
      state: 'rejected',
    });
  });

  it('rides the knowledge fields', () => {
    expect(parseKnowledgeFields({ owner: 'priya', approval: pending })).toEqual({
      owner: 'priya',
      approval: pending,
    });
    expect(parseKnowledgeFields({ approval: { state: 'nope' } })).toEqual({});
  });
});

describe('approvalRefusal', () => {
  it('lets any writer with an account ask, unless it is already pending', () => {
    expect(approvalRefusal('request', undefined, priya)).toBeNull();
    expect(approvalRefusal('request', { ...pending, state: 'rejected' }, tom)).toBeNull();
    expect(approvalRefusal('request', pending, tom)).toBe('already_pending');
    expect(approvalRefusal('request', undefined, claude)).toBeNull();
  });

  it('refuses a Viewer and anyone with no account everything', () => {
    for (const action of ['request', 'withdraw', 'approve', 'reject'] as const) {
      expect(approvalRefusal(action, pending, viewer)).toBe('forbidden');
      expect(approvalRefusal(action, pending, guest)).toBe('approval_needs_account');
    }
  });

  it('lets the person who asked or an Editor withdraw', () => {
    expect(approvalRefusal('withdraw', pending, priya)).toBeNull();
    expect(approvalRefusal('withdraw', pending, claude)).toBeNull();
    expect(approvalRefusal('withdraw', pending, sam)).toBeNull();
    expect(approvalRefusal('withdraw', pending, tom)).toBe('not_your_request');
    expect(approvalRefusal('withdraw', pending, { ...sam, agent: 'Bot' })).toBe('not_your_request');
    expect(approvalRefusal('withdraw', undefined, priya)).toBe('not_pending');
  });

  it('lets someone else decide, a person, on a pending page', () => {
    expect(approvalRefusal('approve', pending, tom)).toBeNull();
    expect(approvalRefusal('reject', pending, sam, 'Fix it')).toBeNull();
    expect(approvalRefusal('approve', pending, priya)).toBe('own_request');
    expect(approvalRefusal('approve', pending, { ...tom, agent: 'Claude' })).toBe(
      'approval_needs_a_person',
    );
    expect(approvalRefusal('approve', { ...pending, state: 'approved' }, tom)).toBe('not_pending');
    expect(approvalRefusal('reject', undefined, tom)).toBe('not_pending');
    expect(approvalRefusal('reject', pending, tom, 'n'.repeat(501))).toBe('note_too_long');
  });
});

describe('approvalActions', () => {
  it('offers each person what they may do', () => {
    expect(approvalActions(undefined, priya)).toEqual(['request']);
    expect(approvalActions(pending, priya)).toEqual(['withdraw']);
    expect(approvalActions(pending, tom)).toEqual(['approve', 'reject']);
    expect(approvalActions(pending, sam)).toEqual(['approve', 'reject', 'withdraw']);
    expect(approvalActions(pending, viewer)).toEqual([]);
  });
});

describe('applyApproval', () => {
  const asPriya = { ...priya, account: 'priya' };
  const asTom = { ...tom, account: 'tom' };

  it('asks, by a person or an agent, replacing what was decided before', () => {
    expect(applyApproval({ owner: 'sam' }, 'request', asPriya, 50)).toEqual({
      owner: 'sam',
      approval: { state: 'pending', requestedBy: 'priya', requestedAt: 50 },
    });
    const rejected: PageApproval = { ...pending, state: 'rejected', decidedBy: 'tom', note: 'x' };
    expect(
      applyApproval({ approval: rejected }, 'request', { ...claude, account: 'priya' }, 60),
    ).toEqual({
      approval: {
        state: 'pending',
        requestedBy: 'priya',
        requestedAt: 60,
        requestedByAgent: 'Claude',
      },
    });
  });

  it('approving verifies the page, and makes the approver the owner of a page with none', () => {
    expect(applyApproval({ approval: pending }, 'approve', asTom, 70)).toEqual({
      owner: 'tom',
      verifiedAt: 70,
      verifiedBy: 'tom',
      approval: { ...pending, state: 'approved', decidedBy: 'tom', decidedAt: 70 },
    });
    expect(applyApproval({ owner: 'sam', approval: pending }, 'approve', asTom, 70).owner).toBe(
      'sam',
    );
  });

  it('rejecting keeps the note and leaves verification alone', () => {
    expect(
      applyApproval(
        { verifiedAt: 5, verifiedBy: 'sam', approval: pending },
        'reject',
        asTom,
        80,
        '  Dates are wrong ',
      ),
    ).toEqual({
      verifiedAt: 5,
      verifiedBy: 'sam',
      approval: {
        ...pending,
        state: 'rejected',
        decidedBy: 'tom',
        decidedAt: 80,
        note: 'Dates are wrong',
      },
    });
    expect(applyApproval({ approval: pending }, 'reject', asTom, 80, '  ').approval).toEqual({
      ...pending,
      state: 'rejected',
      decidedBy: 'tom',
      decidedAt: 80,
    });
  });

  it('keeps each person’s name as their profile said it, so anyone reading sees who', () => {
    const asked = applyApproval({}, 'request', { ...asPriya, name: ' Priya Shah ' }, 50).approval!;
    expect(asked.requestedByName).toBe('Priya Shah');
    const named = { ...asTom, name: 'Tom '.repeat(40) };
    expect(
      applyApproval({ approval: asked }, 'approve', named, 60).approval!.decidedByName,
    ).toHaveLength(80);
    expect(
      applyApproval({ approval: asked }, 'reject', { ...asTom, name: 'Tom Ng' }, 60).approval!
        .decidedByName,
    ).toBe('Tom Ng');
    expect(
      applyApproval({}, 'request', { ...asPriya, name: '  ' }, 50).approval,
    ).not.toHaveProperty('requestedByName');
    // Read back as stored; a blank or wrong-typed one is dropped.
    expect(
      parseApproval({
        ...asked,
        state: 'approved',
        decidedBy: 'tom',
        decidedAt: 60,
        decidedByName: 'Tom Ng',
      }),
    ).toMatchObject({ requestedByName: 'Priya Shah', decidedByName: 'Tom Ng' });
    expect(parseApproval({ ...pending, requestedByName: 5 })).not.toHaveProperty('requestedByName');
  });

  it('withdrawing clears the approval', () => {
    expect(applyApproval({ owner: 'sam', approval: pending }, 'withdraw', asPriya, 90)).toEqual({
      owner: 'sam',
    });
  });

  it('names the actions', () => {
    expect(isApprovalAction('approve')).toBe(true);
    expect(isApprovalAction('nope')).toBe(false);
  });
});
