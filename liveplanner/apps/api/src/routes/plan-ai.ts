// Plan AI, `POST /api/plan-ai` (docs/specs/026-plan/plan-ai.md; blueprint plan-ai.md "The api"): one tab as the editor
// read it and the person's instruction go to the model as data (@liveplanner/items planAiRequest), and its reply is read
// into words and the changes the person's role may make (readPlanAi), asked once more with the check's words when it
// doesn't read (draft-asks.ts). Which AI answers is Ask's rule: the person's or the team's key unless built-in AI was
// picked, else built-in AI on Ask's daily count and, with Pro on, an AI credit from whoever pays for the plan. Nothing
// is made here: the editor makes the changes as the person's own edits. Every refusal's message is fixed words; the
// instruction, the tab and the reply are never logged.
import { keyedRunner, ownKeyOf, type AiKeySource } from '@liveworkspace/ai';
import { personAiKey } from '@liveworkspace/auth-client/ai-key';
import { ASK_WORDS, askCreditsOf, chargeAsk, spendAsk } from '@liveworkspace/ask/server';
import { AUTOMATION_KEYED_TIMEOUT_MS } from '@liveworkspace/automations/room';
import {
  PLAN_AI_BODY_MAX,
  PLAN_AI_INSTRUCTION_MAX,
  PLAN_AI_TAB_MAX,
  PLAN_AI_TAB_NAME_MAX,
  PLAN_AI_TURNS_MAX,
  PLAN_AI_WORDS,
  isPlanAiKind,
  planAiRequest,
  readPlanAi,
  type PlanAiAsk,
  type PlanAiRole,
  type PlanAiTurn,
} from '@liveplanner/items';
import type { PlanAiError, PlanAiResponse } from '@liveplanner/api-schema';
import { accountCredentials } from '../auth/accounts';
import { aiClient, type AutomationsAi } from '../plan-room/automations/automation-ai';
import { json, methodNotAllowed, notFound, signInRequired } from '../responses';
import { reportServerEvent } from '../server-telemetry';
import { askForDraft } from './draft-asks';
import { keyFailedResponse } from './draft-ai';
import type { RouteContext } from './context';
import { resolvePlanGrant } from './plan-grant';

const ID_MAX = 200;
// How long one ask may take on built-in AI (spec "Bounds": 20 seconds; a key's thinking model gets the keyed wait).
const PLAN_AI_BUILT_IN_TIMEOUT_MS = 20_000;

const refuse = (
  status: number,
  error: PlanAiError,
  message: string,
  more: Record<string, unknown> = {},
) => json({ error, message, ...more }, { status });

export async function handlePlanAi(ctx: RouteContext): Promise<Response> {
  if (ctx.segments.length !== 2) return notFound();
  if (ctx.request.method !== 'POST') return methodNotAllowed();
  return askPlanAi(ctx);
}

const idOf = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' && v.length <= ID_MAX ? v : null;

// The earlier turns as sent: the last few, each a pair of strings; anything else is left out.
function turnsOf(v: unknown): PlanAiTurn[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(-PLAN_AI_TURNS_MAX)
    .filter(
      (t): t is PlanAiTurn =>
        typeof t === 'object' &&
        t !== null &&
        typeof (t as PlanAiTurn).instruction === 'string' &&
        typeof (t as PlanAiTurn).reply === 'string',
    )
    .map((t) => ({ instruction: t.instruction, reply: t.reply }));
}

// The body, read whole only within its bound.
async function bodyOf(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const raw = await request.text();
    if (raw.length > PLAN_AI_BODY_MAX) return null;
    const body: unknown = JSON.parse(raw);
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function askPlanAi(ctx: RouteContext): Promise<Response> {
  // Signed in, as Ask: a guest is told it needs an account; no identity at all is asked to sign in.
  const accountId = ctx.verifiedUserId;
  if (!accountId)
    return ctx.resolveOwner()
      ? refuse(403, 'plan_ai_needs_account', PLAN_AI_WORDS.needsAccount)
      : signInRequired();
  const body = await bodyOf(ctx.request);
  if (!body) return refuse(400, 'plan_ai_invalid', PLAN_AI_WORDS.invalid);
  const projectId = idOf(body['projectId']);
  const kind = body['kind'];
  const tab = body['tab'];
  const tabName = body['tabName'];
  if (
    !projectId ||
    !isPlanAiKind(kind) ||
    typeof tab !== 'string' ||
    tab.length > PLAN_AI_TAB_MAX ||
    typeof tabName !== 'string' ||
    tabName.length > PLAN_AI_TAB_NAME_MAX
  )
    return refuse(400, 'plan_ai_invalid', PLAN_AI_WORDS.invalid);
  const instruction = typeof body['instruction'] === 'string' ? body['instruction'].trim() : '';
  if (!instruction) return refuse(400, 'plan_ai_invalid', PLAN_AI_WORDS.empty);
  if (instruction.length > PLAN_AI_INSTRUCTION_MAX)
    return refuse(400, 'plan_ai_invalid', PLAN_AI_WORDS.tooLong);

  // The role is the index's grant on the plan, never the request: a Viewer's changes are never asked for.
  const grant = await resolvePlanGrant(ctx, projectId);
  if (grant instanceof Response) return grant;
  if (!grant || grant.trashed) return refuse(403, 'plan_ai_no_access', PLAN_AI_WORDS.noAccess);
  const role: PlanAiRole =
    grant.level === 'edit' ? 'edit' : grant.level === 'participate' ? 'participate' : 'view';

  // Which AI answers (Ask's rule, ai-keys.md "Every AI feature honours the choice"): built-in AI when the person
  // picked it, else the key that applies in the plan's team, else built-in AI. A key that will not open, or accounts
  // that could not say, is refused in words, never swapped for built-in AI on a guess.
  const env = ctx.env;
  const teamId = idOf(body['teamId']);
  const own =
    body['ai'] === 'built-in'
      ? ({ status: 'built-in' } as const)
      : ownKeyOf(await personAiKey(accountCredentials(env), ctx, teamId));
  if (own.status === 'refused')
    return own.reason === 'unreadable'
      ? keyFailedResponse(own.failure, own.words)
      : refuse(503, 'plan_ai_unavailable', own.words);
  let client: AutomationsAi;
  let keyed: { source: AiKeySource; provider: string } | null = null;
  const started = Date.now();
  if (own.status === 'key') {
    client = keyedRunner(own.caller);
    keyed = { source: own.source, provider: own.provider };
  } else {
    const builtIn = aiClient(env);
    if (!builtIn) return refuse(503, 'plan_ai_unavailable', PLAN_AI_WORDS.notSetUp);
    // Ask's day: a turn is one of the person's built-in questions, counted before the model is asked.
    const spent = await spendAsk(env.PLAN_ROOM, accountId, started);
    if (spent === 'unavailable') return refuse(503, 'plan_ai_unavailable', ASK_WORDS.countFailed);
    if (!spent) return refuse(429, 'ask_built_in_limit', ASK_WORDS.limit);
    // With Pro on, Ask's credit from whoever pays for the plan, after the day's count.
    const credits = askCreditsOf({
      env,
      app: 'liveplanner.app',
      rooms: env.PLAN_ROOM,
      teams: ctx.teams,
      grant: (id) => resolvePlanGrant(ctx, id),
    });
    if (credits) {
      const refused = await chargeAsk(credits, accountId, projectId, started);
      if (refused)
        return refuse(
          refused.status,
          refused.error === 'ai_credits_used' || refused.error === 'ask_by_others_limit'
            ? refused.error
            : 'plan_ai_unavailable',
          refused.message,
          refused.more ?? {},
        );
    }
    client = builtIn;
  }

  const ask: PlanAiAsk = {
    kind,
    tabName,
    tab,
    instruction,
    role,
    turns: turnsOf(body['turns']),
  };
  const defer = (p: Promise<unknown>) => ctx.waitUntil?.(p);
  const asked = await askForDraft({
    client,
    gateway: keyed ? undefined : env.AI_GATEWAY,
    timeoutMs: keyed ? AUTOMATION_KEYED_TIMEOUT_MS : PLAN_AI_BUILT_IN_TIMEOUT_MS,
    request: (refused) => planAiRequest(ask, refused),
    read: (reply) => readPlanAi(reply, ask),
    onAsk: () => defer(reportServerEvent(env, 'Plan', 'Ran', 'PlanAi')),
  });
  const log = (answer: string, extra: Record<string, unknown> = {}) =>
    console.info('[plan-ai] asked', {
      answer,
      kind,
      role,
      asks: asked.asks,
      tookMs: Date.now() - started,
      ...extra,
    });
  if (asked.answer === 'failed') {
    log('failed');
    if (keyed && asked.keyFailure)
      return keyFailedResponse({ source: keyed.source, ...asked.keyFailure }, asked.reason);
    return refuse(503, 'plan_ai_unavailable', keyed ? asked.reason : PLAN_AI_WORDS.failed);
  }
  if (asked.answer === 'drafted') {
    const { reply, changes, dropped } = asked.out.draft;
    log('answered', { changes: changes.length, dropped });
    const answer: PlanAiResponse = {
      reply,
      changes,
      provider: keyed ? keyed.provider : 'built-in',
      role,
    };
    return json(answer);
  }
  // A reply that never read (readPlanAi never answers `off`).
  log('unreadable', { refused: asked.answer === 'unreadable' ? asked.refused?.path : undefined });
  return refuse(422, 'plan_ai_unreadable', PLAN_AI_WORDS.unreadable);
}
