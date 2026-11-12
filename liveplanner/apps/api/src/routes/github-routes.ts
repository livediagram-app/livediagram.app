// A plan's GitHub connection, `/api/projects/:id/github[/…]`, inside the plan's room
// (docs/specs/026-plan/github-pull-requests.md "Connecting a repository", "Who may do what"; blueprint "Part 2" "The
// plan's routes"). Every route is a signed-in Editor's of the whole plan, in person: never an API token, a workbench
// session, a guest, a Participant, a Viewer or a link to one tab (403 `github_needs_editor`). While the App's settings
// are missing, none of these paths is served (404).
//
//   GET    /github               the connection, or null
//   POST   /github/connect       a one-time state and the App's install page on GitHub to send the person to
//   PUT    /github/repositories  the repositories to connect, from the ones the connection lists
//   PUT    /github/rules         the two GitHub rules: the column a linked pull request's card moves to when it opens,
//                                and when it merges (part 3, spec "GitHub rules")
//   DELETE /github               the connection gone, its rules and the pull request states it held with it
import type {
  GithubConnectionResponse,
  GithubConnectStartResponse,
  GithubRepositoriesRequest,
  GithubRules,
} from '@liveplanner/api-schema';
import { planOutline, type ItemPerson } from '@liveplanner/items';
import { getProject } from '../db';
import { installationRepositories } from '../github/github-api';
import { githubConfig, REPOSITORIES_MAX, type GithubConfig } from '../github/github-config';
import { NO_LINKS, rewriteLinks } from '../github/github-links';
import { startConnect, withRoom } from '../plan-room/github/github-connect';
import { dropStates } from '../plan-room/github/github-room';
import {
  chooseRepositories,
  connectionView,
  dropConnection,
  linksOf,
  readConnection,
  saveRules,
} from '../plan-room/github/github-store';
import { json, methodNotAllowed, noContent } from '../responses';
import { writer } from './item-route-kit';
import { planTabs } from './plan-route';
import { gateEdit, missingProject, readBody, requireOwner, type PlanRouteContext } from './context';

type Gated = { config: GithubConfig; projectId: string; by: ItemPerson };

const refuse = (status: number, error: string) => json({ error }, { status });

// The door every route passes: a signed-in person (never a token or a workbench session), an Editor of the whole plan.
async function gate(
  ctx: PlanRouteContext,
  config: GithubConfig,
  projectId: string,
): Promise<Gated | Response> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const doc = await getProject(ctx.env, projectId);
  if (!doc) return missingProject(ctx, projectId);
  const inPerson = !ctx.token && !ctx.workbench && !!ctx.accountUserId;
  if (!inPerson || !(await gateEdit(ctx, projectId))) {
    console.info('[github] refused', {
      token: !!ctx.token,
      workbench: !!ctx.workbench,
      signedIn: !!ctx.accountUserId,
    });
    return refuse(403, 'github_needs_editor');
  }
  return { config, projectId, by: await writer(ctx, owner) };
}

async function view(ctx: PlanRouteContext, g: Gated, status = 200): Promise<Response> {
  const c = await readConnection(ctx.env.PLAN_DB, g.projectId);
  const body: GithubConnectionResponse = { connection: c ? connectionView(c) : null };
  return json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function connect(ctx: PlanRouteContext, g: Gated): Promise<Response> {
  const url = await startConnect(ctx.env.PLAN_DB, g.config, g.projectId, g.by, Date.now());
  const body: GithubConnectStartResponse = { url };
  return json(body, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

// The request's ids: distinct positive safe integers, at most REPOSITORIES_MAX, or null.
function idsOf(raw: Record<string, unknown>): number[] | null {
  const ids = (raw as Partial<GithubRepositoriesRequest>).ids;
  if (!Array.isArray(ids) || ids.length > REPOSITORIES_MAX) return null;
  if (!ids.every((id) => Number.isSafeInteger(id) && id > 0)) return null;
  return new Set(ids).size === ids.length ? ids : null;
}

async function choose(ctx: PlanRouteContext, g: Gated): Promise<Response> {
  const raw = await readBody(ctx);
  if (raw instanceof Response) return raw;
  const db = ctx.env.PLAN_DB;
  const before = await readConnection(db, g.projectId);
  if (!before) return refuse(409, 'github_not_connected');
  const ids = idsOf(raw);
  const listed = new Set(before.repositories.map((r) => r.id));
  if (!ids || !ids.every((id) => listed.has(id))) return refuse(400, 'github_invalid');
  if (ids.length > 0) {
    // Checked against the installation again, as the App: a repository it no longer sees never joins.
    const seen = await installationRepositories(g.config, before.installationId, Date.now());
    if (!seen) return refuse(502, 'github_unavailable');
    const seenIds = new Set(seen.map((r) => r.id));
    if (!ids.every((id) => seenIds.has(id))) return refuse(409, 'github_repository_gone');
    const room = await withRoom(g.config.links, g.projectId, ids);
    if (!ids.every((id) => room.has(id))) return refuse(409, 'github_repository_full');
  }
  await chooseRepositories(db, g.projectId, ids);
  const after = await readConnection(db, g.projectId);
  await rewriteLinks(g.config.links, g.projectId, linksOf(before), linksOf(after));
  // A repository no longer chosen takes its pull requests' states off the plan.
  const left = before.repositories.filter((r) => r.chosen && !ids.includes(r.id)).map((r) => r.id);
  if (left.length) await dropStates(ctx.env, g.projectId, left);
  console.info('[github] chosen', { repositories: ids.length });
  return view(ctx, g);
}

// A rule's column: a status of 1 to 64 characters, or null for off.
const ruleOf = (v: unknown): string | null | undefined =>
  v === null ? null : typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : undefined;

async function setRules(ctx: PlanRouteContext, g: Gated): Promise<Response> {
  const raw = await readBody(ctx);
  if (raw instanceof Response) return raw;
  const db = ctx.env.PLAN_DB;
  if (!(await readConnection(db, g.projectId))) return refuse(409, 'github_not_connected');
  const body = raw as Partial<Record<keyof GithubRules, unknown>>;
  const rules = { opened: ruleOf(body.opened), merged: ruleOf(body.merged) };
  if (rules.opened === undefined || rules.merged === undefined)
    return refuse(400, 'github_invalid');
  // Each a column one of the plan's boards names.
  const { statuses } = planOutline(await planTabs(ctx, g.projectId, null), null);
  const named = new Set(statuses.map((s) => s.status));
  for (const r of [rules.opened, rules.merged])
    if (r !== null && !named.has(r)) return refuse(400, 'github_invalid');
  await saveRules(db, g.projectId, rules as GithubRules);
  console.info('[github] rules', { opened: rules.opened !== null, merged: rules.merged !== null });
  return view(ctx, g);
}

async function disconnect(ctx: PlanRouteContext, g: Gated): Promise<Response> {
  const db = ctx.env.PLAN_DB;
  const before = await readConnection(db, g.projectId);
  if (before) {
    await dropConnection(db, g.projectId);
    await dropStates(ctx.env, g.projectId, null);
    await rewriteLinks(g.config.links, g.projectId, linksOf(before), NO_LINKS);
    console.info('[github] disconnected', {});
  }
  return noContent();
}

type Door = (ctx: PlanRouteContext, g: Gated) => Promise<Response>;

// The door a path and method name, before anything is read: null for no such path, 'method' for a verb it lacks.
function doorOf(ctx: PlanRouteContext): Door | 'method' | null {
  const { segments } = ctx;
  const method = ctx.request.method;
  if (segments.length === 4) {
    if (method === 'GET') return (c, g) => view(c, g);
    return method === 'DELETE' ? disconnect : 'method';
  }
  if (segments.length !== 5) return null;
  if (segments[4] === 'connect') return method === 'POST' ? connect : 'method';
  if (segments[4] === 'repositories') return method === 'PUT' ? choose : 'method';
  if (segments[4] === 'rules') return method === 'PUT' ? setRules : 'method';
  return null;
}

/** `/api/projects/:id/github[/…]`, or null for any other path (and for every path while the feature is off). */
export async function handleGithubRoutes(ctx: PlanRouteContext): Promise<Response | null> {
  if (ctx.segments[3] !== 'github') return null;
  const config = githubConfig(ctx.env);
  if (!config) return null;
  const door = doorOf(ctx);
  if (door === null) return null;
  if (door === 'method') return methodNotAllowed();
  const g = await gate(ctx, config, ctx.segments[2]!);
  return g instanceof Response ? g : door(ctx, g);
}
