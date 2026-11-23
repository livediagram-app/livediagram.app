import { describe, expect, it } from 'vitest';
import { INBOX_SUGGESTION_TEXT_MAX, suggestionPushOf } from './suggestions-inbox';

// A suggested edit as the Inbox gets it (docs/specs/030-knowledgebase/insights.md "In the owner's Inbox").
const stored = {
  id: 'sg_0123456789',
  tab: 'deploys',
  agent: 'Claude',
  reason: 'The day changed.',
  kind: 'replace' as const,
  before: 'Tuesdays',
  after: 'Mondays',
  createdAt: 1_700_000_000_000,
};

describe('a suggestion for the Inbox', () => {
  it('names the page owner, or none for the knowledgebase owner', () => {
    expect(suggestionPushOf(stored, 'acct_1')).toEqual({
      id: 'sg_0123456789',
      ownerId: 'acct_1',
      agent: 'Claude',
      reason: 'The day changed.',
      kind: 'replace',
      before: 'Tuesdays',
      after: 'Mondays',
      createdAt: 1_700_000_000_000,
    });
    expect(suggestionPushOf(stored, null).ownerId).toBeNull();
  });

  it('cuts its texts, never the whole suggestion', () => {
    const long = 'x'.repeat(INBOX_SUGGESTION_TEXT_MAX + 50);
    const push = suggestionPushOf(
      { ...stored, before: long, after: long, reason: long, agent: long },
      null,
    );
    expect(push.before).toHaveLength(INBOX_SUGGESTION_TEXT_MAX);
    expect(push.after).toHaveLength(INBOX_SUGGESTION_TEXT_MAX);
    expect(push.reason).toHaveLength(500);
    expect(push.agent).toHaveLength(200);
  });
});
