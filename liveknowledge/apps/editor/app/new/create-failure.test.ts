import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { createFailureCopy, createIdsFor } from './create-failure';

// The card a failed create on /new shows (docs/specs/007-editor/new-document-route.md "Placement
// rides the create"): a refused placement will not clear on a retry, so it says why and offers
// another place; anything else keeps the connection copy and Try again.

const refused = (code: string, status = 400) => new ApiError('create document', status, code);

describe('createFailureCopy', () => {
  it('says the owner’s Knowledgebases are full, never the connection, and goes back to the Explorer', () => {
    const full = new ApiError('create document', 409, 'page_limit', {
      error: 'page_limit',
      limit: 'knowledgebasePages',
      used: 500,
      max: 500,
    });
    expect(createFailureCopy(full)).toEqual({
      action: 'explorer',
      eyebrow: 'Knowledgebases full',
      title: 'No room for another knowledgebase',
      message:
        'Your Knowledgebases hold 500 pages, the most your plan keeps, and a new one starts with a page. Delete pages you no longer need to make room. Pro holds 10,000.',
      actionLabel: 'Back to Explorer',
    });
    // On Pro there is no Pro to offer; without the figures the words stay general.
    const pro = new ApiError('create document', 409, 'page_limit', { max: 10_000 });
    expect(createFailureCopy(pro).message).toBe(
      'Your Knowledgebases hold 10,000 pages, the most your plan keeps, and a new one starts with a page. Delete pages you no longer need to make room.',
    );
    expect(createFailureCopy(new ApiError('create document', 409, 'page_limit')).message).toContain(
      'Your Knowledgebases hold all the pages your plan holds',
    );
  });

  it('keeps the connection card for a network failure', () => {
    expect(createFailureCopy(new TypeError('Failed to fetch'))).toEqual({
      action: 'retry',
      eyebrow: 'Connection error',
      title: 'Couldn’t create the knowledgebase',
      message:
        'We couldn’t reach the server to create your knowledgebase. Check your connection and try again.',
      actionLabel: 'Try again',
    });
  });

  it('keeps the connection card for a server error', () => {
    expect(createFailureCopy(new ApiError('create document', 503, null)).action).toBe('retry');
  });

  it.each([
    [
      'team_forbidden',
      403,
      'You’re not a member of that team, so the knowledgebase can’t be filed in its library.',
    ],
    ['folder_not_found', 404, 'That folder no longer exists, or isn’t yours.'],
    [
      'folder_scope_mismatch',
      400,
      'That folder belongs to a different space from the one you chose.',
    ],
    ['placement_invalid', 400, 'That isn’t a place a knowledgebase can be filed.'],
  ])('says why a %s placement was refused', (code, status, message) => {
    expect(createFailureCopy(refused(code, status))).toEqual({
      action: 'choose',
      eyebrow: 'Placement refused',
      title: 'Couldn’t file the knowledgebase there',
      message,
      actionLabel: 'Choose another place',
    });
  });
});

describe('createIdsFor', () => {
  it('mints fresh ids for a new create', () => {
    const a = createIdsFor(null);
    const b = createIdsFor(null);
    expect(a.documentId).not.toBe(b.documentId);
    expect(a.tabId).not.toBe(a.documentId);
  });

  it('keeps the failed attempt’s ids for its Retry, so a create that landed is not made twice', () => {
    const first = createIdsFor(null);
    expect(createIdsFor(first)).toEqual(first);
  });
});
