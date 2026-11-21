// Edits suggested by agents over REST (docs/specs/030-knowledgebase/ai-knowledge.md "Edits suggested by agents";
// docs/specs/024-agents/knowledgebase-for-agents.md `suggest_edit`):
//   POST /api/documents/<id>/pages/<tab>/suggestions   { reason, after, before? }: a Participant or an Editor, or
//                                                      an agent of one holding `suggest`
//   GET  /api/documents/<id>/suggestions               every role
//   POST /api/documents/<id>/suggestions/<sid>/accept  Editor: applied through the article write, in their name
//   POST /api/documents/<id>/suggestions/<sid>/dismiss Editor
// A suggestion changes nothing until it is accepted, and accepting never verifies the page.
import { levelAtLeast, type SuggestEditRequest } from '@liveknowledge/api-schema';
import { replacePassage } from '@liveknowledge/knowledge';
import { readStoredTab } from '../changesets/stored-tab';
import { notePageWrite } from '../knowledge/page-authors';
import { acceptedSuggestionWriter } from '../knowledge/page-writer';
import { submitPages } from '../changesets/pages';
import { accountOf, readerOf } from '../knowledge/knowledge-caller';
import { pageFlowOf, pageMarkdownOf } from '../knowledge/page-read';
import {
  SUGGESTIONS_MAX_PENDING,
  SUGGESTION_MAX_CHARS,
  SUGGESTION_MAX_REASON_CHARS,
  addSuggestion,
  countSuggestions,
  listSuggestions,
  mintSuggestionId,
  readSuggestion,
  removeSuggestion,
  suggestionOf,
  type StoredSuggestion,
} from '../knowledge/suggestions';
import { getParticipant } from '../person/profiles';
import { forbidden, json, methodNotAllowed, noContent, notFound } from '../responses';
import type { DocumentDTO } from '../types';
import { authorOf } from './changesets';
import { requireOwner, writesPages } from './context';
import type { KnowledgeRoute } from './knowledge-routes';

const refused = (status: number, error: string, message: string) =>
  json({ error, message }, { status });

const PASSAGE_WORDS = {
  passage_not_found:
    'The page does not hold that passage. Send "before" exactly as the page reads now (read the page again), or leave it out to append.',
  passage_ambiguous:
    'The page holds that passage more than once. Send a longer "before" that sits in one place only.',
} as const;

const titleOf = (document: DocumentDTO, tab: string) =>
  document.tabs.find((t) => t.id === tab)?.name ?? '';

/** The pending suggestions of pages the knowledgebase still holds, newest first. */
export async function pendingSuggestions(route: KnowledgeRoute, now: number) {
  const known = new Set(route.document.tabs.map((t) => t.id));
  return (await listSuggestions(route.ctx.env, now))
    .filter((s) => known.has(s.tab))
    .map((s) => suggestionOf(s, titleOf(route.document, s.tab)));
}

export async function handleSuggest(route: KnowledgeRoute, tab: string): Promise<Response> {
  const { ctx, document, grant } = route;
  // A Viewer, or a Viewer's agent, never suggests; nor does a visitor with no account to answer for it.
  if (!levelAtLeast(grant.role, 'participate') || !accountOf(ctx)) return forbidden();
  const body = (await ctx.request.json().catch(() => null)) as Partial<SuggestEditRequest> | null;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  const after = typeof body?.after === 'string' ? body.after.trim() : '';
  const before = typeof body?.before === 'string' ? body.before.trim() : '';
  if (!reason)
    return refused(400, 'no_reason', 'Send "reason": why the page should change, in a sentence.');
  if (reason.length > SUGGESTION_MAX_REASON_CHARS)
    return refused(
      400,
      'reason_too_long',
      `A reason is at most ${SUGGESTION_MAX_REASON_CHARS} characters.`,
    );
  if (!after)
    return refused(
      400,
      'no_change',
      'Send "after": the Markdown to put in place of "before", or to append when "before" is left out.',
    );
  if (reason.length + before.length + after.length > SUGGESTION_MAX_CHARS)
    return refused(
      400,
      'suggestion_too_long',
      `A suggestion is at most ${SUGGESTION_MAX_CHARS.toLocaleString('en')} characters: suggest a smaller passage, or several suggestions.`,
    );
  const now = Date.now();
  if (before) {
    const stored = await readStoredTab(ctx.env, document.id, tab);
    if (!stored) return notFound();
    const found = replacePassage(pageMarkdownOf(stored.tab, document.tabs), before, after);
    if ('refusal' in found) return refused(400, found.refusal, PASSAGE_WORDS[found.refusal]);
  }
  const reader = readerOf(ctx);
  const agent =
    reader.kind === 'agent'
      ? reader.name
      : ((await getParticipant(ctx.env, accountOf(ctx)!))?.name ?? 'Someone');
  const suggestion: StoredSuggestion = {
    id: mintSuggestionId(),
    tab,
    agent,
    reason,
    kind: before ? 'replace' : 'append',
    before,
    after,
    createdAt: now,
  };
  if (!(await addSuggestion(ctx.env, suggestion)))
    return refused(
      409,
      'suggestions_full',
      `This knowledgebase already has ${SUGGESTIONS_MAX_PENDING} suggestions waiting for an Editor. Try again once some are accepted or dismissed.`,
    );
  console.info('[knowledge] suggested', {
    documentId: document.id,
    tabId: tab,
    suggestionId: suggestion.id,
    kind: suggestion.kind,
    chars: before.length + after.length,
  });
  return json(
    {
      suggestion: suggestionOf(suggestion, titleOf(document, tab)),
      pending: await countSuggestions(ctx.env, now),
    },
    { status: 201 },
  );
}

async function handleAccept(route: KnowledgeRoute, id: string): Promise<Response> {
  const { ctx, document } = route;
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const suggestion = await readSuggestion(ctx.env, id, Date.now());
  if (!suggestion) return notFound();
  const stale = (message: string) => {
    console.info('[knowledge] suggestion stale', { documentId: document.id, suggestionId: id });
    return refused(409, 'suggestion_stale', message);
  };
  const stored = await readStoredTab(ctx.env, document.id, suggestion.tab);
  if (!stored) return stale('The page this suggestion was for is gone. Dismiss it.');
  const flow = pageFlowOf(stored.tab);
  let article: { article?: string; markdown: string; mode: 'replace' | 'append' };
  if (suggestion.kind === 'append') {
    article = { ...(flow ? { article: flow } : {}), markdown: suggestion.after, mode: 'append' };
  } else {
    const next = replacePassage(
      pageMarkdownOf(stored.tab, document.tabs),
      suggestion.before,
      suggestion.after,
    );
    if ('refusal' in next)
      return stale(
        'The passage this suggestion replaces has changed since it was made. Open the page to make the change by hand, or dismiss the suggestion.',
      );
    article = { ...(flow ? { article: flow } : {}), markdown: next.markdown, mode: 'replace' };
  }
  // One change in the acceptor's name, through the write every article write takes (changesets/pages.ts): it
  // touches the writing alone, so the page's verified state is as it was.
  const result = await submitPages({
    env: ctx.env,
    document,
    tabId: suggestion.tab,
    request: { article },
    author: await authorOf(ctx, owner),
    tokenId: ctx.token?.id ?? null,
  });
  if (result.status !== 200 || !('tab' in result.body))
    return json(result.body, { status: result.status });
  // The words are the agent's, the acceptance the Editor's (verification.md "Made by a person or an agent").
  await notePageWrite(ctx.env, suggestion.tab, acceptedSuggestionWriter(owner, suggestion.agent));
  await removeSuggestion(ctx.env, id);
  console.info('[knowledge] suggestion accepted', {
    documentId: document.id,
    tabId: suggestion.tab,
    suggestionId: id,
    rev: result.body.tab.rev,
  });
  return json({ tab: result.body.tab });
}

/** Null when the path is none of the whole-knowledgebase suggestion routes. */
export async function handleSuggestionRoutes(route: KnowledgeRoute): Promise<Response | null> {
  const { ctx, grant } = route;
  const { segments, request } = ctx;
  if (segments[3] !== 'suggestions') return null;
  if (segments.length === 4) {
    if (request.method !== 'GET') return methodNotAllowed();
    return json({ suggestions: await pendingSuggestions(route, Date.now()) });
  }
  const id = segments[4];
  if (segments.length !== 6 || !id) return null;
  if (segments[5] !== 'accept' && segments[5] !== 'dismiss') return null;
  if (request.method !== 'POST') return methodNotAllowed();
  if (!writesPages(grant)) return forbidden();
  if (segments[5] === 'accept') return handleAccept(route, id);
  await removeSuggestion(ctx.env, id);
  console.info('[knowledge] suggestion dismissed', {
    documentId: route.document.id,
    suggestionId: id,
  });
  return noContent();
}
