// POST /api/documents/<id>/ask (docs/specs/030-knowledgebase/search-and-ask.md "Ask", "Built-in AI"): a question
// answered from the knowledgebase's own pages, on the team's own key (Claude's or OpenAI's) when one is set and the
// person did not choose built-in AI, else on built-in AI (Workers AI, liveknowledge's, under its daily caps), streamed as server-sent events (`AskEvent`): `delta`
// pieces of the answer, then one `done` with the sources, what was found but not used and the gaps; or one `error`.
// A signed-in Editor, Participant or Viewer may ask (an API token asks for its account); a guest or a visitor
// through a share link may not, since it would spend the team's key or liveknowledge's built-in AI for strangers.
import type { KnowledgeAiCredits } from '@liveknowledge/api-schema';
import { creditCallerOf, creditsHeader, spendBuiltInCredit } from '../knowledge/ai-credits';
import { newQuestions, queueNewQuestions } from '../document-room/automations/question-events';
import {
  ASK_BUILT_IN_PER_KNOWLEDGEBASE_PER_DAY,
  ASK_BUILT_IN_PER_PERSON_PER_DAY,
  ASK_BUILT_IN_SCOPE,
  ASK_MAX_QUESTION_CHARS,
  ASK_MAX_TURNS,
  ASK_PER_KNOWLEDGEBASE_PER_DAY,
  ASK_PER_PERSON_PER_HOUR,
  askAnswerStream,
  askCounters,
  askRefusal,
  askRequest,
  askSearch,
  bumpCounter,
  chooseAskPassages,
  dayOf,
  dismissQuestion,
  foundPassage,
  questionKey,
  readCounter,
  recordPageAnswers,
  upsertQuestion,
  type AskPassage,
  type AskRefusal,
  type SearchRow,
  type SqlStatement,
} from '@liveknowledge/knowledge';
import { ModelCallError, callModel, modelFailureWords, type ModelCaller } from '@liveworkspace/ai';
import type { AskEvent, AskSource, AskTurn } from '@liveknowledge/api-schema';
import { ASK_UNAVAILABLE_WORDS, applyingAi, askerOf, isAiRefusal } from '../knowledge/ai-settings';
import { modelDoorFor } from '../knowledge/model-door';
import { builtInAi } from '../knowledge/setup-built-in-ai';
import { spendSetupDraft } from '../knowledge/setup-draft-count';
import { accountOf, readerOf } from '../knowledge/knowledge-caller';
import { rowsOf, runAll } from '../knowledge/knowledge-db';
import { pageHealthWires } from '../knowledge/page-health-read';
import { labelScopeOf, labelsOfBody } from '../knowledge/label-scope';
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

/** Built-in AI's refusals (search-and-ask.md "Built-in AI"): its kind, status and fixed words. */
export const ASK_BUILT_IN = {
  unavailable: {
    status: 503,
    error: 'built-in-unavailable',
    message:
      "Built-in AI isn't set up on this server. An Editor can add your team's AI key in AI Settings.",
  },
  'person-limit': {
    status: 429,
    error: 'built-in-limit',
    message: `You have used today's ${ASK_BUILT_IN_PER_PERSON_PER_DAY} built-in questions. Try again tomorrow, or add your team's AI key in AI Settings.`,
  },
  'knowledgebase-limit': {
    status: 429,
    error: 'built-in-knowledgebase-limit',
    message: `This knowledgebase has used today's ${ASK_BUILT_IN_PER_KNOWLEDGEBASE_PER_DAY} built-in questions. Try again tomorrow, or add your team's AI key in AI Settings.`,
  },
  failed: {
    status: 503,
    error: 'built-in-failed',
    message: "The built-in AI couldn't answer just now. Try again in a moment.",
  },
} as const;

const refused = (status: number, error: string, message: string, more: object = {}) =>
  json({ error, message, ...more }, { status });
const refusedBuiltIn = (why: (typeof ASK_BUILT_IN)[keyof typeof ASK_BUILT_IN]) =>
  refused(why.status, why.error, why.message);

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

const sourceOf = ({ number, passage, health }: AskPassage): AskSource => ({
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
  ...(health ? { health } : {}),
});

export async function handleAsk({ ctx, document }: KnowledgeRoute): Promise<Response> {
  const { env } = ctx;
  const person = accountOf(ctx);
  if (!person)
    return refused(403, 'sign_in_required', 'Sign in to ask this knowledgebase a question.');
  const body = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
  const question = typeof body?.question === 'string' ? body.question : '';
  // `labels`: answer only from the pages carrying any of them (search-and-ask.md "By label"), refused before anything
  // is counted.
  const scope = labelScopeOf(document, labelsOfBody(body?.labels));
  if (scope instanceof Response) return scope;
  const now = Date.now();
  const counters = askCounters(person, now);
  const refusal = askRefusal(question, {
    personThisHour: await usedOf(env, counters.readPerson),
    knowledgebaseToday: await usedOf(env, counters.readKnowledgebase),
  });
  if (refusal) return refused(REFUSAL[refusal].status, refusal, REFUSAL[refusal].message);
  // Built-in AI when the person chose it, whatever key is kept (search-and-ask.md "Choosing which AI answers").
  // Else the knowledgebase's key, its team's, the asker's own, or built-in AI (search-and-ask.md "Which key answers").
  const ai =
    body?.ai === 'built-in'
      ? 'chosen'
      : await applyingAi(env, document.id, askerOf(ctx, document.teamId));
  // A key that is kept but does not open, or accounts that could not say whose key applies, is refused, never swapped
  // quietly for the next in line or built-in AI.
  if (isAiRefusal(ai))
    return refused(409, 'ask_unavailable', ASK_UNAVAILABLE_WORDS[ai], { reason: ai });
  let caller: ModelCaller;
  let credits: KnowledgeAiCredits | null = null;
  if (typeof ai === 'string') {
    // Chosen, or no key (or no secret to keep one under): built-in AI, under its own caps.
    const client = builtInAi(env);
    if (!client) return refusedBuiltIn(ASK_BUILT_IN.unavailable);
    const day = dayOf(now);
    const answeredToday = await usedOf(env, readCounter(ASK_BUILT_IN_SCOPE, day));
    if (answeredToday >= ASK_BUILT_IN_PER_KNOWLEDGEBASE_PER_DAY)
      return refusedBuiltIn(ASK_BUILT_IN['knowledgebase-limit']);
    const spent = await spendSetupDraft(env, person, now, 'ask');
    // The count guards a bill: unreachable, the question is refused rather than the cap lifted.
    if (spent === 'unavailable') return refusedBuiltIn(ASK_BUILT_IN.failed);
    if (!spent) return refusedBuiltIn(ASK_BUILT_IN['person-limit']);
    // With Pro on, one of the owner's AI credits, once every cap has passed (tiers.md).
    const credit = await spendBuiltInCredit(
      env,
      document,
      'knowledgeAsk',
      creditCallerOf(ctx, person),
    );
    if (!credit.ok) return credit.response;
    credits = credit.credits;
    await runAll(env, [...counters.bump, bumpCounter(ASK_BUILT_IN_SCOPE, day)]);
    caller = { provider: 'built-in', ai: client };
  } else {
    // Counted before the model is called: a question that fails still spent a call on the team's key.
    await runAll(env, counters.bump);
    caller = {
      provider: ai.provider,
      fetch: modelDoorFor(env, ai.provider),
      apiKey: ai.apiKey,
      model: ai.model,
    };
  }
  const { provider } = caller;
  const search =
    scope && scope.tabs.size === 0
      ? undefined
      : askSearch(question, {
          now,
          reviewEvery: document.knowledgeSettings.reviewEvery,
          ...(scope ? { onlyTabs: [...scope.tabs] } : {}),
        });
  const chosen = chooseAskPassages(
    search ? (await rowsOf<SearchRow>(env, search)).map(foundPassage) : [],
  );
  // Each passage goes with its page's Health Score (search-and-ask.md "Answering"): one read for the chosen pages.
  const health = await pageHealthWires(
    env,
    document.id,
    document.knowledgeSettings.reviewEvery,
    now,
    chosen.map((p) => p.passage.tab),
  );
  const passages = chosen.map((p) => {
    const scored = health.get(p.passage.tab);
    return scored ? { ...p, health: { score: scored.score, label: scored.label } } : p;
  });
  const earlier = turnsOf(body?.turns);
  const request = askRequest({ question, passages, turns: earlier });
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
          ...caller,
          request,
          signal: ctx.request.signal,
          onText: (piece) => {
            const text = answer.push(piece);
            if (text) send({ type: 'delta', text });
          },
        });
        const read = answer.finish();
        // Each source under the number the answer shows (1 first, as first cited), not the one it was sent as.
        const byNumber = new Map(passages.map((p) => [p.number, p]));
        const sources = read.cited.flatMap((c) => {
          const passage = byNumber.get(c.sent);
          return passage ? [{ ...sourceOf(passage), number: c.number }] : [];
        });
        const notUsed = read.notUsed.flatMap((n) => {
          const passage = byNumber.get(n.sent);
          return passage ? [{ ...sourceOf(passage), number: n.number, reason: n.reason }] : [];
        });
        // Each part the pages did not cover is a question nobody could answer (ai-knowledge.md); not under a label
        // scope, which asked only some of the pages (search-and-ask.md "By label").
        const recorded = scope ? [] : read.gaps;
        const gaps = recorded.flatMap((gap) => {
          const key = questionKey(gap);
          return key ? upsertQuestion(key, gap, asker, now) : [];
        });
        // A first question that cited pages counts for each of them (ai-knowledge.md "AI Context on a page"): one
        // statement, in the gaps' transaction. A follow-up leans on the turns before it, so it is not counted.
        const answered = earlier.length
          ? null
          : recordPageAnswers(
              questionKey(question),
              question,
              sources.map((s) => s.tab),
              now,
            );
        const fresh = await newQuestions(
          ctx,
          recorded.flatMap((gap) => {
            const key = questionKey(gap);
            return key ? [{ key, question: gap }] : [];
          }),
        );
        // A first question answered in full, from pages, is no longer unanswered: its group leaves Needs Attention
        // (owner 2026-11-21), as once a page is written for it.
        const askedKey = questionKey(question);
        const settled =
          !earlier.length && sources.length > 0 && read.gaps.length === 0 && askedKey
            ? dismissQuestion(askedKey)
            : [];
        await runAll(env, [...gaps, ...(answered ? [answered] : []), ...settled]);
        await queueNewQuestions(ctx, fresh);
        console.info('[knowledge] ask', {
          documentId: document.id,
          passages: passages.length,
          cited: sources.length,
          gaps: read.gaps.length,
          labels: scope?.ids.length ?? 0,
          provider,
          model: reply.model,
        });
        send({
          type: 'done',
          text: read.text,
          sources,
          notUsed,
          gaps: read.gaps,
          model: reply.model,
          provider,
        });
      } catch (error) {
        // The kind and its fixed words; never the upstream's own message, the request or the key.
        const kind = error instanceof ModelCallError ? error.kind : 'other';
        console.warn('[knowledge] ask failed', {
          documentId: document.id,
          provider,
          kind,
        });
        send({ type: 'error', kind, provider, message: modelFailureWords(provider, kind) });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      ...creditsHeader(credits),
    },
  });
}
