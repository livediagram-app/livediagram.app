// Google pictures in livedesign's rooms and participant reads (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures",
// docs/specs/014-identity/profile-and-email-notifications.md "Avatars"): a picture is kept only from an account
// session and only when it is a Google picture URL, and it reaches only account sessions and signed-in readers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __forgetProfiles } from './accounts/profiles';
import { helloPresence } from './design-room-rules';
import { rosterFrames, type RosterEntry } from './room-roster';
import { newSessionAttachment, verifiedSessionOf } from './room-session';
import { handleParticipants } from './routes/participants';
import { makeTestRouteContext } from './routes/test-route-context';
import { fakeAccounts, type FakeAccounts } from './test-accounts';
import type { Env, ParticipantPresence } from './types';

const PICTURE = 'https://lh3.googleusercontent.com/a/ACg8ocAda=s96-c';
const ACCOUNT = { presenceId: 'p-1', verifiedRole: 'edit' as const, account: true };
const GUEST = { presenceId: 'p-2', verifiedRole: 'edit' as const, account: false };

describe('the hello rule', () => {
  it('keeps a Google picture from an account session', () => {
    expect(helloPresence({ name: 'Ada', color: '#f00', picture: PICTURE }, ACCOUNT).picture).toBe(
      PICTURE,
    );
  });

  it('refuses a picture from a guest or a link visitor', () => {
    expect(
      'picture' in helloPresence({ name: 'Ada', color: '#f00', picture: PICTURE }, GUEST),
    ).toBe(false);
  });

  it('refuses anything that is not a Google picture, whole', () => {
    for (const picture of [
      'https://evil.example/ada.png',
      'http://lh3.googleusercontent.com/a/x',
      'javascript:alert(1)',
      `${PICTURE}${'x'.repeat(600)}`,
      42,
    ]) {
      const p = helloPresence({ name: 'Ada', color: '#f00', picture } as never, ACCOUNT);
      expect('picture' in p).toBe(false);
    }
  });
});

describe('the roster', () => {
  const entry = (presence: ParticipantPresence, account: boolean): RosterEntry => ({
    ws: {} as WebSocket,
    presence,
    personTag: null,
    account,
  });

  it('sends pictures to account sessions only', () => {
    const ada = entry({ id: 'a', name: 'Ada', color: '#f00', picture: PICTURE }, true);
    const bea = entry({ id: 'b', name: 'Bea', color: '#0f0' }, true);
    const visitor = entry({ id: 'v', name: 'Visitor', color: '#00f' }, false);
    const [toAda, toBea, toVisitor] = [...rosterFrames([ada, bea, visitor], [])];
    expect(toAda!.participants.map((p) => p.picture)).toEqual([undefined, undefined]);
    expect(toBea!.participants.find((p) => p.id === 'a')?.picture).toBe(PICTURE);
    const seen = toVisitor!.participants.find((p) => p.id === 'a')!;
    expect('picture' in seen).toBe(false);
    expect(seen.name).toBe('Ada');
  });
});

describe('the account mark on a session', () => {
  const upgrade = (account: string | undefined) =>
    new Request('https://room/ws', {
      headers: { Upgrade: 'websocket', ...(account ? { 'X-Verified-Account': account } : {}) },
    });

  it('comes from the worker-stamped header, and only "1" counts', () => {
    expect(newSessionAttachment(verifiedSessionOf(upgrade('1')), 'p').account).toBe(true);
    expect(newSessionAttachment(verifiedSessionOf(upgrade('0')), 'p').account).toBe(false);
    expect(newSessionAttachment(verifiedSessionOf(upgrade(undefined)), 'p').account).toBe(false);
  });
});

describe('GET /api/participants/:id', () => {
  let accounts: FakeAccounts;
  beforeEach(() => {
    __forgetProfiles();
    accounts = fakeAccounts();
    vi.stubGlobal('fetch', accounts.fetch);
    accounts.profiles.set('user_ada', {
      name: 'Ada',
      color: '#abc',
      createdAt: 5,
      updatedAt: 5,
      picture: PICTURE,
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const read = async (signedIn: boolean) => {
    const res = await handleParticipants(
      makeTestRouteContext('GET', '/api/participants/user_ada', {
        owner: signedIn ? 'user_bea' : null,
        accountUserId: signedIn ? 'user_bea' : null,
        env: accounts.env as unknown as Env,
      }),
    );
    const body: { participant: Record<string, unknown> } = await res.json();
    return body.participant;
  };

  it('answers a signed-in reader the picture', async () => {
    expect((await read(true)).picture).toBe(PICTURE);
  });

  it('answers anyone else the name and colour alone', async () => {
    const participant = await read(false);
    expect(participant.name).toBe('Ada');
    expect('picture' in participant).toBe(false);
  });
});
