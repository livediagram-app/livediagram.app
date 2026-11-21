// A Worker for automations.workerd.test.ts: a Space's real room (DocumentRoom, its real schema, routes and
// Automations engine) on workerd's own Durable Object SQLite, the runtime it ships on. The tests drive it as the api
// Worker does (`route`, with the identity and the index's grant the Worker would have settled), through the
// platform's test doors (@liveworkspace/automations/testing/worker: the alarm's share at a chosen time, a read of the
// room's tables, an Incoming Webhook call), and through `/attend`: a person's session moving into a tab or out of
// one at a chosen time, handed to the room's own Tab Attendance (room-attendance.ts noteAttendance) as a socket's
// hello and close are. Nothing here is deployed: wrangler.toml beside it has no route.
import {
  answerTestAsk,
  serveTestRoom,
  type TestAsk,
} from '@liveworkspace/automations/testing/worker';
import { DocumentRoom } from '../../src/document-room/document-room';
import type { RouteIdentity } from '../../src/document-room/document-route';
import { noteAttendance } from '../../src/document-room/room-attendance';
import type { SessionAttachment } from '../../src/room-session';

type Env = { DOCUMENT_ROOM: DurableObjectNamespace<TestRoom> };

// One person's session as `/attend` moves it: `tab` null closes it.
type AttendAsk = { person: string; name: string; tab: string | null; at: number };

const sessionOf = (a: AttendAsk, tab: string | null): SessionAttachment | null =>
  tab === null
    ? null
    : ({
        verifiedRole: 'edit',
        presence: { key: a.person, name: a.name, color: '#123456', tabId: tab },
      } as unknown as SessionAttachment);

export class TestRoom extends DocumentRoom {
  // Where each person's one session stands, for `/attend`.
  private readonly attending = new Map<string, string | null>();

  // One ask of the Space named `documentId`.
  async ask(documentId: string, path: string, ask: TestAsk): Promise<unknown> {
    this.bindDocument(documentId);
    if (path === '/attend') {
      const a = (ask as TestAsk & { attend: AttendAsk }).attend;
      const before = this.attending.get(a.person) ?? null;
      const ws = {} as WebSocket;
      noteAttendance(this, ws, sessionOf(a, before), sessionOf(a, a.tab), a.at);
      this.attending.set(a.person, a.tab);
      return { ok: true };
    }
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
