// A page's reactions (docs/specs/030-knowledgebase/page-reactions.md):
//   GET  /api/documents/<id>/pages/<tab>/reactions   every reaction on the page, oldest first
//   POST /api/documents/<id>/pages/<tab>/reactions   { emoji, on }: add or take back the caller's own
// Reading is every role's. A change is any signed-in person's who reads the page, a Viewer included: the one write a
// Viewer makes on a page, and it reaches this table alone. A guest with no account and an agent's token are refused.
// Reacting tells nobody: no email, inbox, outbox, automation or History; only the people on the page hear it, as one
// `page-reaction` op.
import {
  isReactionEmoji,
  PAGE_REACTIONS_PER_MINUTE,
  type PageReactionChange,
  type PageReactionOp,
} from '@liveknowledge/api-schema';
import { collabKeyFor } from '@liveworkspace/api-kit/collab-key';
import { pageCreatorOf, readerOf } from '../knowledge/knowledge-caller';
import {
  readPageReactions,
  togglePageReaction,
  type ReactionRefusal,
} from '../knowledge/page-reactions';
import { getParticipant } from '../person/profiles';
import { json, methodNotAllowed } from '../responses';
import { relayPages } from '../room-client';
import type { DocumentDTO } from '../types';
import type { DocumentRouteContext } from './context';

type Refusal =
  | ReactionRefusal
  | 'invalid_change'
  | 'invalid_emoji'
  | 'reaction_needs_account'
  | 'reacting_too_fast';

const REFUSALS: Record<Refusal, { status: number; message: string }> = {
  invalid_change: { status: 400, message: 'Send one change: { "emoji", "on": true | false }.' },
  invalid_emoji: { status: 400, message: 'A reaction is one emoji.' },
  reaction_needs_account: {
    status: 403,
    message: 'Sign in to react to a page. Guests and agents do not react.',
  },
  reactions_full: { status: 409, message: 'This page holds as many reactions as it can.' },
  too_many_reactions: {
    status: 409,
    message: 'You have put as many different reactions on this page as it takes.',
  },
  reacting_too_fast: { status: 429, message: 'Too many reactions in a minute. Try again shortly.' },
};

const refused = (code: Refusal) =>
  json({ error: code, message: REFUSALS[code].message }, { status: REFUSALS[code].status });

/** The body as a change, or null when it is none. The emoji is checked on its own. */
export function parseReactionChange(body: unknown): PageReactionChange | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.emoji !== 'string' || typeof b.on !== 'boolean') return null;
  return { emoji: b.emoji, on: b.on };
}

// The most people the rate limit remembers in one room; the oldest goes first past it.
const RATE_PEOPLE_MAX = 1000;
const MINUTE_MS = 60_000;

/** A sliding minute a person (the room's memory): whether one more change is allowed now, noting it when it is. A
 *  courtesy limit against a held-down key, forgotten when the room restarts. */
export function createReactionRate(limit = PAGE_REACTIONS_PER_MINUTE, max = RATE_PEOPLE_MAX) {
  const recent = new Map<string, number[]>();
  return {
    take(key: string, now: number): boolean {
      const kept = (recent.get(key) ?? []).filter((at) => now - at < MINUTE_MS);
      if (kept.length >= limit) {
        recent.set(key, kept);
        return false;
      }
      kept.push(now);
      // Re-inserted, so the map's order is the order people last reacted in.
      recent.delete(key);
      recent.set(key, kept);
      if (recent.size > max) recent.delete(recent.keys().next().value as string);
      return true;
    },
    size: () => recent.size,
  };
}

const rate = createReactionRate();

export async function handlePageReactions(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  tab: string,
): Promise<Response> {
  const method = ctx.request.method;
  if (method === 'GET') return json({ reactions: await readPageReactions(ctx.env, tab) });
  if (method !== 'POST') return methodNotAllowed();
  // A person with an account, never a guest, a link visitor without one, or an agent.
  const person = pageCreatorOf(ctx);
  if (!person || readerOf(ctx).kind !== 'person') return refused('reaction_needs_account');
  const change = parseReactionChange(await ctx.request.json().catch(() => null));
  if (!change) return refused('invalid_change');
  if (!isReactionEmoji(change.emoji)) return refused('invalid_emoji');
  const now = Date.now();
  if (!rate.take(`${document.id}\u0000${person}`, now)) return refused('reacting_too_fast');
  const profile = await getParticipant(ctx.env, person);
  const outcome = await togglePageReaction(
    ctx.env,
    tab,
    change,
    { person, by: await collabKeyFor(person), name: profile?.name || 'Someone' },
    now,
  );
  if ('refusal' in outcome) return refused(outcome.refusal);
  if (outcome.changed) {
    const op: PageReactionOp = {
      kind: 'page-reaction',
      tabId: tab,
      reaction: outcome.reaction,
      on: change.on,
    };
    console.info('[page-reactions] change', { documentId: document.id, tabId: tab, on: change.on });
    // Awaited, as a thread's op is: the reactor's own client hears it before the answer, and nobody misses it.
    await relayPages(ctx.env, document.id, [op], '[page-reactions]');
  }
  return json({ reaction: outcome.reaction, on: change.on, changed: outcome.changed });
}
