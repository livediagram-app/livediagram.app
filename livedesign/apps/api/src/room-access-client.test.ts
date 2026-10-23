import { describe, expect, it, vi } from 'vitest';
import { sentJson } from '@livedesign/vitest-config/sent-request';

import { closeWorkbenchSessions } from './room-access-client';
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

describe('closeWorkbenchSessions', () => {
  it("asks the design's room to close the pairing's sessions", async () => {
    const { env, calls } = roomsEnv();
    expect(await closeWorkbenchSessions(env, 'd1', 'pair1')).toBe(true);
    expect(calls).toEqual([
      { designId: 'd1', path: '/close-sessions', body: { match: 'workbench', pairingId: 'pair1' } },
    ]);
  });

  // Best-effort: the pairing is already ended, and every later join meets it.
  it('logs and answers false when the room cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { env } = roomsEnv(() => new Response(null, { status: 500 }));
    expect(await closeWorkbenchSessions(env, 'd1', 'pair1')).toBe(false);
    expect(warn.mock.calls[0]![0]).toBe('[room-access] close did not reach the room');
    warn.mockRestore();
  });
});

