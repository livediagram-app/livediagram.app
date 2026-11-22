// A page's watch (docs/specs/030-knowledgebase/watching.md):
//   GET /api/documents/<id>/pages/<tab>/watch   the caller's own watch of the page, and how many watch it
//   PUT /api/documents/<id>/pages/<tab>/watch   { scope: 'page' | 'section' | null }: the caller's own watch
// Reading is every role's. A change is any signed-in person's who reads the page, a Viewer included: like a reaction,
// it reaches this table alone. A guest with no account and an agent's token are refused: there is nobody to tell.
// Watching tells nobody and is no edit; the watch's own work (the Inbox push, the daily check) is the room's alarm's.
import {
  isPageWatchScope,
  WATCH_CHANGES_PER_MINUTE,
  type PageWatchChange,
  type PageWatchResponse,
} from '@liveknowledge/api-schema';
import { pageParents } from '@liveknowledge/document';
import { pageCreatorOf, readerOf } from '../knowledge/knowledge-caller';
import { setPageWatch, watcherCount, watchesOf, watchOf } from '../knowledge/page-watch';
import { WATCH_PUSH_DELAY_MS } from '../knowledge/watch-notes';
import { DAY_MS } from '../knowledge/watch-work';
import { json, methodNotAllowed } from '../responses';
import type { DocumentDTO } from '../types';
import type { DocumentAccess, DocumentRouteContext } from './context';
import { createReactionRate } from './knowledge-reaction-routes';

type Refusal =
  | 'invalid_change'
  | 'not_a_section'
  | 'section_out_of_reach'
  | 'watch_needs_account'
  | 'watchers_full'
  | 'watching_too_fast';

const REFUSALS: Record<Refusal, { status: number; message: string }> = {
  invalid_change: {
    status: 400,
    message: 'Send one change: { "scope": "page" | "section" | null }.',
  },
  not_a_section: { status: 400, message: 'This page has no subpages to watch as a section.' },
  section_out_of_reach: {
    status: 403,
    message: 'This link opens one page, so its section cannot be watched through it.',
  },
  watch_needs_account: {
    status: 403,
    message: 'Sign in to watch a page. Guests and agents do not watch.',
  },
  watchers_full: { status: 409, message: 'This knowledgebase holds as many watches as it can.' },
  watching_too_fast: {
    status: 429,
    message: 'Too many watch changes in a minute. Try again shortly.',
  },
};

const refused = (code: Refusal) =>
  json({ error: code, message: REFUSALS[code].message }, { status: REFUSALS[code].status });

/** The body as a change, or null when it is none. */
export function parseWatchChange(body: unknown): PageWatchChange | null {
  if (!body || typeof body !== 'object' || !Object.hasOwn(body, 'scope')) return null;
  const scope = (body as { scope: unknown }).scope;
  return scope === null || isPageWatchScope(scope) ? { scope } : null;
}

const rate = createReactionRate(WATCH_CHANGES_PER_MINUTE);

/** A person with an account (a signed-in reader, a workbench session's person); null for a guest, a link visitor
 *  without one, or an agent. */
const watcherOf = (ctx: DocumentRouteContext): string | null => {
  const person = pageCreatorOf(ctx);
  return person && readerOf(ctx).kind === 'person' ? person : null;
};

async function answerOf(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  tab: string,
  person: string | null,
): Promise<PageWatchResponse> {
  const parents = pageParents(document.tabs);
  const section = document.tabs.some((t) => parents.get(t.id) === tab);
  const nameOf = (id: string) => document.tabs.find((t) => t.id === id)?.name ?? '';
  const [own, watchers] = await Promise.all([
    person ? watchesOf(ctx.env, person) : Promise.resolve([]),
    watcherCount(ctx.env, parents, tab),
  ]);
  return { ...watchOf(own, parents, tab, nameOf), watchers, section };
}

export async function handlePageWatch(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  grant: DocumentAccess,
  tab: string,
): Promise<Response> {
  const method = ctx.request.method;
  const person = watcherOf(ctx);
  // A link confined to one page reads its own page alone: no section above it, nor its count, is its to see.
  const seen =
    grant.tabScope === null
      ? document
      : { ...document, tabs: document.tabs.filter((t) => t.id === tab) };
  if (method === 'GET') return json(await answerOf(ctx, seen, tab, person));
  if (method !== 'PUT') return methodNotAllowed();
  if (!person) return refused('watch_needs_account');
  const change = parseWatchChange(await ctx.request.json().catch(() => null));
  if (!change) return refused('invalid_change');
  if (change.scope === 'section') {
    if (grant.tabScope !== null) return refused('section_out_of_reach');
    const parents = pageParents(document.tabs);
    if (!document.tabs.some((t) => parents.get(t.id) === tab)) return refused('not_a_section');
  }
  const now = Date.now();
  if (!rate.take(`${document.id}\u0000${person}`, now)) return refused('watching_too_fast');
  const outcome = await setPageWatch(ctx.env, tab, person, change.scope, now);
  if ('refusal' in outcome) return refused(outcome.refusal);
  if (outcome.changed) {
    console.info('[watch] change', { documentId: document.id, tabId: tab, scope: change.scope });
    // Who each update is for moved: the push again, and the daily check owed while there is a watch.
    ctx.env.WATCH_OWED?.('inbox', now + WATCH_PUSH_DELAY_MS);
    if (change.scope !== null) ctx.env.WATCH_OWED?.('daily', now + DAY_MS);
  }
  return json(await answerOf(ctx, seen, tab, person));
}
