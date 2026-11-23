// A Worker for room-restore.workerd.test.ts: the operator's restore door (routes/operator-restore.ts, as the api
// answers it) in front of a canvas's real room (DocumentRoom) and a person's real store (PersonStore), on workerd's own
// Durable Object SQLite. The canvas is made and saved through its real routes (the platform's test doors,
// @liveworkspace/automations/testing/worker), and two doors of this Worker's own say which instance of an object
// answers (so a restart shows) and restart one directly (restoreNow, as the door's second half calls it). Nothing
// here is deployed: wrangler.toml beside it has no route.
import { isRoomRestart } from '@liveworkspace/api-kit/room-restore';
import {
  answerTestAsk,
  serveTestRoom,
  type TestAsk,
} from '@liveworkspace/automations/testing/worker';
import { DocumentRoom } from '../../src/document-room/document-room';
import type { RouteIdentity } from '../../src/document-room/document-route';
import { PersonStore } from '../../src/person-store/person-store';
import { handleOperatorRestore } from '../../src/routes/operator-restore';

type Env = {
  OPERATOR_KEY: string;
  DOCUMENT_ROOM: DurableObjectNamespace<TestRoom>;
  PERSON_STORE: DurableObjectNamespace<TestPerson>;
};

// Which instance of the object this is: a new one after every restart.
type Instance = { instance(): Promise<string>; restoreNow(): Promise<void> };

export class TestRoom extends DocumentRoom {
  readonly started = crypto.randomUUID();
  instance(): string {
    return this.started;
  }

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

export class TestPerson extends PersonStore {
  readonly started = crypto.randomUUID();
  instance(): string {
    return this.started;
  }
}

// The stub's RPC types wrap every answer for the wire; the shapes here are the classes' own.
type Remote = { ask: TestRoom['ask'] };

function objectOf(env: Env, which: string, name: string): Instance {
  const ns = (which === 'PersonStore' ? env.PERSON_STORE : env.DOCUMENT_ROOM) as unknown as {
    get(id: DurableObjectId): Instance;
    idFromName(name: string): DurableObjectId;
  };
  return ns.get(ns.idFromName(name));
}

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/api/internal/restore') return handleOperatorRestore(request, env);
    if (path === '/instance' || path === '/restart') {
      const { class: which, name } = await request.json<{ class: string; name: string }>();
      const object = objectOf(env, which, name);
      if (path === '/instance') return Response.json({ instance: await object.instance() });
      try {
        await object.restoreNow();
        return Response.json({ restarted: false });
      } catch (err) {
        return Response.json({ restarted: isRoomRestart(err), message: String(err) });
      }
    }
    return serveTestRoom(request, (name, at, ask) =>
      (env.DOCUMENT_ROOM.get(env.DOCUMENT_ROOM.idFromName(name)) as unknown as Remote).ask(
        name,
        at,
        ask,
      ),
    );
  },
};

export default handler;
