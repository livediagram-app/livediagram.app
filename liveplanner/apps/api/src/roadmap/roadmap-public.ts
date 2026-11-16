// A public roadmap's read and vote, inside the plan's room (docs/specs/026-plan/public-roadmap.md "How it answers";
// blueprint public-roadmap.md "Behaviour and state"). Reached only through the room's `roadmap` RPC, which answers as
// no one and has already turned away an id nothing has written and a plan archived or in the Trash.
//
//   GET  /api/roadmaps/:planId/:code[?browser=]    the roadmap, built fresh from the plan's tables
//   POST /api/roadmaps/:planId/:code/votes         { card, browser, up, website }: an upvote given or taken back
import {
  ROADMAP_BROWSER_PATTERN,
  ROADMAP_CODE_PATTERN,
  type RoadmapVoteResponse,
} from '@liveplanner/api-schema';
import { formLook } from '@liveplanner/project';
import {
  ITEM_WRITE_RETRIES,
  hasPublicVote,
  itemVoteTotal,
  withPublicVote,
  type Item,
  type PublicVoteResult,
} from '@liveplanner/items';
import {
  fieldsGrowth,
  getFormLink,
  getTab,
  listItems,
  planFullFor,
  readItems,
  updateItemsAtRev,
} from '../db';
import { readFormTab } from '../forms/form-tab';
import type { PlanRouteContext } from '../routes/context';
import { itemBusy, itemRetryPause, planFull, relay } from '../routes/item-route-kit';
import { publicAnswer, publicRefusal, roadmapMissed } from './roadmap-answer';
import {
  boardOnTab,
  formStatusesOf,
  landsOnRoadmap,
  planTypesOf,
  publishable,
} from './roadmap-boards';
import { publicVoterId } from './roadmap-code';
import {
  giveBackRoadmapVote,
  roadmapByCode,
  takeRoadmapVote,
  type RoadmapRow,
} from './roadmap-store';
import { onRoadmap, publicRoadmapOf } from './roadmap-view';

// How many votes one roadmap takes an hour from everyone, as a form's responses (forms.md "Abuse and limits").
// Safe range 100..2000.
export const ROADMAP_VOTES_PER_HOUR = 500;
const CARD_ID_MAX = 200;
const PLAN_ID = /^[A-Za-z0-9_-]{1,200}$/;

// The board a roadmap shows, as its tab holds it now; null once it is gone or can no longer be published.
async function boardOf(ctx: PlanRouteContext, planId: string, roadmap: RoadmapRow) {
  const tab = await getTab(ctx.env, planId, roadmap.tabId);
  const setup = tab ? boardOnTab(tab.elements, roadmap.boardId) : null;
  return tab && setup && publishable(setup) ? { tab, setup } : null;
}

// The suggestion form's page, while its link is live and its cards land in a column the roadmap does not show.
async function suggestPathOf(
  ctx: PlanRouteContext,
  planId: string,
  roadmap: RoadmapRow,
): Promise<string | null> {
  const code = roadmap.settings.formCode;
  if (!code) return null;
  const link = await getFormLink(ctx.env, code);
  if (!link || link.project_id !== planId || link.suspended_at !== null || link.deleted_at !== null)
    return null;
  const found = await readFormTab(ctx.env, planId, link.tab_id);
  const statuses = found ? formStatusesOf(found.form) : [];
  if (statuses.length === 0 || landsOnRoadmap(statuses, roadmap.settings.columns)) return null;
  return `/form/${code}`;
}

const browserOf = (raw: unknown): string | null =>
  typeof raw === 'string' && ROADMAP_BROWSER_PATTERN.test(raw) ? raw : null;

async function read(ctx: PlanRouteContext, planId: string, roadmap: RoadmapRow) {
  const board = await boardOf(ctx, planId, roadmap);
  if (!board) return roadmapMissed('no_board');
  const browser = browserOf(ctx.url.searchParams.get('browser'));
  const [types, items, suggestPath, voter] = await Promise.all([
    planTypesOf(ctx.env, planId),
    listItems(ctx.env, planId),
    suggestPathOf(ctx, planId, roadmap),
    browser ? publicVoterId(planId, browser) : Promise.resolve(null),
  ]);
  return publicAnswer(
    publicRoadmapOf({
      settings: roadmap.settings,
      setup: board.setup,
      items,
      types,
      look: formLook(board.tab),
      voter,
      suggestPath,
    }),
  );
}

type VoteBody = { card: string; browser: string; up: boolean; website: unknown };

async function voteBodyOf(request: Request): Promise<VoteBody | null> {
  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') return null;
  const { card, up, website } = raw;
  const browser = browserOf(raw['browser']);
  if (typeof card !== 'string' || !card || card.length > CARD_ID_MAX) return null;
  if (!browser || typeof up !== 'boolean') return null;
  return { card, browser, up, website };
}

const voteLog = (result: string) => console.info('[roadmap] vote', { result });

async function vote(ctx: PlanRouteContext, planId: string, roadmap: RoadmapRow) {
  const body = await voteBodyOf(ctx.request);
  if (!body) return publicRefusal('roadmap_vote_invalid', 400);
  if (!roadmap.settings.voting) return roadmapMissed('voting_off');
  // The hidden field: a person never fills it, so a bot learns nothing from the answer it gets.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    voteLog('dropped');
    const dropped: RoadmapVoteResponse = { votes: 0, voted: false };
    return publicAnswer(dropped, 201);
  }
  const board = await boardOf(ctx, planId, roadmap);
  if (!board) return roadmapMissed('no_board');
  const types = await planTypesOf(ctx.env, planId);
  if (!(await takeRoadmapVote(ctx.env, roadmap.code, Date.now(), ROADMAP_VOTES_PER_HOUR))) {
    voteLog('busy');
    return publicRefusal('roadmap_busy', 429);
  }
  const voter = await publicVoterId(planId, body.browser);
  const result = await writeVote(ctx, planId, body.card, (item) =>
    onRoadmap(roadmap.settings, board.setup, item, types)
      ? withPublicVote(item, voter, body.up)
      : null,
  );
  // Only a change counts against the hour.
  if (result.kind !== 'changed') await giveBackRoadmapVote(ctx.env, roadmap.code);
  if (result.kind === 'refused') return result.response;
  if (result.kind === 'missing') return publicRefusal('card_not_found', 404);
  if (result.kind === 'full') {
    voteLog('full');
    return publicRefusal('roadmap_votes_full', 409);
  }
  voteLog(result.kind === 'same' ? 'same' : body.up ? 'added' : 'removed');
  const answer: RoadmapVoteResponse = {
    votes: itemVoteTotal(result.item),
    voted: hasPublicVote(result.item, voter),
  };
  return publicAnswer(answer);
}

type VoteWrite =
  | { kind: 'changed' | 'same'; item: Item }
  | { kind: 'missing' }
  | { kind: 'full' }
  | { kind: 'refused'; response: Response };

// One card's votes written, guarded by the rev read and retried when a concurrent write moved it on (as every item
// write is, items.md "Writes"); within the plan fields budget; relayed to every open editor. No person writes it, and
// it keeps no history entry, as a session vote's tally keeps none. `next` is null for a card not on the roadmap.
async function writeVote(
  ctx: PlanRouteContext,
  planId: string,
  cardId: string,
  next: (item: Item) => PublicVoteResult | null,
): Promise<VoteWrite> {
  for (let attempt = 1; attempt <= ITEM_WRITE_RETRIES; attempt += 1) {
    const [item] = await readItems(ctx.env, planId, [cardId]);
    const r = item ? next(item) : null;
    if (!item || !r) return { kind: 'missing' };
    if (r.kind === 'full') return r;
    if (r.kind === 'same') return { kind: 'same', item };
    if (await planFullFor(ctx.env, planId, fieldsGrowth([{ before: item, next: r.item }])))
      return { kind: 'refused', response: planFull() };
    const written = await updateItemsAtRev(ctx.env, planId, [
      { next: r.item, expectedRev: item.rev },
    ]);
    if (written.landed.has(cardId)) {
      relay(ctx, planId, [r.item], [], written.rev);
      return { kind: 'changed', item: r.item };
    }
    if (attempt < ITEM_WRITE_RETRIES) await itemRetryPause(attempt);
  }
  return { kind: 'refused', response: itemBusy() };
}

/** `/api/roadmaps/:planId/:code[/votes]`, as no one. */
export async function answerRoadmap(ctx: PlanRouteContext): Promise<Response> {
  const { segments, request } = ctx;
  const [, , planId = '', code = '', door, ...rest] = segments;
  const isVote = door === 'votes';
  if (
    !PLAN_ID.test(planId) ||
    !ROADMAP_CODE_PATTERN.test(code) ||
    rest.length > 0 ||
    (door !== undefined && !isVote)
  )
    return roadmapMissed('malformed');
  if (request.method !== (isVote ? 'POST' : 'GET')) return publicRefusal('method_not_allowed', 405);
  const roadmap = await roadmapByCode(ctx.env, planId, code);
  if (!roadmap) return roadmapMissed('unknown_code');
  return isVote ? vote(ctx, planId, roadmap) : read(ctx, planId, roadmap);
}
