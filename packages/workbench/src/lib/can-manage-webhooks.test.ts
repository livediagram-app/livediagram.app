// The Webhooks menu entry's role gate (webhooks.md "Who adds one"): signed-in editors of the whole document only.
import { describe, expect, it } from 'vitest';
import { canManageWebhooks, type WebhookManagerFacts } from './can-manage-webhooks';

const editor: WebhookManagerFacts = {
  hydrated: true,
  accountUserId: 'user_a',
  isReadOnly: false,
  participating: false,
  sessionTabScope: null,
};

describe('canManageWebhooks', () => {
  it('offers Webhooks to a signed-in Editor of the whole document', () => {
    expect(canManageWebhooks(editor)).toBe(true);
  });

  it('hides it from a guest, signed out or not yet known', () => {
    expect(canManageWebhooks({ ...editor, accountUserId: null })).toBe(false);
    expect(canManageWebhooks({ ...editor, accountUserId: undefined })).toBe(false);
    expect(canManageWebhooks({ ...editor, accountUserId: '' })).toBe(false);
  });

  it('hides it from a Viewer (read-only) and a Participant', () => {
    expect(canManageWebhooks({ ...editor, isReadOnly: true })).toBe(false);
    expect(canManageWebhooks({ ...editor, participating: true })).toBe(false);
  });

  it('hides it from an Editor whose link reaches one tab only', () => {
    expect(canManageWebhooks({ ...editor, sessionTabScope: 'tab_1' })).toBe(false);
  });

  it('waits for the session to load', () => {
    expect(canManageWebhooks({ ...editor, hydrated: false })).toBe(false);
  });
});
