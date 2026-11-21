// A Worker for automations.workerd.test.ts: a canvas's real room (DocumentRoom, its real schema, routes and
// Automations engine) on workerd's own Durable Object SQLite, the runtime it ships on. The tests drive it as the api
// Worker does (`route`, with the identity and the index's grant the Worker would have settled) and through the
// platform's test doors (@liveworkspace/automations/testing/worker: the alarm's share at a chosen time, a read of the
// room's tables, an Incoming Webhook call). `Bench` measures what the engine's SQL triggers cost a tab save. Nothing
// here is deployed: wrangler.toml beside it has no route.
import { DurableObject } from 'cloudflare:workers';
import {
  answerTestAsk,
  serveTestRoom,
  type TestAsk,
} from '@liveworkspace/automations/testing/worker';
import { DocumentRoom } from '../../src/document-room/document-room';
import type { RouteIdentity } from '../../src/document-room/document-route';
import { migrateDocumentSchema } from '../../src/document-room/document-schema';

type Env = {
  DOCUMENT_ROOM: DurableObjectNamespace<TestRoom>;
  BENCH: DurableObjectNamespace<Bench>;
};

export class TestRoom extends DocumentRoom {
  // One ask of the canvas named `documentId`.
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

// The tab save's own statement (@liveworkspace/index-app item-tab-writes.ts tabWriteStatements).
const SAVE = `INSERT INTO tabs (id, name, data, updated_at, element_count, rev)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         data = excluded.data,
         updated_at = excluded.updated_at,
         element_count = excluded.element_count,
         rev = tabs.rev + 1
       RETURNING rev`;

export class Bench extends DurableObject {
  // The canvas's schema with one tab; `triggers` false drops the engine's three, for the comparison.
  async setup(triggers: boolean): Promise<void> {
    const sql = this.ctx.storage.sql;
    migrateDocumentSchema((q) => sql.exec(q));
    sql.exec("INSERT OR IGNORE INTO document (id, saved_at, created_at) VALUES ('d', 1, 1)");
    sql.exec(SAVE, 't1', 'Tab', '{"elements":[]}', 1, 0, 1).toArray();
    sql.exec(
      "INSERT OR IGNORE INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d', 't1', 0, 1)",
    );
    if (triggers) return;
    for (const name of ['automation_tab_added', 'automation_tab_removed', 'automation_tab_edited'])
      sql.exec(`DROP TRIGGER IF EXISTS ${name}`);
  }

  // `n` tab saves; `fresh` gives each its own text, so each is compiled anew. Answers the milliseconds they took.
  async saves(n: number, fresh: boolean): Promise<number> {
    const sql = this.ctx.storage.sql;
    const stamp = Date.now();
    const started = performance.now();
    for (let i = 0; i < n; i += 1) {
      const query = fresh ? `${SAVE} /* ${stamp}-${i} */` : SAVE;
      sql.exec(query, 't1', 'Tab', '{"elements":[]}', i, 0, 1).toArray();
    }
    return performance.now() - started;
  }
}

type BenchAsk = { name?: string; setup?: boolean; n?: number; fresh?: boolean };

// The stub's RPC types wrap every answer for the wire; the shape here is the class's own.
type Remote = { ask: TestRoom['ask'] };

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === '/bench') {
      const ask = await request.json<BenchAsk>();
      const bench = env.BENCH.get(env.BENCH.idFromName(ask.name ?? 'doc'));
      if (ask.setup !== undefined) await bench.setup(ask.setup);
      return Response.json({ ms: await bench.saves(ask.n ?? 0, ask.fresh === true) });
    }
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
