// Request Access's notices (request-access.md "The emails"): what the app takes from the index, and what it refuses.
import { describe, expect, it } from 'vitest';
import { ACCESS_REQUEST_NOTE_MAX, ACCESS_REQUEST_RECIPIENTS_MAX, parseAccessNotice } from './index';

const asked = {
  type: 'access_requested',
  requestId: 'ar_1',
  requesterId: 'user_b',
  requesterName: 'Bo',
  recipientIds: ['user_a'],
  itemTitle: 'Roadmap',
  note: 'On the launch team',
};
const granted = {
  type: 'access_granted',
  requestId: 'ar_1',
  requesterId: 'user_b',
  granterId: 'user_a',
  granterName: 'Ada',
  level: 'view',
  itemTitle: 'Roadmap',
};

describe('parseAccessNotice', () => {
  it('reads both notices', () => {
    expect(parseAccessNotice(asked)).toEqual(asked);
    expect(parseAccessNotice(granted)).toEqual(granted);
  });

  it('reads a missing name or note as null', () => {
    const { requesterName: _n, note: _note, ...bare } = asked;
    expect(parseAccessNotice(bare)).toEqual({ ...asked, requesterName: null, note: null });
    const { granterName: _g, ...plain } = granted;
    expect(parseAccessNotice(plain)).toEqual({ ...granted, granterName: null });
  });

  it('refuses anything else', () => {
    const bad: unknown[] = [
      null,
      'access_requested',
      { ...asked, type: 'approval_requested' },
      { ...asked, requestId: '' },
      { ...asked, requesterId: 7 },
      { ...asked, itemTitle: 'x'.repeat(501) },
      { ...asked, recipientIds: [] },
      { ...asked, recipientIds: 'user_a' },
      {
        ...asked,
        recipientIds: Array.from({ length: ACCESS_REQUEST_RECIPIENTS_MAX + 1 }, (_, i) => `u${i}`),
      },
      { ...asked, recipientIds: [''] },
      { ...asked, requesterName: 7 },
      { ...asked, note: 'x'.repeat(ACCESS_REQUEST_NOTE_MAX + 1) },
      { ...granted, granterId: '' },
      { ...granted, granterName: 7 },
      { ...granted, level: 'owner' },
    ];
    for (const value of bad) expect(parseAccessNotice(value)).toBeNull();
  });
});
