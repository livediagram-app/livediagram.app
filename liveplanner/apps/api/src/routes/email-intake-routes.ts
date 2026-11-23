// A plan's board addresses, `/api/projects/:id/email-intake[/:boardId[/new-address]]`, inside the plan's room
// (docs/specs/026-plan/email-to-board.md "Managing an address"; blueprint email-to-board.md "Behaviour and state").
// An address lets mail add cards, so it is an Editor's of the whole plan, in person and signed in: the owner, a team
// member or an Editor link with no tab scope. A guest, a Participant, a Viewer, a link confined to one tab, an API
// token, a workbench session and a Community visitor are refused (403 `email_intake_needs_editor`), and nothing
// changes.
//
//   GET                         every address, the boards that may have one, and whether mail is taken at all
//   PUT    /:boardId            turn the board's address on (201) or change Who Can Send or what it makes (200)
//   POST   /:boardId/new-address a new code; the old address stops at once
//   DELETE /:boardId            Turn Off (204 either way)
import {
  emailIntakeAddress,
  isEmailIntakeSenders,
  type EmailIntake,
  type EmailIntakeError,
  type EmailIntakeResponse,
  type EmailIntakesResponse,
} from '@liveplanner/api-schema';
import { getProject } from '../db';
import {
  intakeBoardsOf,
  intakeTargetOf,
  intakeTypesOf,
  wireBoard,
  type IntakeBoard,
} from '../email-intake/intake-boards';
import { newIntakeCode } from '../email-intake/intake-code';
import { fileIntake, unfileIntake } from '../email-intake/intake-directory';
import {
  intakeOfBoard,
  intakesOf,
  replaceIntakeCode,
  setIntakeSenders,
  turnOffIntake,
  turnOnIntake,
  type IntakeRow,
} from '../email-intake/intake-store';
import type { ItemTypeDef } from '@liveplanner/items';
import { json, methodNotAllowed, noContent } from '../responses';
import { planTypesOf } from '../roadmap/roadmap-boards';
import { grantOn, missingProject, readBody, requireOwner, type PlanRouteContext } from './context';
import { monthKey } from '@liveworkspace/subscription';
import { EMAIL_METER, monthFull } from '../plan-room/tier/plan-meters';
import { tierOn } from '../plan-room/tier/plan-tier';

// The longest board id a path names: element ids are far shorter.
const BOARD_ID_MAX = 200;
const NO_STORE = { 'Cache-Control': 'no-store' };

const answer = (body: unknown, status = 200) => json(body, { status, headers: NO_STORE });

function refuse(status: number, error: EmailIntakeError, reason: string): Response {
  console.info('[email-intake] refused', { reason });
  return answer({ error }, status);
}

/** The door every route passes: an Editor of the whole plan, in person, signed in; or the refusal. */
export async function intakeEditor(
  ctx: PlanRouteContext,
  projectId: string,
): Promise<Response | null> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  if (!(await getProject(ctx.env, projectId))) return missingProject(ctx, projectId);
  if (ctx.token || ctx.workbench) return refuse(403, 'email_intake_needs_editor', 'not_in_person');
  // An address outlives a browser session, so it is an account's (owner, 2026-11-16): never a guest's.
  if (!ctx.accountUserId) return refuse(403, 'email_intake_needs_editor', 'guest');
  const grant = grantOn(ctx, projectId);
  if (!grant || grant.role !== 'edit' || grant.tabScope !== null || grant.community)
    return refuse(403, 'email_intake_needs_editor', 'not_editor');
  return null;
}

// The plan's boards and card types, read once a request: what every address's target is judged against.
type World = { boards: IntakeBoard[]; types: readonly ItemTypeDef[] };

async function worldOf(ctx: PlanRouteContext, projectId: string): Promise<World> {
  const types = await planTypesOf(ctx.env, projectId);
  return { boards: await intakeBoardsOf(ctx.env, projectId, types), types };
}

// What an address makes: its own card type and column, or (one from before) its board's first of each.
const targetOf = (row: Pick<IntakeRow, 'boardId' | 'target'>, world: World) =>
  intakeTargetOf(
    row.target ?? world.boards.find((b) => b.id === row.boardId)?.place ?? null,
    world.boards,
    world.types,
  );

const wire = (row: IntakeRow, domain: string, world: World): EmailIntake => ({
  boardId: row.boardId,
  address: emailIntakeAddress(row.code, domain),
  target: targetOf(row, world),
  senders: row.senders,
  createdAt: row.createdAt,
  made: row.made,
  refused: row.refused,
  dropped: row.dropped,
  lastAt: row.lastAt,
});

// With Pro on, the owner's monthly limit of emails to boards, whether this plan found it used this month, and that
// owner (spec "Tiers"). What the owner used is theirs alone: the dialog reads it from their own subscription.
async function monthOf(
  ctx: PlanRouteContext,
  projectId: string,
): Promise<Pick<EmailIntakesResponse, 'month' | 'owner'>> {
  const tier = await tierOn(ctx.env);
  if (!tier?.owner) return {};
  const limit = tier.limit('emailToBoardPerMonth', 0);
  const full = await monthFull(ctx.env, projectId, EMAIL_METER, monthKey(Date.now()), limit);
  return { month: { limit, full }, owner: tier.owner };
}

async function list(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const domain = ctx.env.EMAIL_INTAKE_DOMAIN || null;
  if (!domain) {
    const off: EmailIntakesResponse = {
      available: false,
      domain: null,
      intakes: [],
      boards: [],
      types: [],
    };
    return answer(off);
  }
  const [rows, world] = await Promise.all([intakesOf(ctx.env, projectId), worldOf(ctx, projectId)]);
  const { boards, types } = world;
  // An address whose board has gone is not listed: it takes nothing until its board is turned on again.
  const body: EmailIntakesResponse = {
    available: true,
    domain,
    intakes: rows
      .filter((r) => boards.some((b) => b.id === r.boardId))
      .map((r) => wire(r, domain, world)),
    boards: boards.map((b) => wireBoard(b, boards, types)),
    types: intakeTypesOf(boards, types),
    ...(await monthOf(ctx, projectId)),
  };
  return answer(body);
}

const ID_MAX = 200;

// The card a PUT names: both a type and a status, or neither (undefined: left as it is). False when it reads wrong.
function readTarget(
  raw: Record<string, unknown>,
): { typeId: string; status: string } | undefined | false {
  const { typeId, status } = raw;
  if (typeId === undefined && status === undefined) return undefined;
  if (typeof typeId !== 'string' || typeof status !== 'string') return false;
  if (!typeId || !status || typeId.length > ID_MAX || status.length > ID_MAX) return false;
  return { typeId, status };
}

async function put(
  ctx: PlanRouteContext,
  projectId: string,
  boardId: string,
  domain: string,
): Promise<Response> {
  const raw = await readBody(ctx);
  if (raw instanceof Response) return raw;
  const senders = raw['senders'];
  if (!isEmailIntakeSenders(senders)) return refuse(400, 'email_intake_invalid', 'invalid');
  const named = readTarget(raw);
  if (named === false) return refuse(400, 'email_intake_invalid', 'invalid_target');
  const world = await worldOf(ctx, projectId);
  const board = world.boards.find((b) => b.id === boardId);
  if (!board?.place) return refuse(400, 'email_intake_invalid', 'no_column');
  // A card no board shows is never taken as a target: nobody would see what the mail made.
  if (named && !intakeTargetOf(named, world.boards, world.types))
    return refuse(400, 'email_intake_invalid', 'target_unseen');
  const existing = await intakeOfBoard(ctx.env, projectId, boardId);
  if (existing) {
    const at = { boardId, tabId: board.tabId, target: named ?? existing.target };
    await setIntakeSenders(ctx.env, projectId, at, senders);
    console.info('[email-intake] manage', { action: named ? 'target' : 'senders' });
    const body: EmailIntakeResponse = {
      intake: wire({ ...existing, ...at, senders }, domain, world),
    };
    return answer(body);
  }
  const code = newIntakeCode();
  // Filed first: a row with no directory entry would show an address that takes nothing.
  await fileIntake(ctx.env, code, { planId: projectId, boardId });
  // Turned on, it keeps what it makes (the card named, else the board's first type and column as they are now), so
  // reordering the board's columns later never moves where its mail lands.
  const row = await turnOnIntake(
    ctx.env,
    projectId,
    { boardId, tabId: board.tabId, code, target: named ?? board.place, senders },
    Date.now(),
  );
  console.info('[email-intake] manage', { action: 'on' });
  const body: EmailIntakeResponse = { intake: wire(row, domain, world) };
  return answer(body, 201);
}

async function newAddress(
  ctx: PlanRouteContext,
  projectId: string,
  boardId: string,
  domain: string,
): Promise<Response> {
  const existing = await intakeOfBoard(ctx.env, projectId, boardId);
  if (!existing) return refuse(404, 'email_intake_not_found', 'not_found');
  const code = newIntakeCode();
  await fileIntake(ctx.env, code, { planId: projectId, boardId });
  await replaceIntakeCode(ctx.env, projectId, boardId, existing.code, code);
  await unfileIntake(ctx.env, existing.code);
  console.info('[email-intake] manage', { action: 'new_address' });
  const world = await worldOf(ctx, projectId);
  const body: EmailIntakeResponse = { intake: wire({ ...existing, code }, domain, world) };
  return answer(body);
}

async function remove(ctx: PlanRouteContext, projectId: string, boardId: string) {
  const code = await turnOffIntake(ctx.env, projectId, boardId);
  if (code) {
    await unfileIntake(ctx.env, code);
    console.info('[email-intake] manage', { action: 'off' });
  }
  return noContent();
}

/** `/api/projects/:id/email-intake[/:boardId[/new-address]]`, or null for any other path. */
export async function handleEmailIntakeRoutes(ctx: PlanRouteContext): Promise<Response | null> {
  const { segments, request } = ctx;
  if (segments[3] !== 'email-intake' || segments.length < 4 || segments.length > 6) return null;
  const projectId = segments[2]!;
  const boardId = segments[4];
  const rotate = segments.length === 6;
  if (rotate && segments[5] !== 'new-address') return null;
  const method = request.method;
  const allowed =
    boardId === undefined
      ? method === 'GET'
      : rotate
        ? method === 'POST'
        : method === 'PUT' || method === 'DELETE';
  if (!allowed) return methodNotAllowed();
  if (boardId !== undefined && (!boardId || boardId.length > BOARD_ID_MAX))
    return refuse(400, 'email_intake_invalid', 'invalid');
  const refused = await intakeEditor(ctx, projectId);
  if (refused) return refused;
  if (boardId === undefined) return list(ctx, projectId);
  if (method === 'DELETE') return remove(ctx, projectId, boardId);
  const domain = ctx.env.EMAIL_INTAKE_DOMAIN;
  if (!domain) return refuse(503, 'email_intake_unavailable', 'unavailable');
  return rotate
    ? newAddress(ctx, projectId, boardId, domain)
    : put(ctx, projectId, boardId, domain);
}
