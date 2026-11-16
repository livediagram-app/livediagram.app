// A plan's board addresses, `/api/projects/:id/email-intake[/:boardId[/new-address]]`, inside the plan's room
// (docs/specs/026-plan/email-to-board.md "Managing an address"; blueprint email-to-board.md "Behaviour and state").
// An address lets mail add cards, so it is an Editor's of the whole plan, in person: the owner, a team member or an
// Editor link with no tab scope. A Participant, a Viewer, a link confined to one tab, an API token, a workbench
// session and a Community visitor are refused (403 `email_intake_needs_editor`), and nothing changes.
//
//   GET                         every address, the boards that may have one, and whether mail is taken at all
//   PUT    /:boardId            turn the board's address on (201) or change Who Can Send (200)
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
import { intakeBoardsOf, wireBoard } from '../email-intake/intake-boards';
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
import { json, methodNotAllowed, noContent } from '../responses';
import { planTypesOf } from '../roadmap/roadmap-boards';
import { grantOn, missingProject, readBody, requireOwner, type PlanRouteContext } from './context';

// The longest board id a path names: element ids are far shorter.
const BOARD_ID_MAX = 200;
const NO_STORE = { 'Cache-Control': 'no-store' };

const answer = (body: unknown, status = 200) => json(body, { status, headers: NO_STORE });

function refuse(status: number, error: EmailIntakeError, reason: string): Response {
  console.info('[email-intake] refused', { reason });
  return answer({ error }, status);
}

/** The door every route passes: an Editor of the whole plan, in person; or the refusal. */
export async function intakeEditor(
  ctx: PlanRouteContext,
  projectId: string,
): Promise<Response | null> {
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  if (!(await getProject(ctx.env, projectId))) return missingProject(ctx, projectId);
  if (ctx.token || ctx.workbench) return refuse(403, 'email_intake_needs_editor', 'not_in_person');
  const grant = grantOn(ctx, projectId);
  if (!grant || grant.role !== 'edit' || grant.tabScope !== null || grant.community)
    return refuse(403, 'email_intake_needs_editor', 'not_editor');
  return null;
}

const wire = (row: IntakeRow, domain: string): EmailIntake => ({
  boardId: row.boardId,
  address: emailIntakeAddress(row.code, domain),
  senders: row.senders,
  createdAt: row.createdAt,
  made: row.made,
  refused: row.refused,
  dropped: row.dropped,
  lastAt: row.lastAt,
});

async function boardsOf(ctx: PlanRouteContext, projectId: string) {
  return intakeBoardsOf(ctx.env, projectId, await planTypesOf(ctx.env, projectId));
}

async function list(ctx: PlanRouteContext, projectId: string): Promise<Response> {
  const domain = ctx.env.EMAIL_INTAKE_DOMAIN || null;
  if (!domain) {
    const off: EmailIntakesResponse = { available: false, domain: null, intakes: [], boards: [] };
    return answer(off);
  }
  const [rows, boards] = await Promise.all([
    intakesOf(ctx.env, projectId),
    boardsOf(ctx, projectId),
  ]);
  // An address whose board has gone is not listed: it takes nothing until its board is turned on again.
  const body: EmailIntakesResponse = {
    available: true,
    domain,
    intakes: rows.filter((r) => boards.some((b) => b.id === r.boardId)).map((r) => wire(r, domain)),
    boards: boards.map(wireBoard),
  };
  return answer(body);
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
  const board = (await boardsOf(ctx, projectId)).find((b) => b.id === boardId);
  if (!board?.place) return refuse(400, 'email_intake_invalid', 'no_column');
  const at = { boardId, tabId: board.tabId };
  const existing = await intakeOfBoard(ctx.env, projectId, boardId);
  if (existing) {
    await setIntakeSenders(ctx.env, projectId, at, senders);
    console.info('[email-intake] manage', { action: 'senders' });
    const body: EmailIntakeResponse = {
      intake: wire({ ...existing, ...at, senders }, domain),
    };
    return answer(body);
  }
  const code = newIntakeCode();
  // Filed first: a row with no directory entry would show an address that takes nothing.
  await fileIntake(ctx.env, code, { planId: projectId, boardId });
  const row = await turnOnIntake(ctx.env, projectId, { ...at, code, senders }, Date.now());
  console.info('[email-intake] manage', { action: 'on' });
  const body: EmailIntakeResponse = { intake: wire(row, domain) };
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
  const body: EmailIntakeResponse = { intake: wire({ ...existing, code }, domain) };
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
