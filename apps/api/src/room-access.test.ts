import { describe, expect, it } from 'vitest';
import { parseAccessCloseMatch, sessionMatchesAccessClose } from './room-access';

const TAG = 'f'.repeat(64);

describe('parseAccessCloseMatch', () => {
  it('reads the two matches the room knows', () => {
    expect(parseAccessCloseMatch({ match: 'share-code' })).toEqual({ match: 'share-code' });
    expect(parseAccessCloseMatch({ match: 'person', personTag: TAG })).toEqual({
      match: 'person',
      personTag: TAG,
    });
  });

  it.each([
    null,
    'share-code',
    {},
    { match: 'all' },
    { match: 'person' },
    { match: 'person', personTag: 'x' },
  ])('refuses %j', (body) => {
    expect(parseAccessCloseMatch(body)).toBeNull();
  });
});

describe('sessionMatchesAccessClose', () => {
  const shareCode = { match: 'share-code' } as const;
  const person = { match: 'person', personTag: TAG } as const;

  it('matches every session a code admitted, and no owner or team session', () => {
    expect(sessionMatchesAccessClose({ shareCode: 'CODE2345' }, shareCode)).toBe(true);
    expect(sessionMatchesAccessClose({ shareCode: null, personTag: TAG }, shareCode)).toBe(false);
    expect(sessionMatchesAccessClose({}, shareCode)).toBe(false);
  });

  it('matches a person tag exactly, and never an untagged session', () => {
    expect(sessionMatchesAccessClose({ personTag: TAG }, person)).toBe(true);
    expect(sessionMatchesAccessClose({ personTag: 'e'.repeat(64) }, person)).toBe(false);
    expect(sessionMatchesAccessClose({ personTag: null }, person)).toBe(false);
  });

  it('matches nothing for a socket with no session', () => {
    expect(sessionMatchesAccessClose(null, shareCode)).toBe(false);
  });
});

describe('the workbench close match', () => {
  const PAIRING = '3f1c9a2e-7b4d-4c8e-9a1f-2b3c4d5e6f70';
  const workbench = { match: 'workbench', pairingId: PAIRING } as const;

  it('parses a pairing id, and refuses anything that is not one', () => {
    expect(parseAccessCloseMatch({ match: 'workbench', pairingId: PAIRING })).toEqual(workbench);
    expect(parseAccessCloseMatch({ match: 'workbench', pairingId: 'pair1' })).toBeNull();
    expect(parseAccessCloseMatch({ match: 'workbench' })).toBeNull();
  });

  it('matches only the sockets of that pairing', () => {
    expect(sessionMatchesAccessClose({ workbenchPairing: PAIRING }, workbench)).toBe(true);
    expect(
      sessionMatchesAccessClose({ workbenchPairing: '00000000-0000-4000-8000-000000000000' }, workbench),
    ).toBe(false);
    expect(sessionMatchesAccessClose({ personTag: TAG, workbenchPairing: null }, workbench)).toBe(
      false,
    );
  });
});
