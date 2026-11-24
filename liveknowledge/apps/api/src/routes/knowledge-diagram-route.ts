// POST /api/documents/<id>/pages/<tab>/describe-diagram (docs/specs/013-workspace/send-to-diagram.md): Send to
// Diagram's draft, words picked on a page read as a diagram, answered whole as JSON (`{graph, provider}`). Nothing is
// written here: the editor hands the graph to the index, which asks livediagram to draw it as the person's own diagram.
// On the key that answers Ask (the knowledgebase's, its team's or the person's own) when one does and the person did
// not choose built-in AI, else on built-in AI (Workers AI). Any signed-in reader in person: an API token is told it
// needs a person, and a guest or a visitor without an account is refused, since it spends a key or liveknowledge's
// built-in AI. What the model is told is the words and the page's title, fenced; its reply is read strictly
// (`parseDiagramDraft`, then the platform's `readDiagramSendGraph`) and only ever placed as labels.
import {
  DIAGRAM_BUILT_IN_PER_PERSON_PER_DAY,
  DIAGRAM_DRAFT_BUILT_IN_ASKS,
  DIAGRAM_DRAFT_PER_KNOWLEDGEBASE_PER_DAY,
  DIAGRAM_DRAFT_PER_PERSON_PER_HOUR,
  DIAGRAM_REFUSED_NOT_JSON,
  DIAGRAM_REFUSED_NO_NODE,
  diagramBuiltInInput,
  diagramCounters,
  diagramDraftRefusal,
  diagramDraftRequest,
  parseDiagramDraft,
  type DiagramDraftInput,
  type DiagramDraftRefusal,
  type SqlStatement,
} from '@liveknowledge/knowledge';
import {
  DIAGRAM_SEND_WORDS_MAX,
  isDiagramSendKind,
  type DiagramSendGraph,
} from '@liveworkspace/index-client';
import { ModelCallError, callModel, modelFailureWords } from '@liveworkspace/ai';
import { ASK_UNAVAILABLE_WORDS, applyingAi, askerOf, isAiRefusal } from '../knowledge/ai-settings';
import { rowsOf, runAll } from '../knowledge/knowledge-db';
import { modelDoorFor } from '../knowledge/model-door';
import { askBuiltInOnce, builtInAi, type BuiltInAi } from '../knowledge/setup-built-in-ai';
import { spendSetupDraft } from '../knowledge/setup-draft-count';
import { json } from '../responses';
import type { KnowledgeRoute } from './knowledge-routes';

const REFUSAL: Record<DiagramDraftRefusal, { status: number; message: string }> = {
  'no-words': { status: 400, message: 'Pick some words to draw.' },
  'words-too-long': {
    status: 400,
    message: `Send to Diagram reads at most ${DIAGRAM_SEND_WORDS_MAX.toLocaleString('en')} characters. Pick fewer words.`,
  },
  'person-limit': {
    status: 429,
    message: `You have drawn ${DIAGRAM_DRAFT_PER_PERSON_PER_HOUR} diagrams this hour. Try again later.`,
  },
  'knowledgebase-limit': {
    status: 429,
    message: `This knowledgebase has drawn ${DIAGRAM_DRAFT_PER_KNOWLEDGEBASE_PER_DAY} diagrams today. Try again tomorrow.`,
  },
};

/** What a reply with no box that reads is called. */
export const NO_DIAGRAM = 'no-diagram';
const NO_DIAGRAM_WORDS =
  "The AI couldn't find a diagram in these words. Try other words, or pick a kind.";

const BUILT_IN = {
  unavailable: {
    status: 503,
    error: 'built-in-unavailable',
    message: "Built-in AI isn't set up on this server. Add your AI key in AI Settings.",
  },
  limit: {
    status: 429,
    error: 'built-in-limit',
    message: `You have drawn today's ${DIAGRAM_BUILT_IN_PER_PERSON_PER_DAY} diagrams on built-in AI. Try again tomorrow, or add your AI key in AI Settings.`,
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

const answered = (graph: DiagramSendGraph, provider: string) => json({ graph, provider });

type Drafted =
  | { answer: 'drafted'; asks: number; graph: DiagramSendGraph }
  | { answer: 'no-diagram'; asks: number }
  | { answer: 'failed'; asks: number };

/** Asks built-in AI, in JSON mode, until a graph reads or the asks are spent. */
async function draftOnBuiltIn(client: BuiltInAi, input: DiagramDraftInput): Promise<Drafted> {
  let why: string | undefined;
  let asks = 0;
  while (asks < DIAGRAM_DRAFT_BUILT_IN_ASKS) {
    asks += 1;
    const text = await askBuiltInOnce(client, diagramBuiltInInput(input, why));
    if (text === null) return { answer: 'failed', asks };
    const graph = text === undefined ? undefined : parseDiagramDraft(text, input.kind);
    if (graph) return { answer: 'drafted', asks, graph };
    why = text?.includes('{') ? DIAGRAM_REFUSED_NO_NODE : DIAGRAM_REFUSED_NOT_JSON;
  }
  return { answer: 'no-diagram', asks };
}

export async function handleDescribeDiagram(
  { ctx, document }: KnowledgeRoute,
  tab: string,
): Promise<Response> {
  const { env } = ctx;
  if (ctx.token)
    return refused(403, 'needs_a_person', 'A person sends words to a diagram, never an agent.');
  const person = ctx.accountUserId;
  if (!person) return refused(403, 'sign_in_required', 'Sign in to send words to a diagram.');
  const body = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
  const words = typeof body?.words === 'string' ? body.words : '';
  const kind = isDiagramSendKind(body?.kind) ? body.kind : 'auto';
  const now = Date.now();
  const counters = diagramCounters(person, now);
  const refusal = diagramDraftRefusal(words, {
    personThisHour: await usedOf(env, counters.readPerson),
    knowledgebaseToday: await usedOf(env, counters.readKnowledgebase),
  });
  if (refusal) return refused(REFUSAL[refusal].status, refusal, REFUSAL[refusal].message);
  const page = document.tabs.find((t) => t.id === tab)?.name ?? '';
  const input: DiagramDraftInput = { words, kind, page };
  // Built-in AI when the person chose it; otherwise the key order Ask uses (search-and-ask.md "Which key answers").
  const ai =
    body?.ai === 'built-in'
      ? 'chosen'
      : await applyingAi(env, document.id, askerOf(ctx, document.teamId));
  if (isAiRefusal(ai))
    return refused(409, 'ask_unavailable', ASK_UNAVAILABLE_WORDS[ai], { reason: ai });
  const log = { documentId: document.id, kind };
  if (typeof ai === 'string') {
    const client = builtInAi(env);
    const no = (why: (typeof BUILT_IN)[keyof typeof BUILT_IN]) =>
      refused(why.status, why.error, why.message);
    if (!client) return no(BUILT_IN.unavailable);
    const spent = await spendSetupDraft(env, person, now, 'diagram');
    // The count guards a bill: unreachable, the draft is refused rather than the cap lifted.
    if (spent === 'unavailable') return no(BUILT_IN.failed);
    if (!spent) return no(BUILT_IN.limit);
    await runAll(env, counters.bump);
    const drafted = await draftOnBuiltIn(client, input);
    const told = { ...log, provider: 'built-in', asks: drafted.asks };
    if (drafted.answer === 'failed') {
      console.warn('[knowledge] diagram failed', { ...told, kind: BUILT_IN.failed.error });
      return no(BUILT_IN.failed);
    }
    if (drafted.answer === 'no-diagram') {
      console.warn('[knowledge] diagram none', told);
      return refused(502, NO_DIAGRAM, NO_DIAGRAM_WORDS);
    }
    console.info('[knowledge] diagram drafted', {
      ...told,
      nodes: drafted.graph.nodes.length,
      edges: drafted.graph.edges.length,
    });
    return answered(drafted.graph, 'built-in');
  }
  // Counted before the model is called: a draft that fails still spent a call on the key.
  await runAll(env, counters.bump);
  try {
    const reply = await callModel({
      provider: ai.provider,
      fetch: modelDoorFor(env, ai.provider),
      apiKey: ai.apiKey,
      model: ai.model,
      request: diagramDraftRequest(input),
      signal: ctx.request.signal,
    });
    const graph = parseDiagramDraft(reply.text, kind);
    if (!graph) {
      console.warn('[knowledge] diagram none', { ...log, provider: ai.provider });
      return refused(502, NO_DIAGRAM, NO_DIAGRAM_WORDS);
    }
    console.info('[knowledge] diagram drafted', {
      ...log,
      provider: ai.provider,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      model: reply.model,
    });
    return answered(graph, ai.provider);
  } catch (error) {
    // The kind and its fixed words; never the upstream's own message, the request or the key.
    const failure = error instanceof ModelCallError ? error.kind : 'other';
    console.warn('[knowledge] diagram failed', { ...log, provider: ai.provider, failure });
    return refused(502, failure, modelFailureWords(ai.provider, failure), {
      provider: ai.provider,
    });
  }
}
