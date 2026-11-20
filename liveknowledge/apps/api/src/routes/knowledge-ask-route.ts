// POST /api/documents/<id>/ask (docs/specs/030-knowledgebase/search-and-ask.md "Ask"): a question answered from the
// knowledgebase's own pages on the team's own key (Claude's or OpenAI's), streamed as server-sent events (`AskEvent`): `delta`
// pieces of the answer, then one `done` with the sources, what was found but not used and the gaps; or one `error`.
// A signed-in Editor, Participant or Viewer may ask (an API token asks for its account); a guest or a visitor
// through a share link may not, since it would spend the team's key for strangers.
import {
  ASK_MAX_QUESTION_CHARS,
  ASK_MAX_TURNS,
  ASK_PER_KNOWLEDGEBASE_PER_DAY,
  ASK_PER_PERSON_PER_HOUR,
  ModelCallError,
  askAnswerStream,
  askCounters,
  askRefusal,
  askRequest,
  askSearch,
  callModel,
  chooseAskPassages,
  foundPassage,
  modelFailureWords,
  questionKey,
  upsertQuestion,
  type AskPassage,
  type AskRefusal,
  type SearchRow,
  type SqlStatement,
} from '@liveknowledge/knowledge';
import type { AskEvent, AskSource, AskTurn } from '@liveknowledge/api-schema';
import { ASK_UNAVAILABLE_WORDS, openAi } from '../knowledge/ai-settings';
import { modelDoorFor } from '../knowledge/model-door';
import { accountOf, readerOf } from '../knowledge/knowledge-caller';
import { rowsOf, runAll } from '../knowledge/knowledge-db';
import { CORS_HEADERS, json } from '../responses';
import type { KnowledgeRoute } from './knowledge-routes';

/** An earlier answer sent back as a turn is read up to here. */
export const ASK_MAX_TURN_ANSWER_CHARS = 8_000;

const REFUSAL: Record<AskRefusal, { status: number; message: string }> = {
  'no-question': { status: 400, message: 'Ask a question.' },
  'question-too-long': {
    status: 400,
    message: `A question is at most ${ASK_MAX_QUESTION_CHARS.toLocaleString('en')} characters.`,
  },
  'person-limit': {
    status: 429,
    message: `You have asked ${ASK_PER_PERSON_PER_HOUR} questions this hour. Try again later.`,
  },
  'knowledgebase-limit': {
    status: 429,
    message: `This knowledgebase has answered ${ASK_PER_KNOWLEDGEBASE_PER_DAY} questions today. Try again tomorrow.`,
  },
};

const refused = (status: number, error: string, message: string) =>
  json({ error, message }, { status });

// The conversation so far, read defensively: at most the turns the package sends, each within its bounds.
function turnsOf(value: unknown): AskTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: AskTurn[] = [];
  for (const turn of value.slice(-(ASK_MAX_TURNS - 1))) {
    const { question, answer } = (turn ?? {}) as Partial<AskTurn>;
    if (typeof question !== 'string' || typeof answer !== 'string') continue;
    turns.push({
      question: question.slice(0, ASK_MAX_QUESTION_CHARS),
      answer: answer.slice(0, ASK_MAX_TURN_ANSWER_CHARS),
    });
  }
  return turns;
}

const usedOf = async (env: KnowledgeRoute['ctx']['env'], statement: SqlStatement) =>
  (await rowsOf<{ used: number }>(env, statement))[0]?.used ?? 0;

const sourceOf = ({ number, passage }: AskPassage): AskSource => ({
  number,
  passageId: passage.id,
  tab: passage.tab,
  title: passage.title,
  headings: passage.headings,
  text: passage.text,
  trust: passage.trust,
  ...(passage.verifiedAt === undefined ? {} : { verifiedAt: passage.verifiedAt }),
  firstBlock: passage.firstBlock,
  lastBlock: passage.lastBlock,
});

export async function handleAsk({ ctx, document }: KnowledgeRoute): Promise<Response> {
  const { env } = ctx;
  const person = accountOf(ctx);
  if (!person)
    return refused(403, 'sign_in_required', 'Sign in to ask this knowledgebase a question.');
  const body = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
  const question = typeof body?.question === 'string' ? body.question : '';
  const now = Date.now();
  const counters = askCounters(person, now);
  const refusal = askRefusal(question, {
    personThisHour: await usedOf(env, counters.readPerson),
    knowledgebaseToday: await usedOf(env, counters.readKnowledgebase),
  });
  if (refusal) return refused(REFUSAL[refusal].status, refusal, REFUSAL[refusal].message);
  const ai = await openAi(env, document.id);
  if (typeof ai === 'string')
    return refused(ai === 'no-secret' ? 503 : 409, 'ask_unavailable', ASK_UNAVAILABLE_WORDS[ai]);
  // Counted before the model is called: a question that fails still spent a call on the team's key.
  await runAll(env, counters.bump);
  const search = askSearch(question, { now });
  const passages = chooseAskPassages(
    search ? (await rowsOf<SearchRow>(env, search)).map(foundPassage) : [],
  );
  const request = askRequest({ question, passages, turns: turnsOf(body?.turns) });
  const asker = readerOf(ctx);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AskEvent) =>
        controller.enqueue(
          encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
        );
      const answer = askAnswerStream(passages);
      try {
        const reply = await callModel({
          provider: ai.provider,
          fetch: modelDoorFor(env, ai.provider),
          apiKey: ai.apiKey,
          model: ai.model,
          request,
          signal: ctx.request.signal,
          onText: (piece) => {
            const text = answer.push(piece);
            if (text) send({ type: 'delta', text });
          },
        });
        const read = answer.finish();
        const byNumber = new Map(passages.map((p) => [p.number, p]));
        const sources = read.cited.flatMap((c) => {
          const passage = byNumber.get(c.number);
          return passage ? [sourceOf(passage)] : [];
        });
        const notUsed = read.notUsed.flatMap((n) => {
          const passage = byNumber.get(n.number);
          return passage ? [{ ...sourceOf(passage), reason: n.reason }] : [];
        });
        // Each part the pages did not cover is a question nobody could answer (ai-knowledge.md).
        const gaps = read.gaps.flatMap((gap) => {
          const key = questionKey(gap);
          return key ? upsertQuestion(key, gap, asker, now) : [];
        });
        await runAll(env, gaps);
        console.info('[knowledge] ask', {
          documentId: document.id,
          passages: passages.length,
          cited: sources.length,
          gaps: read.gaps.length,
          model: reply.model,
        });
        send({
          type: 'done',
          text: read.text,
          sources,
          notUsed,
          gaps: read.gaps,
          model: reply.model,
        });
      } catch (error) {
        // The kind and its fixed words; never the upstream's own message, the request or the key.
        const kind = error instanceof ModelCallError ? error.kind : 'other';
        console.warn('[knowledge] ask failed', {
          documentId: document.id,
          provider: ai.provider,
          kind,
        });
        send({
          type: 'error',
          kind,
          provider: ai.provider,
          message: modelFailureWords(ai.provider, kind),
        });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
