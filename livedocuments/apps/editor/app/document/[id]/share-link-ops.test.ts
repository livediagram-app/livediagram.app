import { describe, expect, it } from 'vitest';
import { shareLinkOpEffect } from './share-link-ops';

// What a session does when the worker says a share link changed
// (docs/specs/013-workspace/tab-scoped-share-links.md): only the sessions that came in on that code react.
describe('shareLinkOpEffect', () => {
  it('leaves the editor when its own code is revoked', () => {
    expect(shareLinkOpEffect({ kind: 'share-revoked', code: 'C' }, 'system', 'C')).toBe('leave');
  });

  it('reloads into the new scope when its own code is rescoped', () => {
    expect(shareLinkOpEffect({ kind: 'share-rescoped', code: 'C' }, 'system', 'C')).toBe('reload');
  });

  it('ignores another code', () => {
    expect(shareLinkOpEffect({ kind: 'share-rescoped', code: 'X' }, 'system', 'C')).toBeNull();
  });

  it('ignores a session that came in without a code (the owner, a teammate)', () => {
    expect(shareLinkOpEffect({ kind: 'share-revoked', code: 'C' }, 'system', null)).toBeNull();
  });

  it('ignores anything a peer claims: only the worker sends these', () => {
    expect(shareLinkOpEffect({ kind: 'share-revoked', code: 'C' }, 'peer-1', 'C')).toBeNull();
  });
});
