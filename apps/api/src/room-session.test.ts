import { describe, expect, it } from 'vitest';
import { newSessionAttachment, readSessionAttachment, verifiedSessionOf } from './room-session';

const upgrade = (headers: Record<string, string>) =>
  new Request('https://room/ws', { headers: { Upgrade: 'websocket', ...headers } });

describe('verifiedSessionOf', () => {
  it('reads every verified header, an empty one as none', () => {
    const v = verifiedSessionOf(
      upgrade({
        'X-Verified-Role': 'participate',
        'X-Verified-Owner': '1',
        'X-Verified-Tab-Scope': 't1',
        'X-Verified-Share-Code': '',
        'X-Verified-Account': '1',
        'X-Verified-Person': 'p',
        'X-Verified-Network': 'n',
        'X-Verified-Workbench-Pairing': 'w',
        'X-Verified-Adder': 'a',
        'X-Verified-Document': 'd',
      }),
    );
    expect(v).toEqual({
      verifiedRole: 'participate',
      isOwner: true,
      tabScope: 't1',
      shareCode: null,
      account: true,
      personTag: 'p',
      networkTag: 'n',
      workbenchPairing: 'w',
      adderKey: 'a',
      documentId: 'd',
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
        account: false,
        personTag: long,
        networkTag: long,
        workbenchPairing: long,
        adderKey: long,
        documentId: long,
      },
      'presence-1',
    );
    expect(a.presenceId).toBe('presence-1');
    expect(a.presence).toBeNull();
    expect(
      [a.personTag, a.networkTag, a.workbenchPairing, a.adderKey, a.documentId].map(
        (s) => s?.length,
      ),
    ).toEqual([64, 32, 36, 32, 64]);
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
