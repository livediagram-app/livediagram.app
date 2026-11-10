import { describe, expect, it } from 'vitest';
import { newSessionAttachment, readSessionAttachment, verifiedSessionOf } from './room-session';

const upgrade = (headers: Record<string, string>) =>
  new Request('https://room/ws', { headers: { Upgrade: 'websocket', ...headers } });

describe('verifiedSessionOf', () => {
  it('reads every verified header, an empty one as none', () => {
    const v = verifiedSessionOf(
      upgrade({
        'X-Verified-Role': 'participate',
        'X-Verified-Tab-Scope': 't1',
        'X-Verified-Share-Code': '',
        'X-Verified-Person': 'p',
        'X-Verified-Collab-Key': '0123456789abcdef0123456789abcdef',
        'X-Verified-Reaction-Person': '0123456789abcdef01234567',
        'X-Verified-Account': '1',
        'X-Verified-Workbench-Pairing': 'w',
        'X-Verified-Adder': 'a',
        'X-Verified-Project': 'd',
        'X-Verified-Owner': 'user_o',
        'X-Verified-Team': '',
      }),
    );
    expect(v).toEqual({
      verifiedRole: 'participate',
      tabScope: 't1',
      shareCode: null,
      personTag: 'p',
      collabKey: '0123456789abcdef0123456789abcdef',
      reactionPerson: '0123456789abcdef01234567',
      account: true,
      workbenchPairing: 'w',
      adderKey: 'a',
      projectId: 'd',
      grantExp: null,
      head: { owner: 'user_o', team: null },
    });
  });

  it('ignores a role it does not know', () => {
    expect(verifiedSessionOf(upgrade({ 'X-Verified-Role': 'admin' })).verifiedRole).toBeUndefined();
  });
});

describe('the collab key (docs/specs/013-workspace/share-roles.md "The collab key")', () => {
  // A session as an upgrade with no identity headers reads.
  const base = verifiedSessionOf(upgrade({}));

  it('keeps the key the upgrade forwarded', () => {
    expect(
      newSessionAttachment({ ...base, collabKey: '0123456789abcdef0123456789abcdef' }, 'p1')
        .collabKey,
    ).toBe('0123456789abcdef0123456789abcdef');
  });

  it('mints a fresh key for a session with none, or a malformed one, different for every socket', () => {
    const a = newSessionAttachment({ ...base, collabKey: null }, 'p1').collabKey;
    const b = newSessionAttachment({ ...base, collabKey: 'x'.repeat(500) }, 'p2').collabKey;
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(b).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });

  // docs/specs/012-collaboration/comment-reactions.md: the person the room stamps on this session's reactions.
  it('keeps the reaction person the upgrade forwarded, and none of the wrong shape', () => {
    const read = verifiedSessionOf(
      upgrade({ 'X-Verified-Reaction-Person': '0123456789abcdef01234567' }),
    );
    expect(newSessionAttachment(read, 'p1').reactionPerson).toBe('0123456789abcdef01234567');
    expect('reactionPerson' in newSessionAttachment(base, 'p1')).toBe(false);
    const odd = { ...base, reactionPerson: 'x'.repeat(500) };
    expect('reactionPerson' in newSessionAttachment(odd, 'p1')).toBe(false);
  });
});

describe('newSessionAttachment', () => {
  it('clamps every forged header so the attachment stays small', () => {
    const long = 'x'.repeat(500);
    const a = newSessionAttachment(
      {
        tabScope: null,
        shareCode: null,
        personTag: long,
        account: false,
        workbenchPairing: long,
        adderKey: long,
        projectId: long,
      },
      'presence-1',
    );
    expect(a.presenceId).toBe('presence-1');
    expect(a.presence).toBeNull();
    expect(
      [a.personTag, a.workbenchPairing, a.adderKey, a.projectId].map((s) => s?.length),
    ).toEqual([64, 36, 32, 200]);
  });
});

describe('a long plan id', () => {
  it('is kept whole up to the API bound, so its grant renews against the real id', () => {
    const id = 'd'.repeat(200);
    const a = newSessionAttachment(
      {
        tabScope: null,
        shareCode: null,
        personTag: null,
        account: false,
        workbenchPairing: null,
        adderKey: null,
        projectId: id,
      },
      'presence-1',
    );
    expect(a.projectId).toBe(id);
  });
});

describe('readSessionAttachment', () => {
  it('reads a socket’s attachment, null when it is missing or unreadable', () => {
    const ws = (read: () => unknown) => ({ deserializeAttachment: read }) as unknown as WebSocket;
    expect(readSessionAttachment(ws(() => ({ presenceId: 'p' })))).toEqual({ presenceId: 'p' });
    expect(readSessionAttachment(ws(() => null))).toBeNull();
    expect(
      readSessionAttachment(
        ws(() => {
          throw new Error('corrupt');
        }),
      ),
    ).toBeNull();
  });
});
