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
  // Every write body, and every create, in order.
  writes: { sheetId: string; write: SheetWrite; wid?: string }[];
  creates: unknown[];
  routes: Record<string, unknown>;
};

// The sheet routes of one document. `refuse` answers a write with that error instead (a 400, or `status`).
export function sheetServer(
  documentId: string,
  sheets: SheetJson[],
  opts: { refuse?: string; status?: number } = {},
): SheetServer {
  const server: SheetServer = { sheets, writes: [], creates: [], routes: {} };
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
    if (opts.refuse) return Response.json({ error: opts.refuse }, { status: opts.status ?? 400 });
    const at = server.sheets.findIndex((s) => s.id === sheetId);
    const landed = applySheetWrite(sheetFromJson(server.sheets[at]!), body.write, {
      now: 0,
      by: NOBODY,
    });
    const rev = server.sheets[at]!.rev + 1;
    server.sheets[at] = { ...sheetToJson(landed.sheet), rev };
    return Response.json({ applied: landed.applied, rev, cells: [] });
  };
  // Every sheet's writes, those made during the test included.
  const isWrites = (key: string | symbol) =>
    typeof key === 'string' && key.startsWith(`${base}/`) && key.endsWith('/writes');
  server.routes = new Proxy(server.routes, {
    has: (target, key) => isWrites(key) || key in target,
    get: (target, key) => (isWrites(key) ? writes : target[key as string]),
    ownKeys: (target) => Reflect.ownKeys(target),
  });
  return server;
}
