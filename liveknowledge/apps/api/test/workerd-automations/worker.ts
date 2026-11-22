// A Worker for automations.workerd.test.ts: a document's real room (DocumentRoom, its real schema, routes and
// Automations engine) on workerd's own Durable Object SQLite, the runtime it ships on. The tests drive it as the api
// Worker does (`route`, with the identity and the index's grant the Worker would have settled) and through the
// platform's test doors (@liveworkspace/automations/testing/worker: the alarm's share at a chosen time, a read of the
// room's tables, an Incoming Webhook call). Nothing here is deployed: wrangler.toml beside it has no route.
import {
  answerTestAsk,
  serveTestRoom,
  type TestAsk,
} from '@liveworkspace/automations/testing/worker';
import { DocumentRoom } from '../../src/document-room/document-room';
import type { RouteIdentity } from '../../src/document-room/document-route';

type Env = { DOCUMENT_ROOM: DurableObjectNamespace<TestRoom> };

export class TestRoom extends DocumentRoom {
  // One ask of the document named `documentId`.
  async ask(documentId: string, path: string, ask: TestAsk): Promise<unknown> {
    this.bindDocument(documentId);
    return answerTestAsk(
      {
        route: (request, identity) => this.route(documentId, request, identity as RouteIdentity),
        engine: this.automations,
        sql: this.state.storage.sql,
        hook: (ruleId, call) => this.incomingHook(documentId, ruleId, call),
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
      (env.DOCUMENT_ROOM.get(env.DOCUMENT_ROOM.idFromName(name)) as unknown as Remote).ask(
        name,
        path,
        ask,
      ),
    );
  },
};

export default handler;
