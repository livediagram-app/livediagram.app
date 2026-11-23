// A plan's public roadmaps, `/api/projects/:id/roadmaps[/:boardId]`, inside the plan's room
// (docs/specs/026-plan/public-roadmap.md "Managing a roadmap"; blueprint public-roadmap.md "Behaviour and state").
// Publishing shows the plan to anyone with the link, so it is an ownership power: the owner's and team members' only,
// in person (no API token, no workbench session), never anyone who holds the plan through a share link at any level
// or a grant confined to one tab (403 `roadmap_needs_owner`).
//
//   GET              every published roadmap, the boards that may be published, the forms that may take suggestions
//   PUT    /:boardId publish the board (201, a new code) or change its settings, keeping its link (200)
//   DELETE /:boardId Unpublish (204 either way)
import {
  ROADMAP_FIELDS,
  ROADMAP_TITLE_MAX,
  roadmapPath,
  type PublishedRoadmap,
  type RoadmapBoard,
  type RoadmapError,
  type RoadmapErrorBody,
  type RoadmapField,
  type RoadmapForm,
  type RoadmapResponse,
  type RoadmapSettings,
  type RoadmapsResponse,
} from '@liveplanner/api-schema';
import { markOfClaim, refusedByService } from '@liveworkspace/subscription';
import { getProject } from '../db';
import { json, methodNotAllowed, noContent } from '../responses';
import {
  landsOnRoadmap,
  planTypesOf,
  roadmapBoardsOf,
  roadmapFormsOf,
} from '../roadmap/roadmap-boards';
import {
  publishRoadmap,
  roadmapsOf,
  setRoadmapCounted,
  setRoadmapSettings,
  unpublishRoadmap,
  type RoadmapRow,
} from '../roadmap/roadmap-store';
import { grantOn, missingProject, readBody, requireOwner, type PlanRouteContext } from './context';
import {
  claimRoadmap,
  releaseRoadmap,
  roadmapServes,
  syncRoadmapGauge,
} from '../roadmap/roadmap-gauge';
import { tierOn } from '../plan-room/tier/plan-tier';

// The longest board id a path names: element ids are far shorter.
const BOARD_ID_MAX = 200;
const NO_STORE = { 'Cache-Control': 'no-store' };

const answer = (body: unknown, status = 200) => json(body, { status, headers: NO_STORE });

function refuse(
  status: number,
  error: RoadmapError,
  reason: string,
  more: Omit<RoadmapErrorBody, 'error'> = {},
): Response {
  console.info('[roadmap] refused', { reason });
  return answer({ error, ...more } satisfies RoadmapErrorBody, status);
}

// The door every route passes: the owner or a team member, in person; or the refusal.
async function roadmapOwner(ctx: PlanRouteContext, projectId: string): Promise<Response | null> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  if (!(await getProject(ctx.env, projectId))) return missingProject(ctx, projectId);
  if (ctx.token || ctx.workbench) return refuse(403, 'roadmap_needs_owner', 'not_in_person');
  const grant = grantOn(ctx, projectId);
  // The owner's and a team member's grants carry no share code and reach every tab; a link's never does both.
  if (!grant || grant.shareCode !== null || grant.tabScope !== null || grant.community)
    return refuse(403, 'roadmap_needs_owner', 'no_owner_grant');
  return null;
}

const published = (projectId: string, row: RoadmapRow): PublishedRoadmap => ({
  ...row.settings,
  boardId: row.boardId,
  code: row.code,
  path: roadmapPath(projectId, row.code),
  createdAt: row.createdAt,
});

// A list of distinct strings, each one `allowed` holds, in `allowed`'s order; null for anything else or none.
function picked(raw: unknown, allowed: readonly string[]): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (raw.some((v) => typeof v !== 'string' || !allowed.includes(v))) return null;
  if (new Set(raw).size !== raw.length) return null;
  return allowed.filter((a) => raw.includes(a));
}

// The body's settings for `board`, or the refusal.
function settingsOf(
  raw: Record<string, unknown>,
  board: RoadmapBoard,
  forms: readonly RoadmapForm[],
): RoadmapSettings | Response {
  const invalid = () => refuse(400, 'roadmap_invalid', 'invalid');
  const title = typeof raw['title'] === 'string' ? raw['title'].trim() : '';
  if (!title || title.length > ROADMAP_TITLE_MAX) return invalid();
  const columns = picked(
    raw['columns'],
    board.columns.map((c) => c.status),
  );
  const types = picked(
    raw['types'],
    board.types.map((t) => t.id),
  );
  const fieldsRaw = raw['fields'];
  const fields =
    Array.isArray(fieldsRaw) && fieldsRaw.length === 0 ? [] : picked(fieldsRaw, ROADMAP_FIELDS);
  if (!columns || !types || !fields || typeof raw['voting'] !== 'boolean') return invalid();
  const formCode = raw['formCode'] ?? null;
  if (formCode !== null && typeof formCode !== 'string') return invalid();
  const form = formCode === null ? null : forms.find((f) => f.code === formCode);
  if (formCode !== null && !form) return invalid();
  if (form && landsOnRoadmap(form.statuses, columns))
    return refuse(400, 'roadmap_suggestions_public', 'suggestions_public');
  return {
    title,
    columns,
    types,
    fields: fields as RoadmapField[],
    voting: raw['voting'],
    formCode,
  };
}

// With Pro on, the plan's roadmaps counted for its owner (the ones from before too, a gone board's given back, one
// whose board came back asking for its place again), then what the owner holds against their tier's limit, and that
// owner (spec "Tiers"). A guest's plan names no owner (nobody is offered an upgrade): its own count and `guest`.
// `rows` come back as the count left them.
async function countedOf(
  ctx: PlanRouteContext,
  projectId: string,
  rows: readonly RoadmapRow[],
  there: (boardId: string) => boolean,
): Promise<{
  rows: readonly RoadmapRow[];
  said: Pick<RoadmapsResponse, 'usage' | 'owner' | 'guest'>;
}> {
  const tier = await tierOn(ctx.env);
  if (!tier || (!tier.owner && !tier.guest)) return { rows, said: {} };
  // An uncounted roadmap whose board is there may fit now (the owner just upgraded): the limits are asked for again.
  if (rows.some((r) => r.counted === false && there(r.boardId))) await tier.recheck();
  const marks = new Map<string, boolean>();
  await syncRoadmapGauge(tier, projectId, rows, there, async (boardId, counted) => {
    marks.set(boardId, counted);
    await setRoadmapCounted(ctx.env, projectId, boardId, counted);
  });
  const now = rows.map((r) =>
    marks.has(r.boardId) ? { ...r, counted: marks.get(r.boardId)! } : r,
  );
  const limit = tier.limit('publicRoadmaps', null);
  if (tier.guest) {
    const used = now.filter((r) => r.counted === true && there(r.boardId)).length;
    return { rows: now, said: { usage: { used, limit }, guest: true } };
  }
  const used = tier.gaugeUsed.get('publicRoadmaps');
  return {
    rows: now,
    said: {
      usage: { ...(used !== undefined ? { used } : {}), limit },
      ...(tier.owner ? { owner: tier.owner } : {}),
    },
  };
}

async function list(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const types = await planTypesOf(ctx.env, projectId);
  const [rows, boards, forms] = await Promise.all([
    roadmapsOf(ctx.env, projectId),
    roadmapBoardsOf(ctx.env, projectId, types),
    roadmapFormsOf(ctx.env, projectId),
  ]);
  // A roadmap whose board has gone is not listed: it answers nobody until its board is published again. Nor, with
  // Pro on, is one that holds no counted place: its board reads as not published, with the limit beside it.
  const there = (boardId: string) => boards.some((b) => b.id === boardId);
  const counted = await countedOf(ctx, projectId, rows, there);
  const roadmaps = counted.rows
    .filter((r) => there(r.boardId) && roadmapServes(ctx.env.TIER, r))
    .map((r) => published(projectId, r));
  const body: RoadmapsResponse = { roadmaps, boards, forms, ...counted.said };
  return answer(body);
}

async function put(ctx: PlanRouteContext, projectId: string, boardId: string): Promise<Response> {
  const raw = await readBody(ctx);
  if (raw instanceof Response) return raw;
  const types = await planTypesOf(ctx.env, projectId);
  const [boards, forms, rows] = await Promise.all([
    roadmapBoardsOf(ctx.env, projectId, types),
    roadmapFormsOf(ctx.env, projectId),
    roadmapsOf(ctx.env, projectId),
  ]);
  const board = boards.find((b) => b.id === boardId);
  if (!board || !board.publishable) return refuse(400, 'roadmap_invalid', 'invalid');
  const settings = settingsOf(raw, board, forms);
  if (settings instanceof Response) return settings;
  const at = { boardId, tabId: board.tabId };
  const existing = rows.find((r) => r.boardId === boardId);
  const tier = await tierOn(ctx.env);
  // A roadmap that holds no counted place is not published as anyone sees it: Publish asks for its place first.
  const placeless = !!existing && !roadmapServes(tier, existing);
  if (existing && !placeless && (await setRoadmapSettings(ctx.env, projectId, at, settings))) {
    console.info('[roadmap] manage', { action: 'changed' });
    const body: RoadmapResponse = {
      roadmap: published(projectId, { ...existing, ...at, settings }),
    };
    return answer(body);
  }
  // With Pro on, one more roadmap for the plan's owner, asked first (the plan's own from before counted before it),
  // and refused at their tier's limit (spec "Tiers"). A settings change above never asks.
  let counted: boolean | null = null;
  if (tier) {
    const there = (id: string) => boards.some((b) => b.id === id);
    const marks = new Map(rows.map((r) => [r.boardId, r.counted]));
    await syncRoadmapGauge(
      tier,
      projectId,
      rows.filter((r) => r.boardId !== boardId),
      there,
      async (id, mark) => {
        marks.set(id, mark);
        await setRoadmapCounted(ctx.env, projectId, id, mark);
      },
    );
    const held = [...marks].filter(([id, m]) => id !== boardId && m === true && there(id)).length;
    let claim = await claimRoadmap(tier, projectId, boardId, held);
    // Refused at the limit: the owner may have upgraded a moment ago, so their limits are asked for once more
    // (plan-tier.ts `recheck`) before the refusal is answered.
    if (claim && !claim.ok && !claim.unmetered && (await tier.recheck()))
      claim = await claimRoadmap(tier, projectId, boardId, held);
    // The service refused the plan's request (its key, never the owner's roadmaps): nothing is published uncounted,
    // and it is this Worker's fault to answer for, never a limit to offer an upgrade at.
    if (claim && refusedByService(claim))
      throw new Error('the subscription service refused the roadmap claim');
    if (claim && !claim.ok && claim.limit !== null)
      return refuse(409, 'roadmap_limit_reached', 'tier_limit', {
        limit: 'publicRoadmaps',
        used: claim.used,
        max: claim.limit,
        ...(tier.guest ? { guest: true as const } : {}),
      });
    // Counted where the service (or a guest's plan itself) said so; one it could not be asked about is claimed at
    // the next count.
    counted = markOfClaim(claim);
  }
  if (existing && placeless) {
    // Its place is held again: the same link answers, with these settings.
    await setRoadmapSettings(ctx.env, projectId, at, settings);
    await setRoadmapCounted(ctx.env, projectId, boardId, counted);
    console.info('[roadmap] manage', { action: 'republished' });
    const body: RoadmapResponse = {
      roadmap: published(projectId, { ...existing, ...at, settings, counted }),
    };
    return answer(body);
  }
  let row: RoadmapRow;
  try {
    row = await publishRoadmap(ctx.env, projectId, at, settings, Date.now(), counted);
  } catch (error) {
    // Nothing was published: the place claimed for it goes back.
    if (tier) await releaseRoadmap(tier, projectId, boardId);
    throw error;
  }
  console.info('[roadmap] manage', { action: 'published' });
  const body: RoadmapResponse = { roadmap: published(projectId, row) };
  return answer(body, 201);
}

async function remove(ctx: PlanRouteContext, projectId: string, boardId: string) {
  if (await unpublishRoadmap(ctx.env, projectId, boardId))
    console.info('[roadmap] manage', { action: 'unpublished' });
  // Given back whether or not it was published: taking off a key that is not there changes nothing.
  const tier = await tierOn(ctx.env);
  if (tier) await releaseRoadmap(tier, projectId, boardId);
  return noContent();
}

/** `/api/projects/:id/roadmaps[/:boardId]`, or null for any other path. */
export async function handleRoadmapRoutes(ctx: PlanRouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments[3] !== 'roadmaps' || segments.length < 4 || segments.length > 5) return null;
  const projectId = segments[2]!;
  const boardId = segments[4];
  const method = request.method;
  const allowed =
    boardId === undefined ? method === 'GET' : method === 'PUT' || method === 'DELETE';
  if (!allowed) return methodNotAllowed();
  if (boardId !== undefined && (!boardId || boardId.length > BOARD_ID_MAX))
    return refuse(400, 'roadmap_invalid', 'invalid');
  const refused = await roadmapOwner(ctx, projectId);
  if (refused) return refused;
  if (boardId === undefined) return list(ctx, projectId);
  return method === 'PUT' ? put(ctx, projectId, boardId) : remove(ctx, projectId, boardId);
}
