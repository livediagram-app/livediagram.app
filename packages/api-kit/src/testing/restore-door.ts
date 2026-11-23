// Tests only: one product api's restore door (liveworkspace/docs/specs/002-architecture/room-restore.md) through its
// real Worker, so every product proves the same things about its wiring: no door without OPERATOR_KEY, no one but the
// operator's key opens it (not a person's token, not another service's key), and each of its classes is reached by
// name. Rooms are stand-ins that record their calls; the restore itself on workerd is livediagram's
// test/workerd-restore.
import { describe, expect, it } from 'vitest';
import { ROOM_RESTORE_REASON, type RestoreTarget } from '../room-restore';

export interface RestoreDoorSuite {
  /** The api Worker's fetch, as deployed. */
  fetch: (request: Request, env: never) => Promise<Response>;
  /** The Worker's restorable classes, each with its binding's name. */
  classes: Record<string, string>;
  /** Another key the Worker holds (INDEX_KEY), which must not open the door. */
  otherKeyName: string;
}

const KEY = 'operator-key-under-test';
const OTHER = 'another-service-key';

function arrange(suite: RestoreDoorSuite, operatorKey: string | undefined) {
  const calls: string[] = [];
  const env: Record<string, unknown> = { [suite.otherKeyName]: OTHER };
  if (operatorKey !== undefined) env.OPERATOR_KEY = operatorKey;
  for (const [className, binding] of Object.entries(suite.classes))
    env[binding] = {
      idFromName: (name: string) => `${className}:${name}`,
      get: (id: string) => ({
        restorePrepare: async (target: RestoreTarget, dryRun: boolean) => {
          calls.push(`prepare ${id} ${JSON.stringify(target)} ${dryRun}`);
          return { bookmark: 'b0', undo: dryRun ? null : 'b1' };
        },
        restoreNow: async () => {
          calls.push(`now ${id}`);
          throw Object.assign(new Error(ROOM_RESTORE_REASON), { durableObjectReset: true });
        },
      }),
    };
  const send = (body: unknown, bearer: string | null) =>
    suite.fetch(
      new Request('https://api.test/api/internal/restore', {
        method: 'POST',
        headers: bearer === null ? {} : { Authorization: `Bearer ${bearer}` },
        body: JSON.stringify(body),
      }),
      env as never,
    );
  return { calls, send };
}

/** The door's suite for one product api. */
export function describeRestoreDoor(suite: RestoreDoorSuite): void {
  const [first] = Object.keys(suite.classes);
  const at = Date.now() - 60 * 60 * 1000;

  describe('the operator restore door', () => {
    it('is a 404 to everyone while no OPERATOR_KEY is set', async () => {
      for (const key of [undefined, '']) {
        const { calls, send } = arrange(suite, key);
        for (const bearer of [KEY, OTHER, null])
          expect((await send({ class: first, name: 'item-1', at }, bearer)).status).toBe(404);
        expect(calls).toEqual([]);
      }
    });

    it("opens to the operator's key alone: no Bearer, a wrong key, another service's key or a person's token is a 401", async () => {
      const { calls, send } = arrange(suite, KEY);
      for (const bearer of [
        null,
        `${KEY}-not`,
        OTHER,
        'lwt_0123456789abcdef',
        'eyJhbGciOiJFUzI1NiJ9.e30.sig',
      ])
        expect((await send({ class: first, name: 'item-1', at }, bearer)).status).toBe(401);
      expect(calls).toEqual([]);
    });

    it('restores a room of each class by its name, one at a time by default', async () => {
      for (const className of Object.keys(suite.classes)) {
        const { calls, send } = arrange(suite, KEY);
        const res = await send({ class: className, name: 'item-1', at }, KEY);
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({
          class: className,
          dryRun: false,
          rooms: [{ name: 'item-1', ok: true, bookmark: 'b0', undo: 'b1' }],
        });
        expect(calls).toEqual([
          `prepare ${className}:item-1 {"at":${at}} false`,
          `now ${className}:item-1`,
        ]);
      }
    });

    it("refuses a class that is not one of this Worker's", async () => {
      const { calls, send } = arrange(suite, KEY);
      const res = await send({ class: 'WorkbenchStore', name: 'item-1', at }, KEY);
      expect(res.status).toBe(400);
      expect(calls).toEqual([]);
    });
  });
}
