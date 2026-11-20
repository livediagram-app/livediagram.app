// The AI Knowledge tab over REST (docs/specs/030-knowledgebase/ai-knowledge.md):
//   GET    /api/documents/<id>/knowledge               agents, questions, conflicts, context pages, health
//   POST   /api/documents/<id>/questions               { question }: an agent's `report_gap`
//   DELETE /api/documents/<id>/questions/<key>         Dismiss (Editor)
//   POST   /api/documents/<id>/conflicts/<id>/dismiss  Not a Conflict (Editor)
// Seeing the tab is every role's; resolving is an Editor's. All of it is the room's own bookkeeping: no model.
import {
  ASK_MAX_QUESTION_CHARS,
  CONTEXT_BUDGET_TOKENS,
  agentReads,
  conflictOfRow,
  countAgentReads,
  dismissConflict,
  dismissQuestion,
  listConflicts,
  listQuestionAgents,
  listQuestions,
  questionGroups,
  questionKey,
  upsertQuestion,
  type AgentReadsRow,
  type ConflictRow,
  type ConflictSide,
  type QuestionAgentRow,
  type QuestionRow,
} from '@liveknowledge/knowledge';
import type {
  KnowledgeConflict,
  KnowledgeConflictSide,
  KnowledgeOverviewResponse,
  KnowledgeTrustState,
} from '@liveknowledge/api-schema';
import { readAiSettings } from '../knowledge/ai-settings';
import { accountOf, readerOf } from '../knowledge/knowledge-caller';
import { rowsOf, runAll, sqlOf } from '../knowledge/knowledge-db';
import { contextPages, knowledgeHealthCounts } from '../knowledge/knowledge-reads';
import { forbidden, json, methodNotAllowed, noContent } from '../responses';
import type { KnowledgeRoute } from './knowledge-routes';
import { pendingSuggestions } from './knowledge-suggestion-routes';

const DAY_MS = 86_400_000;
const invalid = (error: string, message: string) => json({ error, message }, { status: 400 });

type SideRow = {
  id: string;
  tab: string;
  firstBlock: string;
  text: string;
  title: string | null;
  verifiedAt: number | null;
  reviewDays: number | null;
};

const trustOf = (row: SideRow, now: number): KnowledgeTrustState =>
  row.verifiedAt === null
    ? 'never-verified'
    : row.reviewDays !== null && row.verifiedAt + row.reviewDays * DAY_MS <= now
      ? 'review-due'
      : 'verified';

// The open conflicts with each side's passage and page as they stand, read in bounded statements (at most 50
// passage ids a statement, under the 100 bound values a query may take).
async function openConflicts(
  env: KnowledgeRoute['ctx']['env'],
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
                t.verified_at AS verifiedAt, t.review_days AS reviewDays
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
      trust: trustOf(row, now),
      ...(row.verifiedAt === null ? {} : { verifiedAt: row.verifiedAt }),
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
  const titles = new Map(document.tabs.map((t) => [t.id, t.name]));
  const [reads, questions, questionAgents, conflicts, pages, health, ai, suggestions] =
    await Promise.all([
      rowsOf<AgentReadsRow>(env, countAgentReads(now)),
      rowsOf<QuestionRow>(env, listQuestions()),
      rowsOf<QuestionAgentRow>(env, listQuestionAgents()),
      openConflicts(env, now),
      contextPages(env, document.id),
      knowledgeHealthCounts(env, document.id, now),
      readAiSettings(env, grant.role === 'edit'),
      pendingSuggestions(route, now),
    ]);
  const lastAt = new Map(questions.map((q) => [q.key, q.lastAt]));
  const overview: KnowledgeOverviewResponse = {
    agents: agentReads(reads).map((a) => ({
      name: a.agent,
      readsThisWeek: a.readsThisWeek,
      topPages: a.topPages.map((tab) => ({ tab, title: titles.get(tab) ?? '' })),
    })),
    questions: questionGroups(questions, questionAgents).map((q) => ({
      key: q.key,
      question: q.question,
      asked: q.asked,
      byPeople: q.people,
      agents: Object.entries(q.agents).map(([name, asked]) => ({ name, asked })),
      lastAt: lastAt.get(q.key) ?? 0,
    })),
    conflicts,
    // Agents' edits waiting for an Editor (knowledge-suggestion-routes.ts), newest first.
    suggestions,
    context: {
      budget: CONTEXT_BUDGET_TOKENS,
      used: pages.reduce((sum, p) => sum + p.tokens, 0),
      pages,
    },
    health,
    hasKey: ai.hasKey,
  };
  return json(overview);
}

/** Null when the path is none of these routes. */
export async function handleOverviewRoutes(route: KnowledgeRoute): Promise<Response | null> {
  const { ctx, document, grant } = route;
  const { env, request, segments } = ctx;
  const id = segments[4];
  const editor = grant.role === 'edit';
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
    await runAll(env, upsertQuestion(key, question, readerOf(ctx), Date.now()));
    console.info('[knowledge] gap reported', { documentId: document.id });
    return json({ key }, { status: 201 });
  }
  if (segments[3] === 'questions' && segments.length === 5 && id) {
    if (request.method !== 'DELETE') return methodNotAllowed();
    if (!editor) return forbidden();
    await runAll(env, dismissQuestion(decodeURIComponent(id)));
    return noContent();
  }
  if (segments[3] === 'conflicts' && segments.length === 6 && id && segments[5] === 'dismiss') {
    if (request.method !== 'POST') return methodNotAllowed();
    if (!editor) return forbidden();
    await runAll(env, [dismissConflict(id)]);
    return noContent();
  }
  return null;
}
