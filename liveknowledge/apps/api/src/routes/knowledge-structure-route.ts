// POST /api/documents/<id>/pages/<tab>/describe-structure (docs/specs/030-knowledgebase/describe-to-set-up.md
// "Describe Structure on a page"): an initial structure drafted for one empty page (headings, a line under each, and
// where it helps a list, a table or a callout), on the key that answers Ask (the knowledgebase's, its team's or the
// person's own) when one does and the person did not choose built-in AI, else on built-in AI (Workers AI). Answered
// whole as JSON (`PageStructureResponse`); nothing is written here: the editor puts it into the page's draft, which
// the person saves or cancels. A signed-in person who may edit pages, in person: an API token is told it needs a
// person, a guest or a visitor without an account is refused, since it spends a key or liveknowledge's built-in AI.
// What the model is told is the page's title, the person's words, the knowledgebase's name and its tree's titles
// (never a page's writing), all fenced; its reply is read strictly (`parsePageStructure`) and only ever placed as text.
import {
  STRUCTURE_BUILT_IN_ASKS,
  STRUCTURE_BUILT_IN_PER_PERSON_PER_DAY,
  STRUCTURE_MAX_PURPOSE_CHARS,
  STRUCTURE_MAX_TITLE_CHARS,
  STRUCTURE_MAX_TREE_PAGES,
  STRUCTURE_PER_KNOWLEDGEBASE_PER_DAY,
  STRUCTURE_PER_PERSON_PER_HOUR,
  STRUCTURE_REFUSED_NOT_JSON,
  STRUCTURE_REFUSED_NO_HEADING,
  pageStructureBuiltInInput,
  pageStructureRequest,
  parsePageStructure,
  structureCounters,
  structureRefusal,
  type PageStructureBlock,
  type PageStructureInput,
  type SqlStatement,
  type StructureRefusal,
} from '@liveknowledge/knowledge';
import { pageTreeRows } from '@liveknowledge/document';
import type { KnowledgeSetupProvider, PageStructureResponse } from '@liveknowledge/api-schema';
import { ASK_UNAVAILABLE_WORDS, applyingAi, askerOf, isAiRefusal } from '../knowledge/ai-settings';
import { rowsOf, runAll } from '../knowledge/knowledge-db';
import { ModelCallError, callModel, modelFailureWords } from '@liveworkspace/ai';
import { modelDoorFor } from '../knowledge/model-door';
import { askBuiltInOnce, builtInAi, type BuiltInAi } from '../knowledge/setup-built-in-ai';
import { spendSetupDraft } from '../knowledge/setup-draft-count';
import { json } from '../responses';
import { writesPages } from './context';
import type { KnowledgeRoute } from './knowledge-routes';

const REFUSAL: Record<StructureRefusal, { status: number; message: string }> = {
  'no-purpose': { status: 400, message: 'Give the page a title, or say what it is for.' },
  'purpose-too-long': {
    status: 400,
    message: `What the page is for is at most ${STRUCTURE_MAX_PURPOSE_CHARS} characters.`,
  },
  'person-limit': {
    status: 429,
    message: `You have asked for ${STRUCTURE_PER_PERSON_PER_HOUR} structures this hour. Try again later.`,
  },
  'knowledgebase-limit': {
    status: 429,
    message: `This knowledgebase has had ${STRUCTURE_PER_KNOWLEDGEBASE_PER_DAY} structures drafted today. Try again tomorrow.`,
  },
};

/** What a reply with no heading that reads is called (the dialog: "The AI Could Not Draft This Page"). */
export const NO_STRUCTURE = 'no-structure';
const NO_STRUCTURE_WORDS = 'The AI could not draft this page. Try again.';

/** Built-in AI's refusals: their kind, status and fixed words. */
const BUILT_IN = {
  unavailable: {
    status: 503,
    error: 'built-in-unavailable',
    message: "Built-in AI isn't set up on this server. Add your team's AI key in AI Settings.",
  },
  limit: {
    status: 429,
    error: 'built-in-limit',
    message: `You have used today's ${STRUCTURE_BUILT_IN_PER_PERSON_PER_DAY} built-in drafts. Try again tomorrow, or add your team's AI key in AI Settings.`,
  },
  failed: {
    status: 502,
    error: 'built-in-failed',
    message: "The built-in AI couldn't answer just now. Try again in a moment.",
  },
} as const;

const refused = (status: number, error: string, message: string, more: object = {}) =>
  json({ error, message, ...more }, { status });

const usedOf = async (env: KnowledgeRoute['ctx']['env'], statement: SqlStatement) =>
  (await rowsOf<{ used: number }>(env, statement))[0]?.used ?? 0;

const answered = (blocks: PageStructureBlock[], provider: KnowledgeSetupProvider) =>
  json({ blocks, provider } satisfies PageStructureResponse);

type Drafted =
  | { answer: 'drafted'; asks: number; blocks: PageStructureBlock[] }
  | { answer: 'no-structure'; asks: number }
  | { answer: 'failed'; asks: number };

/** Asks built-in AI, in JSON mode, until a structure reads or the asks are spent. */
async function draftOnBuiltIn(client: BuiltInAi, input: PageStructureInput): Promise<Drafted> {
  let why: string | undefined;
  let asks = 0;
  while (asks < STRUCTURE_BUILT_IN_ASKS) {
    asks += 1;
    const text = await askBuiltInOnce(client, pageStructureBuiltInInput(input, why));
    if (text === null) return { answer: 'failed', asks };
    const blocks = text === undefined ? undefined : parsePageStructure(text);
    if (blocks) return { answer: 'drafted', asks, blocks };
    why = text?.includes('{') ? STRUCTURE_REFUSED_NO_HEADING : STRUCTURE_REFUSED_NOT_JSON;
  }
  return { answer: 'no-structure', asks };
}

export async function handleDescribeStructure(
  { ctx, document, grant }: KnowledgeRoute,
  tab: string,
): Promise<Response> {
  const { env } = ctx;
  // A person drafts a page's structure, never an agent (as Verify and approval are a person's).
  if (ctx.token)
    return refused(403, 'needs_a_person', "A person drafts a page's structure, never an agent.");
  if (!writesPages(grant)) return refused(403, 'forbidden', 'Only someone who edits pages can.');
  const person = ctx.accountUserId;
  if (!person) return refused(403, 'sign_in_required', "Sign in to draft a page's structure.");
  const body = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
  const purpose = typeof body?.purpose === 'string' ? body.purpose : '';
  // The draft's Title (a page just made is named only in its draft until Save), else the saved name.
  const saved = document.tabs.find((t) => t.id === tab)?.name ?? '';
  const title = (typeof body?.title === 'string' ? body.title : saved)
    .trim()
    .slice(0, STRUCTURE_MAX_TITLE_CHARS);
  const now = Date.now();
  const counters = structureCounters(person, now);
  const refusal = structureRefusal(
    { title, purpose },
    {
      personThisHour: await usedOf(env, counters.readPerson),
      knowledgebaseToday: await usedOf(env, counters.readKnowledgebase),
    },
  );
  if (refusal) return refused(REFUSAL[refusal].status, refusal, REFUSAL[refusal].message);
  // A link to one page sees its tree's other pages nameless (knowledge-routes.ts `seen`): they are left out.
  const tree = pageTreeRows(document.tabs)
    .filter((row) => row.page.name.trim())
    .slice(0, STRUCTURE_MAX_TREE_PAGES)
    .map((row) => ({ title: row.page.name.trim(), depth: row.depth }));
  const input: PageStructureInput = { title, purpose, knowledgebase: document.name, tree };
  // Built-in AI when the person chose it, whatever key is kept (search-and-ask.md "Choosing which AI answers").
  // Otherwise the knowledgebase's key, its team's, the person's own, or built-in AI (search-and-ask.md "Which key
  // answers").
  const ai =
    body?.ai === 'built-in'
      ? 'chosen'
      : await applyingAi(env, document.id, askerOf(ctx, document.teamId));
  // A key that does not open, or accounts that could not answer, is refused as Ask refuses it (isAiRefusal).
  if (isAiRefusal(ai))
    return refused(409, 'ask_unavailable', ASK_UNAVAILABLE_WORDS[ai], { reason: ai });
  const log = { documentId: document.id };
  if (typeof ai === 'string') {
    const client = builtInAi(env);
    const no = (why: (typeof BUILT_IN)[keyof typeof BUILT_IN]) =>
      refused(why.status, why.error, why.message);
    if (!client) return no(BUILT_IN.unavailable);
    const spent = await spendSetupDraft(env, person, now, 'structure');
    // The count guards a bill: unreachable, the draft is refused rather than the cap lifted.
    if (spent === 'unavailable') return no(BUILT_IN.failed);
    if (!spent) return no(BUILT_IN.limit);
    await runAll(env, counters.bump);
    const drafted = await draftOnBuiltIn(client, input);
    const told = { ...log, provider: 'built-in', asks: drafted.asks };
    if (drafted.answer === 'failed') {
      console.warn('[knowledge] structure failed', { ...told, kind: BUILT_IN.failed.error });
      return no(BUILT_IN.failed);
    }
    if (drafted.answer === 'no-structure') {
      console.warn('[knowledge] structure none', told);
      return refused(502, NO_STRUCTURE, NO_STRUCTURE_WORDS);
    }
    console.info('[knowledge] structure drafted', { ...told, blocks: drafted.blocks.length });
    return answered(drafted.blocks, 'built-in');
  }
  // Counted before the model is called: a draft that fails still spent a call on the key.
  await runAll(env, counters.bump);
  try {
    const reply = await callModel({
      provider: ai.provider,
      fetch: modelDoorFor(env, ai.provider),
      apiKey: ai.apiKey,
      model: ai.model,
      request: pageStructureRequest(input),
      signal: ctx.request.signal,
    });
    const blocks = parsePageStructure(reply.text);
    if (!blocks) {
      console.warn('[knowledge] structure none', { ...log, provider: ai.provider });
      return refused(502, NO_STRUCTURE, NO_STRUCTURE_WORDS);
    }
    console.info('[knowledge] structure drafted', {
      ...log,
      provider: ai.provider,
      blocks: blocks.length,
      model: reply.model,
    });
    return answered(blocks, ai.provider);
  } catch (error) {
    // The kind and its fixed words; never the upstream's own message, the request or the key.
    const kind = error instanceof ModelCallError ? error.kind : 'other';
    console.warn('[knowledge] structure failed', { ...log, provider: ai.provider, kind });
    return refused(502, kind, modelFailureWords(ai.provider, kind), { provider: ai.provider });
  }
}
