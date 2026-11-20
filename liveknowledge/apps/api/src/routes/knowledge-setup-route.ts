// POST /api/documents/<id>/setup/suggest (docs/specs/030-knowledgebase/describe-to-set-up.md "The model"): a page
// structure proposed from a person's description of what the knowledgebase is for, on the team's own key. One model
// call, answered whole as JSON (`KnowledgeSetupSuggestion`); nothing is written to the knowledgebase here, the
// editor makes the pages the person keeps. A signed-in Editor in person alone: no API token, no guest, no visitor
// through a share link, since it spends the team's key and is the start of an edit. The description is untrusted
// text to the model and the reply untrusted text to the app: one is fenced, the other is validated field by field
// (`parseSetupSuggestion`) and only ever placed as text.
import {
  ModelCallError,
  SETUP_MAX_DESCRIPTION_CHARS,
  SETUP_MAX_EXISTING_PAGES,
  SETUP_MAX_TITLE_CHARS,
  SETUP_MIN_DESCRIPTION_CHARS,
  SETUP_PER_KNOWLEDGEBASE_PER_DAY,
  SETUP_PER_PERSON_PER_HOUR,
  callModel,
  modelFailureWords,
  parseSetupSuggestion,
  setupCounters,
  setupRefusal,
  setupRequest,
  type SetupExistingPage,
  type SetupRefusal,
  type SqlStatement,
} from '@liveknowledge/knowledge';
import type { KnowledgeSetupSuggestion } from '@liveknowledge/api-schema';
import { ASK_UNAVAILABLE_WORDS, openAi } from '../knowledge/ai-settings';
import { rowsOf, runAll } from '../knowledge/knowledge-db';
import { modelDoorFor } from '../knowledge/model-door';
import { forbidden, json } from '../responses';
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

const usedOf = async (env: KnowledgeRoute['ctx']['env'], statement: SqlStatement) =>
  (await rowsOf<{ used: number }>(env, statement))[0]?.used ?? 0;

export async function handleSetupSuggest({
  ctx,
  document,
  grant,
}: KnowledgeRoute): Promise<Response> {
  const { env } = ctx;
  if (grant.role !== 'edit' || ctx.token || !ctx.accountUserId) return forbidden();
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
  const ai = await openAi(env, document.id);
  if (typeof ai === 'string')
    return refused(ai === 'no-secret' ? 503 : 409, 'ask_unavailable', ASK_UNAVAILABLE_WORDS[ai]);
  // Counted before the model is called: a suggestion that fails still spent a call on the team's key.
  await runAll(env, counters.bump);
  try {
    const reply = await callModel({
      provider: ai.provider,
      fetch: modelDoorFor(env, ai.provider),
      apiKey: ai.apiKey,
      model: ai.model,
      request: setupRequest({ description, existing: existingOf(body?.existing) }),
      signal: ctx.request.signal,
    });
    const suggestion = parseSetupSuggestion(reply.text);
    if (!suggestion) {
      console.warn('[knowledge] setup no structure', {
        documentId: document.id,
        provider: ai.provider,
        stop: reply.stopReason,
      });
      return refused(502, NO_STRUCTURE, 'Could not suggest a structure. Try again.');
    }
    console.info('[knowledge] setup suggested', {
      documentId: document.id,
      provider: ai.provider,
      pages: suggestion.pages.length,
      model: reply.model,
    });
    return json(suggestion satisfies KnowledgeSetupSuggestion);
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
