import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_CHANGED_CLOSE,
  GRANT_LAPSED_CLOSE,
  ROOM_MAX_CONNECTIONS,
  ROOM_FULL_CLOSE,
  ROOM_GRANT_ASK_BEFORE_MS,
} from '@livedesign/api-schema';
import type { GrantClaims } from '@liveworkspace/index-client';
import { setGrantVerifierForTests } from '../index-service';
import type { Env } from '../types';
import { DesignRoom } from './design-room';

// A session holds the index's grant, which lapses after ten minutes (liveworkspace/docs/one-explorer-contracts.md
// "Grants"): the room asks for a fresh one ROOM_GRANT_ASK_BEFORE_MS before, moves the lapse on when one comes, and
// drops the socket once it has lapsed. A revoked share link closes exactly the sockets it admitted.

const T0 = 1_800_000_000_000;

type FakeSocket = {
  sent: string[];
  attachment: unknown;
  closed: { code: number; reason: string } | null;
  send: (data: string) => void;
  serializeAttachment: (value: unknown) => void;
  deserializeAttachment: () => unknown;
  close: (code: number, reason: string) => void;
  accept: () => void;
};

function room() {
  const sockets: FakeSocket[] = [];
  const store = new Map<string, unknown>();
  const state = {
    id: { name: 'P', toString: () => 'P' },
    acceptWebSocket: (ws: FakeSocket) => void sockets.push(ws),
    getWebSockets: () => sockets.filter((s) => !s.closed),
    storage: {
      get: async (key: string) => store.get(key),
      put: async (key: string, value: unknown) => void store.set(key, value),
      delete: async (key: string) => store.delete(key),
      list: async ({ prefix }: { prefix: string }) =>
        new Map([...store].filter(([key]) => key.startsWith(prefix))),
      setAlarm: async () => {},
      deleteAlarm: async () => {},
      deleteAll: async () => store.clear(),
    },
    blockConcurrencyWhile: async (fn: () => Promise<void>) => fn(),
    waitUntil: () => {},
  };
  const design = new DesignRoom(state as unknown as DurableObjectState, { INDEX_KEY: 'k' } as Env);
  const join = (opts: {
    role?: 'edit' | 'view';
    tab?: string | null;
    code?: string | null;
    expMs: number;
  }) => {
    const ws: FakeSocket = {
      sent: [],
      attachment: null,
      closed: null,
      send: (data) => void ws.sent.push(data),
      serializeAttachment: (value) => void (ws.attachment = value),
      deserializeAttachment: () => ws.attachment,
      close: (code, reason) => void (ws.closed = { code, reason }),
      accept: () => {},
    };
    design.acceptSession(
      ws as unknown as WebSocket,
      opts.role ?? 'edit',
      opts.tab ?? null,
      opts.code ?? null,
      null,
      null,
      null,
      'P',
      opts.expMs,
    );
    return ws;
  };
  return { design, join };
}

const kinds = (ws: FakeSocket) => ws.sent.map((raw) => (JSON.parse(raw) as { kind: string }).kind);

// A stand-in for the index's signature: `G.<claims>`.
const grant = (claims: Partial<GrantClaims>) =>
  `G.${btoa(JSON.stringify({ item: 'P', sub: 'user_a', level: 'edit', tab: null, team: null, exp: 0, ...claims }))}`;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  setGrantVerifierForTests(async (token) =>
    token.startsWith('G.') ? (JSON.parse(atob(token.slice(2))) as GrantClaims) : null,
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  setGrantVerifierForTests(null);
});

describe('a session grant', () => {
  it('is asked to renew once, inside the window, and dropped once it lapses', async () => {
    const { design, join } = room();
    const ws = join({ expMs: T0 + 600_000 });

    await design.alarm();
    expect(kinds(ws)).not.toContain('grant-renew');

    vi.setSystemTime(T0 + 600_000 - ROOM_GRANT_ASK_BEFORE_MS);
    await design.alarm();
    await design.alarm();
    expect(kinds(ws).filter((k) => k === 'grant-renew')).toHaveLength(1);
    expect(ws.closed).toBeNull();

    vi.setSystemTime(T0 + 600_000);
    await design.alarm();
    expect(ws.closed).toEqual({ code: GRANT_LAPSED_CLOSE, reason: 'grant-lapsed' });
  });

  it('moves the lapse on with a fresh grant saying the same', async () => {
    const { design, join } = room();
    const ws = join({ expMs: T0 + 600_000 });
    vi.setSystemTime(T0 + 590_000);
    await design.alarm();

    await design.renewGrant(ws as unknown as WebSocket, grant({ exp: (T0 + 1_200_000) / 1000 }));

    vi.setSystemTime(T0 + 600_000);
    await design.alarm();
    expect(ws.closed).toBeNull();
    expect(ws.attachment).toMatchObject({ grantExp: T0 + 1_200_000, renewAsked: false });
  });

  it('ends the session when the fresh grant says something else (a level or tab changed)', async () => {
    const { design, join } = room();
    const ws = join({ expMs: T0 + 600_000 });
    await design.renewGrant(
      ws as unknown as WebSocket,
      grant({ level: 'view', exp: (T0 + 1_200_000) / 1000 }),
    );
    expect(ws.closed?.code).toBe(ACCESS_CHANGED_CLOSE);
  });

  it('ignores a forged grant and one for another design: the old one still lapses', async () => {
    const { design, join } = room();
    const ws = join({ expMs: T0 + 600_000 });
    await design.renewGrant(ws as unknown as WebSocket, 'forged');
    await design.renewGrant(
      ws as unknown as WebSocket,
      grant({ item: 'other', exp: (T0 + 1_200_000) / 1000 }),
    );
    expect(ws.attachment).toMatchObject({ grantExp: T0 + 600_000 });
    vi.setSystemTime(T0 + 600_000);
    await design.alarm();
    expect(ws.closed?.code).toBe(GRANT_LAPSED_CLOSE);
  });
});

// docs/specs/015-api/api.md "Room size": one more than ROOM_MAX_CONNECTIONS is turned away with a close code the
// editor can show, and a place that frees up is taken again.
describe('a full room', () => {
  it('turns connection 101 away as full, and admits again once someone leaves', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { join } = room();
    const sockets = Array.from({ length: ROOM_MAX_CONNECTIONS }, () =>
      join({ expMs: T0 + 600_000 }),
    );
    expect(sockets.every((ws) => ws.closed === null)).toBe(true);

    const extra = join({ expMs: T0 + 600_000 });
    expect(extra.closed).toEqual({ code: ROOM_FULL_CLOSE, reason: 'room-full' });
    expect(info).toHaveBeenCalledWith('[room] full', { connections: ROOM_MAX_CONNECTIONS });

    sockets[0]!.close(1000, 'bye');
    expect(join({ expMs: T0 + 600_000 }).closed).toBeNull();
  });
});

describe('a revoked share link', () => {
  it('closes the sockets it admitted, and no other', async () => {
    const { design, join } = room();
    const owner = join({ expMs: T0 + 600_000 });
    const visitor = join({ role: 'view', code: 'CODE2345', expMs: T0 + 600_000 });
    const other = join({ role: 'view', code: 'OTHER234', expMs: T0 + 600_000 });

    const closed = await design.revokeCodes('P', ['CODE2345']);

    expect(closed).toBe(1);
    expect(visitor.closed).not.toBeNull();
    expect(owner.closed).toBeNull();
    expect(other.closed).toBeNull();
  });

  it('closes them too when the link is rescoped, so its visitors reload into what it now opens', async () => {
    const { design, join } = room();
    const owner = join({ expMs: T0 + 600_000 });
    const visitor = join({ role: 'view', code: 'CODE2345', expMs: T0 + 600_000 });

    const closed = await design.revokeCodes('P', ['CODE2345'], 'rescoped');

    expect(closed).toBe(1);
    expect(visitor.closed).not.toBeNull();
    expect(owner.closed).toBeNull();
  });
});
