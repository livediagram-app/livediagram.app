import { describe, expect, it } from 'vitest';
import { communityCodeMessage } from './community-errors';
import { COMMUNITY_APP_WORDS } from './words';

describe('communityCodeMessage', () => {
  it('names the part that is the card picture in each app’s words', () => {
    expect(communityCodeMessage('empty_document', COMMUNITY_APP_WORDS['livediagram.app'])).toBe(
      'Add something to your first tab before sharing: it is the picture on your Community card.',
    );
    expect(communityCodeMessage('empty_document', COMMUNITY_APP_WORDS['livedocuments.app'])).toBe(
      'Add something to your first page before sharing: it is the picture on your Community card.',
    );
    expect(
      communityCodeMessage('share_password_set', COMMUNITY_APP_WORDS['livedocuments.app']),
    ).toBe('This document has a share password. Remove the password to share it to the Community.');
  });
});
