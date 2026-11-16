import { describe, expect, it } from 'vitest';
import { addressHasShareCode, notFoundReason, notFoundTitle } from './not-found-reason';

const none = { page: false, accessEnded: false, shareLink: false, signedOut: false };

// The new-file route spec's "Which not-found card": the first case that fits, never by whether the item exists.
describe('notFoundReason', () => {
  it('takes the first case that fits, in order', () => {
    expect(notFoundReason({ ...none, page: true, accessEnded: true, shareLink: true })).toBe(
      'page',
    );
    expect(notFoundReason({ ...none, accessEnded: true, shareLink: true })).toBe('access-ended');
    expect(notFoundReason({ ...none, shareLink: true, signedOut: true })).toBe('dead-link');
    expect(notFoundReason({ ...none, signedOut: true })).toBe('sign-in');
    expect(notFoundReason(none)).toBe('missing');
  });
});

describe('notFoundTitle', () => {
  it('names each case, a dead link by where it shows', () => {
    expect(notFoundTitle('page', 'canvas')).toBe('Page Not Found');
    expect(notFoundTitle('access-ended', 'canvas')).toBe('No Longer Shared With You');
    expect(notFoundTitle('dead-link', 'canvas')).toBe('Link Not Valid');
    expect(notFoundTitle('dead-link', 'canvas', true)).toBe('No Longer Shared');
    expect(notFoundTitle('sign-in', 'plan')).toBe('Plan Not Found');
    expect(notFoundTitle('missing', 'design')).toBe('Design Not Found');
  });
});

describe('addressHasShareCode', () => {
  it('reads `?s=` off the address', () => {
    expect(addressHasShareCode('?s=abc&readonly=1')).toBe(true);
    expect(addressHasShareCode('?readonly=1')).toBe(false);
    expect(addressHasShareCode('')).toBe(false);
  });
});
