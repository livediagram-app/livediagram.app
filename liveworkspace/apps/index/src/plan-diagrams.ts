// Diagrams and Plans on the index (liveworkspace/docs/specs/004-index/diagrams-and-plans.md, its blueprint):
//
//   POST /items/:id/plan-makes         Make Plan Cards: a diagram's shapes made cards in the plan `id`   → 201
//   POST /items/:id/plan-views         View As Diagram: the plan's board drawn as a new live diagram     → 201
//   POST /items/:id/plan-edits         the changes a drawn diagram offers, applied as the person        → 200
//   POST /app/items/:id/plan-diagrams  liveplanner: its live diagrams whose graph changed, redrawn       → 200
//
// The cards are written only by liveplanner's own door, on the person's grant, which the door checks again; the
// diagrams only by livediagram's, for an owner the index checked. A shape's card is a Send to Plan send of kind
// `element`, so its chip, Sent From and purges are Send to Plan's (plan-sends.ts).

import {
  ITEM_GRANT_HEADER,
  PLAN_SEND_TEXT_MAX,
  PLAN_SEND_TITLE_MAX,
  PLAN_SENDS_PER_SOURCE_MAX,
  planDiagramDoorPath,
  planSendDescription,
  planSendRef,
  readPlanDiagramGraph,
  readPlanEdits,
  readPlanMakeAsk,
  readPlanViewAsk,
  readPlanViewRedraws,
  type App,
  type Level,
  type PlanDiagramDoorCall,
  type PlanDiagramDraw,
  type PlanDiagramGraph,
  type PlanEditResult,
  type PlanSendPlace,
  type PlanViewRedrawStatus,
  type SentFrom,
} from '@liveworkspace/index-client';
import { APP_ITEMS } from '@liveworkspace/sites';
import { loadItem } from './access';
import { callAppForJson, eachLimited } from './app-calls';
import type { Caller, Person } from './auth';
import { isId } from './codec';
import { APP_CALL_TIMEOUT_MS, KIT_CREATE_TIMEOUT_MS } from './config';
import { appSiteOrigin } from './connection-rows';
import type { RouteContext } from './context';
import type { Env } from './env';
import { mintGrant } from './grants';
import { badRequest, fail, forbidden, json, notFound, readObject } from './http';
import { overRunLimit } from './kits';
import {
  insertSendRows,
  newSendId,
  placeLink,
  sender,
  sendOf,
  type SendInsertRow,
} from './plan-sends';
import { getItemRow, type ItemRow } from './rows';

const PLAN_APP = 'liveplanner' as const;
const DIAGRAM_APP = 'livediagram' as const;
// Redraws run a few at a time: each is a layout and a changeset in livediagram.
const REDRAW_CONCURRENCY = 3;
const COLUMN_MAX = 120;

const enc = encodeURIComponent;
const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);
const asPerson = (id: string): Caller => ({
  person: { id, kind: 'account', teams: [] },
  share: null,
});
const doorPath = (planId: string) => planDiagramDoorPath(planId).slice('/api/internal'.length);

/** The plan's board, as its own address opens it (the caption's link). */
export const planBoardLink = (env: Pick<Env, 'ENVIRONMENT'>, planId: string): string =>
  `${appSiteOrigin(env, PLAN_APP)}${APP_ITEMS[PLAN_APP].itemPath}${enc(planId)}`;

/** The caption under a drawn board's title: where it is drawn from, and how much of it. */
export function planCaption(planTitle: string, graph: PlanDiagramGraph): string {
  const base = `Drawn live from ${planTitle || 'Untitled plan'}`;
  return graph.total > graph.nodes.length
    ? `${base}: ${graph.nodes.length} of ${graph.total} cards`
    : base;
}

// The plan, on the person's own access at `level`, a live plan.
async function planFor(
  env: Env,
  planId: string,
  person: Person,
  level: 'edit' | 'view',
): Promise<{ row: ItemRow; level: Level; code: string | null } | Response> {
  const plan = await loadItem(env, planId, { person, share: null }, level);
  if (plan instanceof Response) return plan;
  if (plan.row.app !== PLAN_APP) return forbidden();
  if (level === 'edit' && plan.access.tabId !== null) return forbidden();
  if (plan.row.trashed_at !== null || plan.row.archived_at !== null) return notFound();
  return { row: plan.row, level: plan.access.level, code: plan.access.code };
}

async function grantFor(
  env: Env,
  person: Person,
  plan: { row: ItemRow; level: Level; code: string | null },
): Promise<string | null> {
  const minted = await mintGrant(env, {
    app: PLAN_APP,
    sub: person.id,
    itemId: plan.row.id,
    level: plan.level,
    tabId: null,
    ownerId: plan.row.owner_id,
    teamId: plan.row.team_id,
    link: plan.code,
  });
  return minted?.grant ?? null;
}

async function callDoor(
  env: Env,
  planId: string,
  grant: string,
  call: PlanDiagramDoorCall,
  timeout = APP_CALL_TIMEOUT_MS,
) {
  return callAppForJson(env, PLAN_APP, doorPath(planId), call, timeout, {
    [ITEM_GRANT_HEADER]: grant,
  });
}

// The door's refusal, as the editor hears it.
function refused(res: { ok: false; error: string }): Response {
  console.warn('[index] plan diagram door not taken', { error: res.error });
  if (res.error === 'status_403' || res.error === 'status_404') return forbidden();
  return fail(503, 'plan_unavailable');
}

type LiveSend = { ref: string; card_id: string };

/** POST /items/:id/plan-makes: Make Plan Cards into the plan `planId`. */
async function makePlanCards(ctx: RouteContext, planId: string): Promise<Response> {
  const { env } = ctx;
  const person = sender(ctx);
  if (person instanceof Response) return person;
  const limited = await overRunLimit(env, `plan-make:${person.id}`);
  if (limited) return limited;
  const ask = readPlanMakeAsk(await readObject(ctx.request));
  if (!ask) return badRequest();

  const plan = await planFor(env, planId, person, 'edit');
  if (plan instanceof Response) return plan;
  // The diagram: the person's own read, any level, a diagram.
  const source = await loadItem(env, ask.source.itemId, { person, share: null }, 'view');
  if (source instanceof Response) return source.status === 403 ? notFound() : source;
  if (source.row.app !== DIAGRAM_APP) return badRequest();

  const app: App = DIAGRAM_APP;
  const placeOf = (element: string): PlanSendPlace => ({
    app,
    itemId: source.row.id,
    kind: 'element',
    tabId: ask.source.tabId,
    elementId: element,
    part: null,
    label: ask.source.label,
    text: '',
  });
  // The diagram's live cards in this plan, by the shape's ref: a shape with one updates it.
  const live =
    (
      await env.INDEX_DB.prepare(
        `SELECT ref, card_id FROM plan_sends
         WHERE plan_id = ? AND source_id = ? AND gone = 0 AND kind = 'element' ORDER BY at DESC`,
      )
        .bind(planId, source.row.id)
        .all<LiveSend>()
    ).results ?? [];
  const cardOfRef = new Map<string, string>();
  for (const r of live) if (!cardOfRef.has(r.ref)) cardOfRef.set(r.ref, r.card_id);
  const ours = new Set(live.map((r) => r.card_id));
  // Make Plan Cards takes back only cards this diagram made in this plan.
  if (ask.trash?.some((id) => !ours.has(id))) return badRequest();

  const fresh = ask.cards.filter((c) => !cardOfRef.has(planSendRef(placeOf(c.element))));
  const held = await env.INDEX_DB.prepare(
    'SELECT COUNT(*) AS n FROM plan_sends WHERE source_id = ?',
  )
    .bind(source.row.id)
    .first<{ n: number }>();
  if ((held?.n ?? 0) + fresh.length > PLAN_SENDS_PER_SOURCE_MAX) return fail(409, 'source_full');

  const grant = await grantFor(env, person, plan);
  if (!grant) return fail(503, 'grants_unavailable');
  const call: PlanDiagramDoorCall = {
    op: 'make',
    person: person.id,
    board: ask.board,
    column: ask.column,
    trash: ask.trash ?? [],
    cards: ask.cards.map((card) => {
      const place = { ...placeOf(card.element), text: card.text };
      const link = placeLink(env, place);
      const sentFrom: SentFrom = {
        app,
        itemId: source.row.id,
        title: cut(source.row.title, PLAN_SEND_TITLE_MAX),
        kind: 'element',
        label: ask.source.label,
        text: cut(card.text, PLAN_SEND_TEXT_MAX),
        link,
      };
      const cardId = cardOfRef.get(planSendRef(place));
      const { text: _text, ...rest } = card;
      return {
        ...rest,
        ...(cardId ? { cardId } : {}),
        description: cut(
          planSendDescription([place], {
            title: source.row.title,
            label: ask.source.label,
            app,
            link,
          }),
          PLAN_SEND_TEXT_MAX * 2,
        ),
        sentFrom,
      };
    }),
  };
  const res = await callDoor(env, planId, grant, call, KIT_CREATE_TIMEOUT_MS);
  if (!res.ok) return refused(res);
  const answer = res.body;
  if (answer.ok !== true || !Array.isArray(answer.cards)) {
    const reason = typeof answer.reason === 'string' ? answer.reason.slice(0, 200) : '';
    const code = typeof answer.code === 'string' ? answer.code : 'failed';
    return json({ error: 'plan_refused', code, reason }, { status: 422 });
  }
  const now = Date.now();
  const rows: SendInsertRow[] = [];
  let made = 0;
  let updated = 0;
  for (const c of answer.cards as Record<string, unknown>[]) {
    if (!c || !isId(c.id) || typeof c.element !== 'string') continue;
    if (c.made !== true) {
      updated += 1;
      continue;
    }
    made += 1;
    rows.push({
      id: newSendId(),
      source_id: source.row.id,
      ref: planSendRef(placeOf(c.element)),
      kind: 'element',
      plan_id: planId,
      card_id: c.id,
      card_title: cut(typeof c.title === 'string' ? c.title : '', PLAN_SEND_TITLE_MAX),
      column_name: cut(typeof c.column === 'string' ? c.column : ask.column, COLUMN_MAX),
      at: now,
    });
  }
  await insertSendRows(env, rows);
  const trashed = typeof answer.trashed === 'number' ? answer.trashed : 0;
  const skipped = typeof answer.skipped === 'number' ? answer.skipped : 0;
  console.info('[index] plan make', { made, updated, trashed, skipped });
  const sends = rows.map((r) => sendOf(env, { ...r, kind: 'element', done: 0 }, plan.row.title));
  return json({ sends, made, updated, trashed, skipped }, { status: 201 });
}

// livediagram's door: a new diagram, or a tab redrawn. Its answer's ids, or why not.
async function drawDiagram(
  env: Env,
  draw: PlanDiagramDraw,
): Promise<{ ok: true; id: string; tabId: string } | { ok: false; gone: boolean }> {
  const res = await callAppForJson(env, DIAGRAM_APP, '/items/plan-diagram', draw, KIT_CREATE_TIMEOUT_MS);
  if (!res.ok) {
    console.warn('[index] plan diagram not drawn', { error: res.error });
    return { ok: false, gone: res.error === 'status_404' };
  }
  const { id, tabId } = res.body;
  return isId(id) && isId(tabId) ? { ok: true, id, tabId } : { ok: false, gone: false };
}

/** POST /items/:id/plan-views: View As Diagram, the board drawn as a new diagram of the person's own, kept live. */
async function viewAsDiagram(ctx: RouteContext, planId: string): Promise<Response> {
  const { env } = ctx;
  const person = sender(ctx);
  if (person instanceof Response) return person;
  const limited = await overRunLimit(env, `plan-view:${person.id}`);
  if (limited) return limited;
  const ask = readPlanViewAsk(await readObject(ctx.request));
  if (!ask) return badRequest();
  const plan = await planFor(env, planId, person, 'view');
  if (plan instanceof Response) return plan;
  const grant = await grantFor(env, person, plan);
  if (!grant) return fail(503, 'grants_unavailable');
  const filtered = ask.filtered === true;

  const read = await callDoor(env, planId, grant, {
    op: 'graph',
    person: person.id,
    board: ask.board,
    filtered,
  });
  if (!read.ok) return refused(read);
  const graph = read.body.ok === true ? readPlanDiagramGraph(read.body.graph) : null;
  if (!graph) {
    console.warn('[index] plan graph refused', { code: read.body.code });
    return fail(read.body.code === 'target_gone' ? 404 : 503, 'plan_unavailable');
  }
  const drawn = await drawDiagram(env, {
    owner: person.id,
    name: ask.name,
    graph,
    caption: planCaption(plan.row.title, graph),
    link: planBoardLink(env, planId),
  });
  if (!drawn.ok) return fail(503, 'plan_diagram_unavailable');
  const watched = await callDoor(env, planId, grant, {
    op: 'watch',
    person: person.id,
    board: ask.board,
    filtered,
    diagramId: drawn.id,
    tabId: drawn.tabId,
  });
  // The diagram stands drawn whether or not the plan could remember it; it is then the drawing as of now.
  if (!watched.ok) console.warn('[index] plan view not watched', { error: watched.error });
  const row = await getItemRow(env, drawn.id);
  const critical = graph.nodes.filter((n) => n.critical).length;
  console.info('[index] plan view', { cards: graph.nodes.length, links: graph.edges.length });
  return json(
    {
      diagram: {
        id: drawn.id,
        title: row?.title ?? ask.name,
        tabId: drawn.tabId,
        link: placeLink(env, {
          app: DIAGRAM_APP,
          itemId: drawn.id,
          kind: 'element',
          tabId: drawn.tabId,
          elementId: null,
        }),
      },
      cards: graph.nodes.length,
      links: graph.edges.length,
      critical,
    },
    { status: 201 },
  );
}

/** POST /items/:id/plan-edits: a drawn diagram's changes, applied by liveplanner as the person (Edit, whole plan). */
async function applyPlanEdits(ctx: RouteContext, planId: string): Promise<Response> {
  const { env } = ctx;
  const person = sender(ctx);
  if (person instanceof Response) return person;
  const edits = readPlanEdits(await readObject(ctx.request));
  if (!edits) return badRequest();
  const plan = await planFor(env, planId, person, 'edit');
  if (plan instanceof Response) return plan;
  const grant = await grantFor(env, person, plan);
  if (!grant) return fail(503, 'grants_unavailable');
  const res = await callDoor(env, planId, grant, { op: 'edit', person: person.id, edits });
  if (!res.ok) return refused(res);
  const results = Array.isArray(res.body.results)
    ? (res.body.results as PlanEditResult[]).slice(0, edits.length)
    : [];
  console.info('[index] plan edits', {
    applied: results.filter((r) => r?.status === 'applied').length,
  });
  return json({ results });
}

export async function handlePlanDiagramRoutes(
  ctx: RouteContext,
  id: string,
  route: string,
): Promise<Response> {
  if (ctx.request.method !== 'POST') return notFound();
  if (route === 'plan-makes') return makePlanCards(ctx, id);
  if (route === 'plan-views') return viewAsDiagram(ctx, id);
  if (route === 'plan-edits') return applyPlanEdits(ctx, id);
  return notFound();
}

// Whether the maker may still keep the view: reads the plan, edits the whole diagram, neither in the Trash.
async function makerMay(env: Env, planId: string, diagramId: string, person: string) {
  const [plan, diagram] = await Promise.all([
    loadItem(env, planId, asPerson(person), 'view'),
    loadItem(env, diagramId, asPerson(person), 'edit'),
  ]);
  for (const r of [plan, diagram]) if (r instanceof Response) await r.body?.cancel();
  if (plan instanceof Response || diagram instanceof Response) return false;
  if (diagram.row.app !== DIAGRAM_APP || diagram.access.tabId !== null) return false;
  return [plan.row, diagram.row].every((r) => r.trashed_at === null && r.archived_at === null);
}

/** POST /app/items/:id/plan-diagrams: liveplanner's live diagrams whose graph changed, each redrawn as its maker. */
export async function handlePlanDiagrams(
  request: Request,
  env: Env,
  app: App,
  planId: string,
): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  const row = await getItemRow(env, planId);
  if (!row) return notFound();
  if (row.app !== app || app !== PLAN_APP) return fail(403, 'wrong_app');
  const views = readPlanViewRedraws(await readObject(request));
  if (!views) return badRequest();
  const out: { diagramId: string; status: PlanViewRedrawStatus }[] = [];
  await eachLimited(views, REDRAW_CONCURRENCY, async (view) => {
    if (!(await makerMay(env, planId, view.diagramId, view.person))) {
      out.push({ diagramId: view.diagramId, status: 'gone' });
      return;
    }
    const drawn = await drawDiagram(env, {
      owner: view.person,
      // A redraw keeps the tab's own name; the door reads this only for a new diagram.
      name: row.title || 'Plan',
      graph: view.graph,
      caption: planCaption(row.title, view.graph),
      link: planBoardLink(env, planId),
      itemId: view.diagramId,
      tabId: view.tabId,
    });
    out.push({
      diagramId: view.diagramId,
      status: drawn.ok ? 'ok' : drawn.gone ? 'gone' : 'failed',
    });
  });
  console.info('[index] plan diagrams redrawn', {
    views: views.length,
    gone: out.filter((v) => v.status === 'gone').length,
  });
  return json({ views: out });
}
