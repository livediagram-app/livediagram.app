// Tests only, inside workerd: the doors an app's test Worker adds to its real room (blueprint item-engine.md
// "Tests": the workerd harness). The app's test Worker subclasses its room with one RPC method, `ask`, that hands
// here; `serveTestRoom` is the Worker's fetch. The tests drive it through `workerd.ts`. Nothing here is deployed.
import type { HookAnswer, HookCall } from '../room/automation-incoming';
import type { ItemEngine } from '../room/item/engine';
import { runItemAutomations } from '../room/item/wake';
import type { Sql } from '../room/sql';

// One API request about the item, answered as the room answers the app's Worker. `identity` is the app's own.
export type TestDrive = { method: string; path: string; body?: unknown; identity: unknown };

// What a test asks of a room.
export type TestAsk = {
  name?: string;
  call?: TestDrive;
  now?: number;
  query?: string;
  bindings?: (string | number | null)[];
  ruleId?: string;
  hook?: {
    body: string;
    authorization: string | null;
    signature: string | null;
    timestamp?: string | null;
  };
};

// The app's room as the doors need it, its item bound.
export interface TestRoomDoors {
  route(request: Request, identity: unknown): Promise<Response>;
  engine: ItemEngine;
  sql: Sql;
  hook(ruleId: string, call: HookCall): Promise<HookAnswer>;
}

/** One ask of the room: `/drive` (an API request), `/automations` (the alarm's share, as though it rang at `now`),
 *  `/wake` (when the schedule next wakes), `/rows` (a read of its tables) and `/hook` (an Incoming Webhook call). */
export async function answerTestAsk(
  room: TestRoomDoors,
  path: string,
  ask: TestAsk,
): Promise<unknown> {
  switch (path) {
    case '/drive': {
      const call = ask.call!;
      const res = await room.route(
        new Request(`https://api.test${call.path}`, {
          method: call.method,
          headers: { 'Content-Type': 'application/json' },
          ...(call.body === undefined ? {} : { body: JSON.stringify(call.body) }),
        }),
        call.identity,
      );
      return { status: res.status, text: await res.text() };
    }
    case '/automations':
      await runItemAutomations(room.engine, ask.now ?? Date.now());
      return { ok: true };
    case '/wake':
      return { at: room.engine.schedule.wakeAt };
    case '/rows':
      return { rows: room.sql.exec(ask.query ?? '', ...(ask.bindings ?? [])).toArray() };
    case '/hook':
      return room.hook(ask.ruleId ?? '', {
        ...ask.hook!,
        body: new TextEncoder().encode(ask.hook!.body),
      });
    default:
      return null;
  }
}

/** The test Worker's fetch: the ask in the body, the room by `name` (`doc` when none is given). */
export async function serveTestRoom(
  request: Request,
  ask: (name: string, path: string, ask: TestAsk) => Promise<unknown>,
): Promise<Response> {
  const body = await request.json<TestAsk>().catch((): TestAsk => ({}));
  const answer = await ask(body.name ?? 'doc', new URL(request.url).pathname, body);
  return answer === null ? new Response('not found', { status: 404 }) : Response.json(answer);
}
