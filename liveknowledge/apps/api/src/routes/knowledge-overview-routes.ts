// The AI Knowledge tab over REST (docs/specs/030-knowledgebase/ai-knowledge.md):
//   GET    /api/documents/<id>/knowledge               agents, questions, conflicts, context pages, health
//   POST   /api/documents/<id>/questions               { question }: an agent's `report_gap`
//   DELETE /api/documents/<id>/questions/<key>         Dismiss (Editor)
//   POST   /api/documents/<id>/conflicts/<id>/dismiss  Not a Conflict (Editor)
//   (Ask Both Owners and Remind the Owners are knowledge-email-routes.ts.)
// Seeing the tab is every role's; resolving is an Editor's. All of it is the room's own bookkeeping: no model.
import { newQuestions, queueNewQuestions } from '../document-room/automations/question-events';
import {
  ASK_MAX_QUESTION_CHARS,
  CONTEXT_BUDGET_TOKENS,
  MOST_READ_PAGES,
  agentReads,
  averageHealth,
  conflictOfRow,
  countAgentReads,
  countDailyReads,
  countMostRead,
  dailyReads,
  dismissConflict,
  dismissQuestion,
  listConflicts,
  listQuestionAgents,
  listQuestions,
  lowHealthPages,
  questionGroups,
  questionKey,
  notReadPages,
  shownTrust,
  trustState,
  upsertQuestion,
  type AgentReadsRow,
  type ConflictRow,
  type ConflictSide,
  type DailyReadsRow,
  type MostReadRow,
  type QuestionAgentRow,
  type QuestionRow,
  type ReviewEvery,
} from '@liveknowledge/knowledge';
import type {
  KnowledgeConflict,
  KnowledgeConflictSide,
  KnowledgeOverviewResponse,
  KnowledgeTrustShown,
} from '@liveknowledge/api-schema';
import { seenAgents } from '../knowledge/agent-seen';
import { readAiSettings } from '../knowledge/ai-settings';
import { connectedAgents } from '../knowledge/connected-agents';
import { marksOf } from '../knowledge/email-marks';
import { emailEnabled } from '../email/client';
import { accountOf, readerOf } from '../knowledge/knowledge-caller';
import { rowsOf, runAll, sqlOf } from '../knowledge/knowledge-db';
import { contextPages, knowledgeHealthCounts } from '../knowledge/knowledge-reads';
import { pageHealthScores } from '../knowledge/page-health-read';
import { readingOverview } from '../knowledge/reading-overview';
import { forbidden, json, methodNotAllowed, noContent } from '../responses';
import type { KnowledgeRoute } from './knowledge-routes';
import { writesPages } from './context';
import { pendingSuggestions } from './knowledge-suggestion-routes';

const invalid = (error: string, message: string) => json({ error, message }, { status: 400 });

type SideRow = {
  id: string;
  tab: string;
  firstBlock: string;
  text: string;
  title: string | null;
  verifiedAt: number | null;
};

// Verification off (a Review Period of Never): a side says `off`, with no date (verification.md).
const trustOf = (row: SideRow, every: ReviewEvery, now: number): KnowledgeTrustShown =>
  shownTrust(
    trustState(row.verifiedAt === null ? {} : { verifiedAt: row.verifiedAt }, every, now).state,
    every,
  );

// The open conflicts with each side's passage and page as they stand, read in bounded statements (at most 50
// passage ids a statement, under the 100 bound values a query may take).
export async function openConflicts(
  env: KnowledgeRoute['ctx']['env'],
  every: ReviewEvery,
  now: number,
): Promise<KnowledgeConflict[]> {
  const rows = await rowsOf<ConflictRow>(env, listConflicts());
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.flatMap((r) => [r.aPassage, r.bPassage]))];
  const sides = new Map<string, SideRow>();
  for (let at = 0; at < ids.length; at += 50) {
    const chunk = ids.slice(at, at + 50);
    const found = await rowsOf<SideRow>(
      env,
      sqlOf(
        `SELECT p.id AS id, p.tab AS tab, p.first_block AS firstBlock, p.text AS text, t.title AS title,
                t.verified_at AS verifiedAt
           FROM passages p LEFT JOIN page_trust t ON t.tab = p.tab
          WHERE p.id IN (${chunk.map(() => '?').join(', ')})`,
        ...chunk,
      ),
    );
    for (const row of found) sides.set(row.id, row);
  }
  const sideOf = (side: ConflictSide): KnowledgeConflictSide | null => {
    const row = sides.get(side.passage);
    if (!row) return null;
    return {
      passageId: row.id,
      tab: row.tab,
      firstBlock: row.firstBlock,
      title: row.title ?? '',
      text: row.text,
      trust: trustOf(row, every, now),
      ...(row.verifiedAt === null || every === 'never' ? {} : { verifiedAt: row.verifiedAt }),
    };
  };
  return rows.flatMap((row) => {
    const conflict = conflictOfRow(row);
    const a = sideOf(conflict.a);
    const b = sideOf(conflict.b);
    return a && b
      ? [{ id: conflict.id, question: conflict.question, a, b, foundAt: row.foundAt }]
      : [];
  });
}

async function handleOverview(route: KnowledgeRoute): Promise<Response> {
  const { ctx, document, grant } = route;
  const { env } = ctx;
  const now = Date.now();
  const every = document.knowledgeSettings.reviewEvery;
  const titles = new Map(document.tabs.map((t) => [t.id, t.name]));
  const [
    reads,
    seen,
    questions,
    questionAgents,
    conflicts,
    pages,
    health,
    ai,
    suggestions,
    asked,
    reminded,
    daily,
    mostRead,
    scores,
    requiredReading,
  ] = await Promise.all([
    rowsOf<AgentReadsRow>(env, countAgentReads(now)),
    seenAgents(env, now),
    rowsOf<QuestionRow>(env, listQuestions()),
    rowsOf<QuestionAgentRow>(env, listQuestionAgents()),
    openConflicts(env, every, now),
    contextPages(env, document.id),
    knowledgeHealthCounts(env, document.id, every, now),
    readAiSettings(env, grant.role === 'edit'),
    pendingSuggestions(route, now),
    // What the review emails remember (knowledge/email-marks.ts): a row a conflict asked about, one for the week.
    marksOf(env, 'ask'),
    marksOf(env, 'remind'),
    // The figures band's sparkline and Most Read (ai-knowledge.md "Reads"): two ranges of page_reads.
    rowsOf<DailyReadsRow>(env, countDailyReads(now)),
    rowsOf<MostReadRow>(env, countMostRead(now)),
    // Every page's Health Score (verification.md "Health Score"): one statement, no read a page.
    pageHealthScores(env, document.id, every, now),
    // Required Reading's counts (required-reading.md): two reads, the team at most once.
    readingOverview(env, document, now),
  ]);
  const scored = [...scores.values()];
  const scoreOf = (tab: string) => {
    const page = scores.get(tab);
    return page ? { score: page.health.score, label: page.health.label } : undefined;
  };
  const withHealth = (side: KnowledgeConflictSide): KnowledgeConflictSide => {
    const health = scoreOf(side.tab);
    return health ? { ...side, health } : side;
  };
  const average = averageHealth(scored.map((p) => p.health.score));
  const lastAt = new Map(questions.map((q) => [q.key, q.lastAt]));
  const overview: KnowledgeOverviewResponse = {
    agents: connectedAgents({
      seen,
      reads: agentReads(reads),
      titleOf: (tab) => titles.get(tab) ?? '',
      // The scopes route is an Editor's, in person (knowledge-agent-routes.ts handleScopes).
      canGrant: grant.role === 'edit' && !ctx.token && !ctx.workbench,
    }),
    questions: questionGroups(questions, questionAgents).map((q) => ({
      key: q.key,
      question: q.question,
      asked: q.asked,
      byPeople: q.people,
      agents: Object.entries(q.agents).map(([name, asked]) => ({ name, asked })),
      lastAt: lastAt.get(q.key) ?? 0,
    })),
    conflicts: conflicts.map((conflict) => {
      const askedAt = asked.get(conflict.id);
      const sided = { ...conflict, a: withHealth(conflict.a), b: withHealth(conflict.b) };
      return askedAt === undefined ? sided : { ...sided, askedAt };
    }),
    // Agents' edits waiting for an Editor (knowledge-suggestion-routes.ts), newest first.
    suggestions,
    context: {
      budget: CONTEXT_BUDGET_TOKENS,
      used: pages.reduce((sum, p) => sum + p.tokens, 0),
      pages,
    },
    health: average === undefined ? health : { ...health, average },
    // Pages With Low Health (ai-knowledge.md "Knowledge Health"): the 5 lowest under the Healthy line.
    lowHealth: lowHealthPages(
      scored.map(({ row, health: page }) => ({
        tab: row.tab,
        title: row.title,
        score: page.score,
        reads: row.reads,
        order: row.order,
        label: page.label,
        reason: page.reason,
      })),
    ).map(({ tab, title, score, label, reason }) => ({ tab, title, score, label, reason })),
    // Not Read in 90 Days (ai-knowledge.md): from the same facts rows, each with its last read day.
    notRead: notReadPages(
      scored.map(({ row }) => ({
        tab: row.tab,
        title: row.title,
        lastRead: row.lastRead,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        order: row.order,
      })),
      now,
    ),
    requiredReading,
    reviewEvery: every,
    hasKey: ai.hasKey,
    hasAi: ai.hasKey || ai.builtIn,
    reviewEmails: {
      available: emailEnabled(env),
      ...(reminded.has('owners') ? { remindedAt: reminded.get('owners') } : {}),
    },
    reads: {
      days: dailyReads(daily, now),
      // A page no longer in the knowledgebase is left out.
      mostRead: mostRead
        .flatMap((row) => {
          const title = titles.get(row.tab);
          return title === undefined
            ? []
            : [{ tab: row.tab, title, people: row.people, agents: row.agents }];
        })
        .slice(0, MOST_READ_PAGES),
    },
  };
  return json(overview);
}

/** Null when the path is none of these routes. */
export async function handleOverviewRoutes(route: KnowledgeRoute): Promise<Response | null> {
  const { ctx, document, grant } = route;
  const { env, request, segments } = ctx;
  const id = segments[4];
  // Dismissing a question or a conflict is a page writer's: an Editor's or a Participant's (ai-knowledge.md "Share
  // roles").
  const writer = writesPages(grant);
  if (segments[3] === 'knowledge' && segments.length === 4)
    return request.method === 'GET' ? handleOverview(route) : methodNotAllowed();
  if (segments[3] === 'questions' && segments.length === 4) {
    if (request.method !== 'POST') return methodNotAllowed();
    // A gap is reported for an account (an agent acts for a person or a token), never by a passing visitor.
    if (!accountOf(ctx)) return forbidden();
    const body = (await request.json().catch(() => null)) as { question?: unknown } | null;
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    const key = questionKey(question);
    if (!key) return invalid('no_question', 'Send the question nobody could answer.');
    if (question.length > ASK_MAX_QUESTION_CHARS)
      return invalid(
        'question_too_long',
        `A question is at most ${ASK_MAX_QUESTION_CHARS.toLocaleString('en')} characters.`,
      );
    const fresh = await newQuestions(ctx, [{ key, question }]);
    await runAll(env, upsertQuestion(key, question, readerOf(ctx), Date.now()));
    await queueNewQuestions(ctx, fresh);
    console.info('[knowledge] gap reported', { documentId: document.id });
    return json({ key }, { status: 201 });
  }
  if (segments[3] === 'questions' && segments.length === 5 && id) {
    if (request.method !== 'DELETE') return methodNotAllowed();
    if (!writer) return forbidden();
    await runAll(env, dismissQuestion(decodeURIComponent(id)));
    return noContent();
  }
  if (segments[3] === 'conflicts' && segments.length === 6 && id && segments[5] === 'dismiss') {
    if (request.method !== 'POST') return methodNotAllowed();
    if (!writer) return forbidden();
    await runAll(env, [dismissConflict(id)]);
    return noContent();
  }
  return null;
}
