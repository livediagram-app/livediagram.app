import { describe, expect, it } from 'vitest';
import { communitySectionState } from './community-section-state';

// The Share dialog's Community band (docs/specs/025-community/community.md "Publishing").

const base = {
  signedIn: true,
  teamDocument: false,
  loading: false,
  error: null,
  post: null,
};

describe('communitySectionState', () => {
  it('asks a guest to sign in before anything else', () => {
    expect(
      communitySectionState({ ...base, signedIn: false, teamDocument: true, loading: true }),
    ).toBe('guest');
  });

  it('explains a team document before loading anything', () => {
    expect(communitySectionState({ ...base, teamDocument: true, loading: true })).toBe('team');
  });

  it('is loading while the post is read', () => {
    expect(communitySectionState({ ...base, loading: true })).toBe('loading');
  });

  it('never offers to publish when the post could not be read', () => {
    expect(communitySectionState({ ...base, error: 'nope' })).toBe('error');
  });

  it('tells published and hidden posts apart', () => {
    expect(communitySectionState({ ...base, post: { state: 'listed' } })).toBe('published');
    expect(communitySectionState({ ...base, post: { state: 'hidden' } })).toBe('hidden');
  });

  it('invites the owner when there is no post', () => {
    expect(communitySectionState(base)).toBe('unpublished');
  });
});
