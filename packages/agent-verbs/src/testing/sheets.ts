// A sheet store for the sheet suites: sheets built from rows of typed values by the engine itself, and the routes
// the api serves for them (list, create, write), applying each write as the api does and keeping what it was sent.
import {
  AGENT_LOCALE,
  applySheetWrite,
  emptyLayout,
  emptySheet,
  NOBODY,
  sheetFromJson,
  sheetToJson,
  Workbook,
  writeRows,
  type AgentValue,
  type SheetJson,
  type SheetWrite,
} from '@livediagram/sheets';

// A seeded random, so row and column ids are the same every run.
export function seeded(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function sheetJson(
  init: { id: string; tabId: string; title: string; createdAt?: number },
  rows: AgentValue[][] = [],
): SheetJson {
  const rand = seeded(init.id.length * 31 + init.title.length);
  const blank = {
    ...emptySheet({ id: init.id, tabId: init.tabId, title: init.title, layout: emptyLayout(rand) }),
    createdAt: init.createdAt ?? 0,
  };
  if (!rows.length) return sheetToJson(blank);
  const made = writeRows(
    new Workbook({ sheets: [blank], locale: AGENT_LOCALE }),
    init.id,
    'A1',
    rows,
    rand,
  );
  if (!made.ok) throw new Error(`fixture: ${made.error}`);
  return sheetToJson(applySheetWrite(blank, made.write, { now: 0, by: NOBODY }).sheet);
}

export type SheetServer = {
  sheets: SheetJson[];
  // Every write body, every create and every deleted sheet id, in order.
  writes: { sheetId: string; write: SheetWrite; wid?: string }[];
  creates: unknown[];
  deletes: string[];
  routes: Record<string, unknown>;
};

// The sheet routes of one document (list, create, delete, write). `refuse` answers a write with that error instead
// (a 400, or `status`), from the write after the first `refuseAfter` (every write when absent).
export function sheetServer(
  documentId: string,
  sheets: SheetJson[],
  opts: { refuse?: string; status?: number; refuseAfter?: number } = {},
): SheetServer {
  const server: SheetServer = { sheets, writes: [], creates: [], deletes: [], routes: {} };
  const base = `/documents/${documentId}/sheets`;
  server.routes[base] = async (r: Request) => {
    if (r.method === 'POST') {
      const body = (await r.json()) as SheetJson;
      server.creates.push(body);
      const made = sheetToJson(
        emptySheet({ id: body.id, tabId: body.tabId, title: body.title, layout: body.layout }),
      );
      server.sheets.push(made);
      return Response.json({ sheet: made }, { status: 201 });
    }
    const tabId = new URL(r.url).searchParams.get('tabId');
    return Response.json({ sheets: server.sheets.filter((s) => !tabId || s.tabId === tabId) });
  };
  const writes = async (r: Request) => {
    const sheetId = new URL(r.url).pathname.split('/').at(-2)!;
    const body = (await r.json()) as { write: SheetWrite; wid?: string };
    server.writes.push({ sheetId, ...body });
    if (opts.refuse && server.writes.length > (opts.refuseAfter ?? 0))
      return Response.json({ error: opts.refuse }, { status: opts.status ?? 400 });
    const at = server.sheets.findIndex((s) => s.id === sheetId);
    const landed = applySheetWrite(sheetFromJson(server.sheets[at]!), body.write, {
      now: 0,
      by: NOBODY,
    });
    const rev = server.sheets[at]!.rev + 1;
    server.sheets[at] = { ...sheetToJson(landed.sheet), rev };
    return Response.json({ applied: landed.applied, rev, cells: [] });
  };
  const remove = (r: Request) => {
    if (r.method !== 'DELETE') return Response.json({ error: 'not_found' }, { status: 404 });
    const sheetId = new URL(r.url).pathname.split('/').at(-1)!;
    server.deletes.push(sheetId);
    server.sheets = server.sheets.filter((s) => s.id !== sheetId);
    return new Response(null, { status: 204 });
  };
  // Every sheet's writes and deletes, those made during the test included.
  const isWrites = (key: string | symbol) =>
    typeof key === 'string' && key.startsWith(`${base}/`) && key.endsWith('/writes');
  const isSheet = (key: string | symbol) =>
    typeof key === 'string' &&
    key.startsWith(`${base}/`) &&
    !key.slice(base.length + 1).includes('/');
  server.routes = new Proxy(server.routes, {
    has: (target, key) => isWrites(key) || isSheet(key) || key in target,
    get: (target, key) => (isWrites(key) ? writes : isSheet(key) ? remove : target[key as string]),
    ownKeys: (target) => Reflect.ownKeys(target),
  });
  return server;
}
