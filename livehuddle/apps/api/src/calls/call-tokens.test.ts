import { describe, expect, it } from 'vitest';
import { openSessionToken, sealSessionToken, sealTrackToken, trackTokenHolds } from './call-tokens';

// docs/specs/012-collaboration/blueprints/proximity-audio.md "Tokens".
describe('call tokens', () => {
  it('prove a session is the caller’s on this Space, with its role', async () => {
    const speaker = await sealSessionToken('k', 'doc1', 'sess1', 's');
    const listener = await sealSessionToken('k', 'doc1', 'sess1', 'l');
    expect(speaker).toMatch(/^s\.[\w-]+$/);
    expect(await openSessionToken('k', 'doc1', 'sess1', speaker)).toBe('s');
    expect(await openSessionToken('k', 'doc1', 'sess1', listener)).toBe('l');
  });

  it('refuse another Space, session, key or role, and anything malformed', async () => {
    const token = await sealSessionToken('k', 'doc1', 'sess1', 'l');
    expect(await openSessionToken('k', 'doc2', 'sess1', token)).toBeNull();
    expect(await openSessionToken('k', 'doc1', 'sess2', token)).toBeNull();
    expect(await openSessionToken('other', 'doc1', 'sess1', token)).toBeNull();
    // A listener cannot promote itself by changing the prefix.
    expect(await openSessionToken('k', 'doc1', 'sess1', `s${token.slice(1)}`)).toBeNull();
    for (const bad of [undefined, 42, '', 'x.abc', 's', 'sabc', `${token}x`]) {
      expect(await openSessionToken('k', 'doc1', 'sess1', bad)).toBeNull();
    }
  });

  it('sign a published microphone to its Space, apart from the session token', async () => {
    const track = await sealTrackToken('k', 'doc1', 'sess1');
    expect(await trackTokenHolds('k', 'doc1', 'sess1', track)).toBe(true);
    expect(await trackTokenHolds('k', 'doc2', 'sess1', track)).toBe(false);
    expect(await trackTokenHolds('k', 'doc1', 'sess2', track)).toBe(false);
    // A shared track token never opens the session it names.
    expect(await openSessionToken('k', 'doc1', 'sess1', `s.${track}`)).toBeNull();
  });
});
