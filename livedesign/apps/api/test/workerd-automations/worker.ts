// A Worker for automations.workerd.test.ts: a design's real room (DesignRoom, its real schema, routes and
// Automations engine) on workerd's own Durable Object SQLite, the runtime it ships on. The tests drive it as the api
// Worker does (`route`, with the identity and the index's grant the Worker would have settled) and through the
// platform's test doors (@liveworkspace/automations/testing/worker: the alarm's share at a chosen time, a read of the
// room's tables, an Incoming Webhook call). Nothing here is deployed: wrangler.toml beside it has no route.
import {
  answerTestAsk,
  serveTestRoom,
  type TestAsk,
} from '@liveworkspace/automations/testing/worker';
import { DesignRoom } from '../../src/design-room/design-room';
import type { RouteIdentity } from '../../src/design-room/design-route';

type Env = { DESIGN_ROOM: DurableObjectNamespace<TestRoom> };

export class TestRoom extends DesignRoom {
  // One ask of the design named `designId`.
  async ask(designId: string, path: string, ask: TestAsk): Promise<unknown> {
    this.bindDesign(designId);
    return answerTestAsk(
      {
        route: (request, identity) => this.route(designId, request, identity as RouteIdentity),
        engine: this.automations,
        sql: this.state.storage.sql,
        hook: (ruleId, call) => this.incomingHook(designId, ruleId, call),
      },
      path,
      ask,
    );
  }
}

// The stub's RPC types wrap every answer for the wire; the shape here is the class's own.
type Remote = { ask: TestRoom['ask'] };

const handler = {
  fetch(request: Request, env: Env): Promise<Response> {
    return serveTestRoom(request, (name, path, ask) =>
      (env.DESIGN_ROOM.get(env.DESIGN_ROOM.idFromName(name)) as unknown as Remote).ask(
        name,
        path,
        ask,
      ),
    );
  },
};

export default handler;
