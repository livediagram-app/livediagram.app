import { describe, expect, it } from 'vitest';
import { newSessionAttachment, readSessionAttachment, verifiedSessionOf } from './room-session';

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
        'X-Verified-Workbench-Pairing': 'w',
        'X-Verified-Adder': 'a',
        'X-Verified-Document': 'd',
        'X-Verified-Grant-Exp': '1700000000',
        'X-Verified-Item-Owner': 'o',
        'X-Verified-Item-Team': '',
      }),
    );
    expect(v).toEqual({
      verifiedRole: 'participate',
      isOwner: true,
      tabScope: 't1',
      shareCode: null,
      personTag: 'p',
      account: false,
      adderKey: 'a',
      documentId: 'd',
      grantExp: 1_700_000_000_000,
      head: { owner: 'o', team: null },
    });
  });

  it('ignores a role it does not know', () => {
    expect(verifiedSessionOf(upgrade({ 'X-Verified-Role': 'admin' })).verifiedRole).toBeUndefined();
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
