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
  type RoadmapField,
  type RoadmapForm,
  type RoadmapResponse,
  type RoadmapSettings,
  type RoadmapsResponse,
} from '@liveplanner/api-schema';
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
  setRoadmapSettings,
  unpublishRoadmap,
  type RoadmapRow,
} from '../roadmap/roadmap-store';
import { grantOn, missingProject, readBody, requireOwner, type PlanRouteContext } from './context';

// The longest board id a path names: element ids are far shorter.
const BOARD_ID_MAX = 200;
const NO_STORE = { 'Cache-Control': 'no-store' };

const answer = (body: unknown, status = 200) => json(body, { status, headers: NO_STORE });

function refuse(status: number, error: string, reason: string): Response {
  console.info('[roadmap] refused', { reason });
  return answer({ error }, status);
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

async function list(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const types = await planTypesOf(ctx.env, projectId);
  const [rows, boards, forms] = await Promise.all([
    roadmapsOf(ctx.env, projectId),
    roadmapBoardsOf(ctx.env, projectId, types),
    roadmapFormsOf(ctx.env, projectId),
  ]);
  // A roadmap whose board has gone is not listed: it answers nobody until its board is published again.
  const roadmaps = rows
    .filter((r) => boards.some((b) => b.id === r.boardId))
    .map((r) => published(projectId, r));
  const body: RoadmapsResponse = { roadmaps, boards, forms };
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
  if (existing && (await setRoadmapSettings(ctx.env, projectId, at, settings))) {
    console.info('[roadmap] manage', { action: 'changed' });
    const body: RoadmapResponse = {
      roadmap: published(projectId, { ...existing, ...at, settings }),
    };
    return answer(body);
  }
  const row = await publishRoadmap(ctx.env, projectId, at, settings, Date.now());
  console.info('[roadmap] manage', { action: 'published' });
  const body: RoadmapResponse = { roadmap: published(projectId, row) };
  return answer(body, 201);
}

async function remove(ctx: PlanRouteContext, projectId: string, boardId: string) {
  if (await unpublishRoadmap(ctx.env, projectId, boardId))
    console.info('[roadmap] manage', { action: 'unpublished' });
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
