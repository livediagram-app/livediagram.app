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
        'X-Verified-Workbench-Pairing': 'w',
        'X-Verified-Adder': 'a',
        'X-Verified-Document': 'd',
      }),
    );
    expect(v).toEqual({
      verifiedRole: 'participate',
      tabScope: 't1',
      shareCode: null,
      personTag: 'p',
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
        tabScope: null,
        shareCode: null,
        personTag: long,
        workbenchPairing: long,
        adderKey: long,
        documentId: long,
      },
      'presence-1',
    );
    expect(a.presenceId).toBe('presence-1');
    expect(a.presence).toBeNull();
    expect(
      [a.personTag, a.workbenchPairing, a.adderKey, a.documentId].map((s) => s?.length),
    ).toEqual([64, 36, 32, 64]);
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
