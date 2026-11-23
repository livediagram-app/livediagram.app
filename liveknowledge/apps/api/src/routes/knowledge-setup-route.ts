// POST /api/documents/<id>/setup/suggest (docs/specs/030-knowledgebase/describe-to-set-up.md "The model"): a page
// structure proposed from a person's description of what the knowledgebase is for: on the team's own key when one is
// set, else on built-in AI (Workers AI, setup-built-in-ai.ts; owner, 2026-11-21). Answered whole as JSON
// (`KnowledgeSetupSuggestion`, with which AI answered); nothing is written to the knowledgebase here, the editor makes
// the pages the person keeps. A signed-in Editor in person alone: no API token, no guest, no visitor through a share
// link, since it spends the team's key or liveknowledge's built-in AI and is the start of an edit. The description is untrusted
// text to the model and the reply untrusted text to the app: one is fenced, the other is validated field by field
// (`parseSetupSuggestion`) and only ever placed as text.
import type { KnowledgeAiCredits } from '@liveknowledge/api-schema';
import { creditCallerOf, spendBuiltInCredit } from '../knowledge/ai-credits';
import {
  SETUP_BUILT_IN_PER_PERSON_PER_DAY,
  SETUP_MAX_DESCRIPTION_CHARS,
  SETUP_MAX_EXISTING_PAGES,
  SETUP_MAX_TITLE_CHARS,
  SETUP_MIN_DESCRIPTION_CHARS,
  SETUP_PER_KNOWLEDGEBASE_PER_DAY,
  SETUP_PER_PERSON_PER_HOUR,
  parseSetupSuggestion,
  setupCounters,
  setupRefusal,
  setupRequest,
  type SetupExistingPage,
  type SetupRefusal,
  type SetupSuggestion,
  type SqlStatement,
} from '@liveknowledge/knowledge';
import { ModelCallError, callModel, modelFailureWords } from '@liveworkspace/ai';
import type { KnowledgeSetupProvider, KnowledgeSetupSuggestion } from '@liveknowledge/api-schema';
import { ASK_UNAVAILABLE_WORDS, applyingAi, askerOf, isAiRefusal } from '../knowledge/ai-settings';
import { rowsOf, runAll } from '../knowledge/knowledge-db';
import { modelDoorFor } from '../knowledge/model-door';
import { builtInAi, suggestOnBuiltIn } from '../knowledge/setup-built-in-ai';
import { spendSetupDraft } from '../knowledge/setup-draft-count';
import { forbidden, json } from '../responses';
import { writesPages } from './context';
import type { KnowledgeRoute } from './knowledge-routes';

const REFUSAL: Record<SetupRefusal, { status: number; message: string }> = {
  'no-description': {
    status: 400,
    message: `Describe the knowledgebase in at least ${SETUP_MIN_DESCRIPTION_CHARS} characters.`,
  },
  'description-too-long': {
    status: 400,
    message: `A description is at most ${SETUP_MAX_DESCRIPTION_CHARS.toLocaleString('en')} characters.`,
  },
  'person-limit': {
    status: 429,
    message: `You have asked for ${SETUP_PER_PERSON_PER_HOUR} structures this hour. Try again later.`,
  },
  'knowledgebase-limit': {
    status: 429,
    message: `This knowledgebase has had ${SETUP_PER_KNOWLEDGEBASE_PER_DAY} structures suggested today. Try again tomorrow.`,
  },
};

/** What the reply's failure to hold a structure is called (the dialog: "Could Not Suggest a Structure"). */
export const NO_STRUCTURE = 'no-structure';
const NO_STRUCTURE_WORDS = 'Could not suggest a structure. Try again.';

/** Built-in AI's refusals (describe-to-set-up.md "The model"): its kind, status and fixed words. */
const BUILT_IN = {
  unavailable: {
    status: 503,
    error: 'built-in-unavailable',
    message: "Built-in AI isn't set up on this server. Add your team's AI key in AI Settings.",
  },
  limit: {
    status: 429,
    error: 'built-in-limit',
    message: `You have used today's ${SETUP_BUILT_IN_PER_PERSON_PER_DAY} built-in suggestions. Try again tomorrow, or add your team's AI key in AI Settings.`,
  },
  failed: {
    status: 502,
    error: 'built-in-failed',
    message: "The built-in AI couldn't answer just now. Try again in a moment.",
  },
} as const;

const refused = (status: number, error: string, message: string, more: object = {}) =>
  json({ error, message, ...more }, { status });

// The pages already there, read defensively: titles and depths only, within the package's bounds.
function existingOf(value: unknown): SetupExistingPage[] {
  if (!Array.isArray(value)) return [];
  const pages: SetupExistingPage[] = [];
  for (const entry of value.slice(0, SETUP_MAX_EXISTING_PAGES)) {
    const { title, depth } = (entry ?? {}) as Partial<SetupExistingPage>;
    if (typeof title !== 'string' || !title.trim()) continue;
    pages.push({
      title: title.trim().slice(0, SETUP_MAX_TITLE_CHARS),
      depth: typeof depth === 'number' && Number.isFinite(depth) ? depth : 1,
    });
  }
  return pages;
}

const answered = (
  suggestion: SetupSuggestion,
  provider: KnowledgeSetupProvider,
  credits: KnowledgeAiCredits | null = null,
) =>
  json({
    ...suggestion,
    provider,
    ...(credits ? { credits } : {}),
  } satisfies KnowledgeSetupSuggestion);

const usedOf = async (env: KnowledgeRoute['ctx']['env'], statement: SqlStatement) =>
  (await rowsOf<{ used: number }>(env, statement))[0]?.used ?? 0;

export async function handleSetupSuggest({
  ctx,
  document,
  grant,
}: KnowledgeRoute): Promise<Response> {
  const { env } = ctx;
  // A signed-in Editor or Participant in person (describe-to-set-up.md "Share roles").
  if (!writesPages(grant) || ctx.token || !ctx.accountUserId) return forbidden();
  const person = ctx.accountUserId;
  const body = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
  const description = typeof body?.description === 'string' ? body.description : '';
  const now = Date.now();
  const counters = setupCounters(person, now);
  const refusal = setupRefusal(description, {
    personThisHour: await usedOf(env, counters.readPerson),
    knowledgebaseToday: await usedOf(env, counters.readKnowledgebase),
  });
  if (refusal) return refused(REFUSAL[refusal].status, refusal, REFUSAL[refusal].message);
  // The knowledgebase's key, its team's, the person's own, or built-in AI (search-and-ask.md "Which key answers").
  const ai = await applyingAi(env, document.id, askerOf(ctx, document.teamId));
  // A key that does not open, or accounts that could not answer, is refused as Ask refuses it (isAiRefusal).
  if (isAiRefusal(ai))
    return refused(409, 'ask_unavailable', ASK_UNAVAILABLE_WORDS[ai], { reason: ai });
  const existing = existingOf(body?.existing);
  if (typeof ai === 'string') {
    // No key (or no secret to keep one under): built-in AI.
    const client = builtInAi(env);
    const no = (why: (typeof BUILT_IN)[keyof typeof BUILT_IN]) =>
      refused(why.status, why.error, why.message);
    if (!client) return no(BUILT_IN.unavailable);
    const spent = await spendSetupDraft(env, person, now);
    // The count guards a bill: unreachable, the suggestion is refused rather than the cap lifted.
    if (spent === 'unavailable')
      return refused(503, BUILT_IN.failed.error, BUILT_IN.failed.message);
    if (!spent) return no(BUILT_IN.limit);
    // With Pro on, the owner's AI credits for a setup (two; its second ask rides them), once every cap has passed (tiers.md).
    const credit = await spendBuiltInCredit(
      env,
      document,
      'knowledgeSetup',
      creditCallerOf(ctx, person),
    );
    if (!credit.ok) return credit.response;
    await runAll(env, counters.bump);
    const asked = await suggestOnBuiltIn(client, { description, existing });
    const log = { documentId: document.id, provider: 'built-in', asks: asked.asks };
    if (asked.answer === 'failed') {
      console.warn('[knowledge] setup failed', { ...log, kind: BUILT_IN.failed.error });
      return no(BUILT_IN.failed);
    }
    if (asked.answer === 'no-structure') {
      console.warn('[knowledge] setup no structure', log);
      return refused(502, NO_STRUCTURE, NO_STRUCTURE_WORDS);
    }
    console.info('[knowledge] setup suggested', {
      ...log,
      pages: asked.suggestion.pages.length,
    });
    return answered(asked.suggestion, 'built-in', credit.credits);
  }
  // Counted before the model is called: a suggestion that fails still spent a call on the team's key.
  await runAll(env, counters.bump);
  try {
    const reply = await callModel({
      provider: ai.provider,
      fetch: modelDoorFor(env, ai.provider),
      apiKey: ai.apiKey,
      model: ai.model,
      request: setupRequest({ description, existing }),
      signal: ctx.request.signal,
    });
    const suggestion = parseSetupSuggestion(reply.text);
    if (!suggestion) {
      console.warn('[knowledge] setup no structure', {
        documentId: document.id,
        provider: ai.provider,
        stop: reply.stopReason,
      });
      return refused(502, NO_STRUCTURE, NO_STRUCTURE_WORDS);
    }
    console.info('[knowledge] setup suggested', {
      documentId: document.id,
      provider: ai.provider,
      pages: suggestion.pages.length,
      model: reply.model,
    });
    return answered(suggestion, ai.provider);
  } catch (error) {
    // The kind and its fixed words; never the upstream's own message, the request or the key.
    const kind = error instanceof ModelCallError ? error.kind : 'other';
    console.warn('[knowledge] setup failed', {
      documentId: document.id,
      provider: ai.provider,
      kind,
    });
    return refused(502, kind, modelFailureWords(ai.provider, kind), { provider: ai.provider });
  }
}
