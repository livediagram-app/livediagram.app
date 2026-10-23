import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sentJson } from '@livedesign/vitest-config/sent-request';

const { db } = vi.hoisted(() => ({ db: { listDesignsByTeam: vi.fn() } }));
vi.mock('./db', () => db);

import { personTagFor } from './person-tag';
import {
  closeMemberTeamSessions,
  closeShareCodeSessions,
  TEAM_ROOM_CLOSE_CONCURRENCY,
  TEAM_ROOM_CLOSE_MAX_DESIGNS,
} from './room-access-client';
import type { Env } from './types';

// One fake room per design id, recording what each was asked and how many were in flight at once.
function roomsEnv(
  answer: (designId: string) => Response | Promise<Response> = () =>
    new Response(null, { status: 204 }),
) {
  const calls: { designId: string; path: string; body: unknown }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const env = {
    DESIGN_ROOM: {
      idFromName: (name: string) => name,
      get: (designId: string) => ({
        fetch: async (url: string, init: RequestInit) => {
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await Promise.resolve();
          calls.push({
            designId,
            path: new URL(url).pathname,
            body: sentJson(init),
          });
          inFlight--;
          return answer(designId);
        },
      }),
    },
  } as unknown as Env;
  return { env, calls, maxInFlight: () => maxInFlight };
}

beforeEach(() => db.listDesignsByTeam.mockReset());

describe('closeShareCodeSessions', () => {
  it("asks the design's room to close its share-code sessions", async () => {
    const { env, calls } = roomsEnv();
    expect(await closeShareCodeSessions(env, 'd1')).toBe(true);
    expect(calls).toEqual([
      { designId: 'd1', path: '/close-sessions', body: { match: 'share-code' } },
    ]);
  });

  // Best-effort: the password is already stored, and every later join meets it.
  it('logs and answers false when the room cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { env } = roomsEnv(() => new Response(null, { status: 500 }));
    expect(await closeShareCodeSessions(env, 'd1')).toBe(false);
    expect(warn.mock.calls[0]![0]).toBe('[room-access] close did not reach the room');
    warn.mockRestore();
  });
});

describe('closeMemberTeamSessions', () => {
  const docs = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `d${i}` }));

  it("closes the member's sessions on every team design by its own person tag", async () => {
    db.listDesignsByTeam.mockResolvedValue(docs(3));
    const { env, calls } = roomsEnv();
    const result = await closeMemberTeamSessions(env, 'team-1', 'user_gone');
    expect(result).toEqual({ rooms: 3, unreached: 0, truncated: false });
    for (const id of ['d0', 'd1', 'd2']) {
      const call = calls.find((c) => c.designId === id)!;
      expect(call.body).toEqual({
        match: 'person',
        personTag: await personTagFor(id, 'user_gone'),
      });
    }
  });

  it('never has more rooms in flight than the concurrency bound', async () => {
    db.listDesignsByTeam.mockResolvedValue(docs(35));
    const rooms = roomsEnv();
    await closeMemberTeamSessions(rooms.env, 'team-1', 'user_gone');
    expect(rooms.calls).toHaveLength(35);
    expect(rooms.maxInFlight()).toBeLessThanOrEqual(TEAM_ROOM_CLOSE_CONCURRENCY);
  });

  it('stops at the design cap and says so', async () => {
    db.listDesignsByTeam.mockResolvedValue(docs(TEAM_ROOM_CLOSE_MAX_DESIGNS + 7));
    const { env, calls } = roomsEnv();
    const result = await closeMemberTeamSessions(env, 'team-1', 'user_gone');
    expect(calls).toHaveLength(TEAM_ROOM_CLOSE_MAX_DESIGNS);
    expect(result.truncated).toBe(true);
  });

  it('counts rooms it could not reach and carries on with the rest', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    db.listDesignsByTeam.mockResolvedValue(docs(3));
    const { env, calls } = roomsEnv(
      (id) => new Response(null, { status: id === 'd1' ? 503 : 204 }),
    );
    const result = await closeMemberTeamSessions(env, 'team-1', 'user_gone');
    expect(calls).toHaveLength(3);
    expect(result.unreached).toBe(1);
  });
});
