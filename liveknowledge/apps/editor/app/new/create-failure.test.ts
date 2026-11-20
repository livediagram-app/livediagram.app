import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { createFailureCopy, createIdsFor } from './create-failure';

// The card a failed create on /new shows (docs/specs/007-editor/new-document-route.md "Placement
// rides the create"): a refused placement will not clear on a retry, so it says why and offers
// another place; anything else keeps the connection copy and Try again.

const refused = (code: string, status = 400) => new ApiError('create document', status, code);

describe('createFailureCopy', () => {
  it('keeps the connection card for a network failure', () => {
    expect(createFailureCopy(new TypeError('Failed to fetch'))).toEqual({
      action: 'retry',
      eyebrow: 'Connection error',
      title: 'Couldn’t create the document',
      message:
        'We couldn’t reach the server to create your document. Check your connection and try again.',
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
      'You’re not a member of that team, so the document can’t be filed in its library.',
    ],
    ['folder_not_found', 404, 'That folder no longer exists, or isn’t yours.'],
    [
      'folder_scope_mismatch',
      400,
      'That folder belongs to a different space from the one you chose.',
    ],
    ['placement_invalid', 400, 'That isn’t a place a document can be filed.'],
  ])('says why a %s placement was refused', (code, status, message) => {
    expect(createFailureCopy(refused(code, status))).toEqual({
      action: 'choose',
      eyebrow: 'Placement refused',
      title: 'Couldn’t file the document there',
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
