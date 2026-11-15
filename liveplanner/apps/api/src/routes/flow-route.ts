// The flow charts' read (docs/specs/026-plan/plan-views.md "Flow charts", blueprint item-store.md "Flow read"): GET
// /projects/:id/flow?days=&types= for anyone who may read the plan, answering a range's daily flow counts and each
// card that moved in it with its kept moves (each a compact [at, from, to]), from which @liveplanner/items works out
// Cumulative Flow, Cycle Time and Throughput. Nothing is written; no author, tag or value leaves.

import type { FlowResponse } from '@liveplanner/api-schema';
import {
  DAY_MS,
  FLOW_DAYS_MAX,
  FLOW_RANGE_DEFAULT,
  ITEM_HISTORY_MAX_AGE_MS,
  ITEM_TYPES_MAX,
  flowDayOf,
  type FlowCard,
} from '@liveplanner/items';
import { readFlowCounts } from '../db/flow-counts';
import { readFlowCards, readFlowMoves } from '../db/flow-history';
import { json, methodNotAllowed } from '../responses';
import type { PlanRouteContext } from './context';
import { itemCaller } from './item-route-kit';

export type FlowQuery = { days: number; types: ReadonlySet<string> | null };

const refused = (error: string, status = 400) => json({ error }, { status });

// `days` (digits, 1 to FLOW_DAYS_MAX, FLOW_RANGE_DEFAULT when absent) and `types` (comma-separated type ids, at most
// ITEM_TYPES_MAX, every type when absent or empty). Read by splitting, never a regex.
export function flowQueryOf(params: URLSearchParams): FlowQuery | Response {
  const rawDays = params.get('days');
  let days = FLOW_RANGE_DEFAULT;
  if (rawDays !== null) {
    const digits =
      rawDays.length > 0 && rawDays.length <= 3 && [...rawDays].every((c) => c >= '0' && c <= '9');
    days = digits ? Number(rawDays) : 0;
    if (days < 1 || days > FLOW_DAYS_MAX) return refused('flow_range');
  }
  const ids = (params.get('types') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (ids.length > ITEM_TYPES_MAX) return refused('flow_types');
  return { days, types: ids.length > 0 ? new Set(ids) : null };
}

async function readFlow(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const caller = await itemCaller(ctx, projectId, 'read');
  if (caller instanceof Response) return caller;
  // The counts span every card: a link confined to a tab that shows only some holds no flow chart.
  if (caller.scope && !caller.scopeTakesNew) return refused('flow_needs_every_card', 403);
  const query = flowQueryOf(ctx.url.searchParams);
  if (query instanceof Response) return query;
  const now = Date.now();
  const toDay = flowDayOf(now);
  const fromDay = toDay - query.days + 1;
  const kept = now - ITEM_HISTORY_MAX_AGE_MS;
  const { types } = query;
  const [counts, moves] = await Promise.all([
    readFlowCounts(ctx.env, projectId, fromDay, toDay),
    readFlowMoves(ctx.env, projectId, kept),
  ]);
  // The cards that moved in the range; a start can be older than the range, so their moves reach back to `kept`.
  const rangeStart = fromDay * DAY_MS;
  const moved = new Set<string>();
  for (const move of moves) if (move.at >= rangeStart) moved.add(move.itemId);
  const cards = new Map<string, FlowCard>();
  for (const card of await readFlowCards(ctx.env, projectId, [...moved], kept))
    if (!types || types.has(card.type)) cards.set(card.id, { ...card, moves: [] });
  let steps = 0;
  for (const move of moves) {
    const card = cards.get(move.itemId);
    if (!card) continue;
    card.moves.push([move.at, move.from, move.to]);
    steps++;
  }
  const answer: FlowResponse = {
    fromDay,
    toDay,
    counts: types ? counts.filter((r) => types.has(r.type)) : counts,
    cards: [...cards.values()],
  };
  console.info('[items] flow.read', {
    projectId,
    days: query.days,
    counts: answer.counts.length,
    cards: cards.size,
    moves: steps,
  });
  return json(answer);
}

// /api/projects/:id/flow: segments[3] === 'flow'. Null for any other path.
export async function handleFlowRoute(ctx: PlanRouteContext): Promise<Response | null> {
  const { segments } = ctx;
  if (segments.length !== 4 || segments[3] !== 'flow') return null;
  if (ctx.request.method !== 'GET') return methodNotAllowed();
  return readFlow(ctx, segments[2]!);
}
