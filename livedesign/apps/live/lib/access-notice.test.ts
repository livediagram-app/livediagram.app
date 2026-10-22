// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { ACCESS_NOTICE_TTL_MS, noteAccessEnded, takeAccessEnded } from './access-notice';

// docs/specs/013-workspace/share-roles.md "Share links": a session ejected by a revoke or an access change is told
// why on the page it lands on, once.
beforeEach(() => sessionStorage.clear());

describe('access-ended notes', () => {
  it('gives the reason once, then nothing', () => {
    noteAccessEnded('doc-1', 'revoked');
    expect(takeAccessEnded()).toBe('revoked');
    expect(takeAccessEnded()).toBeNull();
  });

  it('answers only for the document it names, when asked about one', () => {
    noteAccessEnded('doc-1', 'changed');
    expect(takeAccessEnded('doc-2')).toBeNull();
    noteAccessEnded('doc-1', 'changed');
    expect(takeAccessEnded('doc-1')).toBe('changed');
  });

  it('forgets a stale note, so a later visit is never told about an old eject', () => {
    noteAccessEnded('doc-1', 'revoked');
    expect(takeAccessEnded(undefined, Date.now() + ACCESS_NOTICE_TTL_MS + 1)).toBeNull();
  });

  it('ignores a note it cannot read', () => {
    sessionStorage.setItem('livedesign:access-ended:v1', '{nope');
    expect(takeAccessEnded()).toBeNull();
  });
});
