import { describe, expect, it } from 'vitest';
import { MAX_PARTICIPANT_NAME_LEN } from '@livehuddle/api-schema';
import {
  newSessionAttachment,
  presenceNameHeader,
  readSessionAttachment,
  verifiedSessionOf,
} from './room-session';

const upgrade = (headers: Record<string, string>) =>
  new Request('https://room/ws', { headers: { Upgrade: 'websocket', ...headers } });

describe('verifiedSessionOf', () => {
  // livehuddle has no workbenches: a pairing header is never read (docs/specs/002-project-scope/not-in-livehuddle.md).
  it('reads every verified header, an empty one as none, and no pairing', () => {
    const v = verifiedSessionOf(
      upgrade({
        'X-Verified-Role': 'participate',
        'X-Verified-Owner': '1',
        'X-Verified-Tab-Scope': 't1',
        'X-Verified-Share-Code': '',
        'X-Verified-Person': 'p',
        'X-Verified-Collab-Key': '0123456789abcdef0123456789abcdef',
        'X-Verified-Reaction-Person': '0123456789abcdef01234567',
        'X-Verified-Workbench-Pairing': 'w',
        'X-Verified-Adder': 'a',
        'X-Verified-Document': 'd',
        'X-Verified-Grant-Exp': '1700000000',
        'X-Verified-Item-Owner': 'o',
        'X-Verified-Item-Team': '',
        'X-Verified-Name': encodeURIComponent('  Zoë Ng  '),
      }),
    );
    expect(v).toEqual({
      verifiedRole: 'participate',
      isOwner: true,
      tabScope: 't1',
      shareCode: null,
      personTag: 'p',
      collabKey: '0123456789abcdef0123456789abcdef',
      reactionPerson: '0123456789abcdef01234567',
      name: 'Zoë Ng',
      account: false,
      adderKey: 'a',
      documentId: 'd',
      grantExp: 1_700_000_000_000,
      head: { owner: 'o', team: null },
    });
  });

  // docs/specs/014-identity/auth-and-guest-access.md "Presence names": the name rides URI-encoded, so a name past
  // Latin-1 survives the header, and the attachment holds it cut.
  it('reads the presence name the api stamped, cut, and a bad or blank one as none', () => {
    const named = (value: string) => verifiedSessionOf(upgrade({ 'X-Verified-Name': value })).name;
    expect(named(presenceNameHeader('Ada 李'))).toBe('Ada 李');
    expect(named('%E0%A4%A')).toBeNull();
    expect(named(encodeURIComponent('   '))).toBeNull();
    expect(named('')).toBeNull();
    expect(presenceNameHeader(null)).toBe('');
    const long = verifiedSessionOf(
      upgrade({ 'X-Verified-Name': presenceNameHeader('n'.repeat(999)) }),
    );
    expect(newSessionAttachment(long, 'p1').verifiedName).toHaveLength(MAX_PARTICIPANT_NAME_LEN);
    expect('verifiedName' in newSessionAttachment(verifiedSessionOf(upgrade({})), 'p1')).toBe(
      false,
    );
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
        isOwner: false,
        tabScope: null,
        shareCode: null,
        personTag: long,
        adderKey: long,
        documentId: long,
      },
      'presence-1',
    );
    expect(a.presenceId).toBe('presence-1');
    expect(a.presence).toBeNull();
    expect([a.personTag, a.adderKey, a.documentId].map((s) => s?.length)).toEqual([64, 32, 200]);
  });
});

describe('a long document id', () => {
  it('is kept whole, so its grant renews and its calls prove themselves', () => {
    const id = 'd'.repeat(128);
    const a = newSessionAttachment(
      {
        isOwner: false,
        tabScope: null,
        shareCode: null,
        personTag: null,
        adderKey: null,
        documentId: id,
      },
      'presence-1',
    );
    expect(a.documentId).toBe(id);
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
