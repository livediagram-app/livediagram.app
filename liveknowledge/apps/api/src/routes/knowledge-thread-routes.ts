// A page's comment threads (docs/specs/030-knowledgebase/page-comments.md):
//   GET  /api/documents/<id>/pages/<tab>/threads   every thread on the page, oldest first
//   POST /api/documents/<id>/pages/<tab>/threads   one change: start, reply, resolve, reopen, edit, delete
// Reading is every role's; a change is a Participant's, as commenting is everywhere on the platform (an Editor, a
// Participant, an edit link's visitor, an agent that may suggest or write). Edit and delete are the author's own.
// Every change is told to the room as one `page-thread` op with the thread whole, so everyone on the page sees it.
import { guestName } from '@liveknowledge/knowledge';
import { collabKeyFor } from '@liveworkspace/api-kit/collab-key';
import type { PageThreadChange, PageThreadOp } from '@liveknowledge/api-schema';
import {
  applyThreadChange,
  publicThread,
  type ThreadAuthor,
  type ThreadRefusal,
} from '../knowledge/page-thread-changes';
import {
  deletePageThread,
  hasRoomForThread,
  readPageThread,
  readPageThreads,
  writePageThread,
} from '../knowledge/page-threads';
import { getParticipant } from '../person/profiles';
import { conflict, forbidden, json, methodNotAllowed } from '../responses';
import { relayPages } from '../room-client';
import type { DocumentDTO } from '../types';
import { requireOwner, type DocumentAccess, type DocumentRouteContext } from './context';

const REFUSALS: Record<ThreadRefusal | 'invalid_change', { status: number; message: string }> = {
  invalid_change: {
    status: 400,
    message:
      'Send one change: { "op": "start", "text" } | { "op": "reply", "thread", "text" } | { "op": "resolve" | "reopen", "thread" } | { "op": "edit", "thread", "comment", "text" } | { "op": "delete", "thread", "comment" }.',
  },
  missing_text: { status: 400, message: 'A comment needs some words.' },
  text_too_long: { status: 400, message: 'A comment is 2,000 characters at most.' },
  thread_not_found: { status: 404, message: 'There is no such thread on this page.' },
  comment_not_found: { status: 404, message: 'There is no such comment in this thread.' },
  not_your_comment: {
    status: 403,
    message: 'Only the person (or agent) who wrote a comment edits or deletes it.',
  },
  thread_full: { status: 409, message: 'This page or thread holds as many comments as it can.' },
};

const refused = (code: keyof typeof REFUSALS) =>
  json({ error: code, message: REFUSALS[code].message }, { status: REFUSALS[code].status });

const isText = (v: unknown): v is string => typeof v === 'string';

/** The body as a change, or null when it is none. */
export function parseThreadChange(body: unknown): PageThreadChange | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const name = isText(b.name) ? { name: b.name } : {};
  switch (b.op) {
    case 'start':
      return isText(b.text) ? { op: 'start', text: b.text, ...name } : null;
    case 'reply':
      return isText(b.thread) && isText(b.text)
        ? { op: 'reply', thread: b.thread, text: b.text, ...name }
        : null;
    case 'resolve':
    case 'reopen':
      return isText(b.thread) ? { op: b.op, thread: b.thread } : null;
    case 'edit':
      return isText(b.thread) && isText(b.comment) && isText(b.text)
        ? { op: 'edit', thread: b.thread, comment: b.comment, text: b.text }
        : null;
    case 'delete':
      return isText(b.thread) && isText(b.comment)
        ? { op: 'delete', thread: b.thread, comment: b.comment }
        : null;
    default:
      return null;
  }
}

/** Whether the grant comments: a Participant's or an Editor's (a token that may suggest acts as a Participant). */
export const commentsOnPages = (grant: Pick<DocumentAccess, 'role'>): boolean =>
  grant.role === 'edit' || grant.role === 'participate';

// The longest display name a comment takes from a guest (a presence name's bound, as comment-routes.ts).
const NAME_MAX = 80;

async function authorOf(
  ctx: DocumentRouteContext,
  owner: string,
  sent: string | undefined,
): Promise<ThreadAuthor> {
  const person = await getParticipant(ctx.env, owner);
  // A guest has no profile: the name on their cursor. An agent's is its person's, never one it sends.
  const typed = !ctx.token && sent ? sent.trim().slice(0, NAME_MAX) : '';
  return {
    id: owner,
    key: await collabKeyFor(owner),
    // A guest's says so after it: "Bright Marlin (Guest)" (owner 2026-11-21).
    name: person?.name || (ctx.token ? 'Anonymous' : guestName(typed)),
    color: person?.color ?? '#94a3b8',
    ...(ctx.token ? { tokenId: ctx.token.id } : {}),
  };
}

export async function handlePageThreads(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  grant: DocumentAccess,
  tab: string,
): Promise<Response> {
  const method = ctx.request.method;
  if (method === 'GET')
    return json({ threads: (await readPageThreads(ctx.env, tab)).map(publicThread) });
  if (method !== 'POST') return methodNotAllowed();
  if (!commentsOnPages(grant)) return forbidden();
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const change = parseThreadChange(await ctx.request.json().catch(() => null));
  if (!change) return refused('invalid_change');
  const author = await authorOf(ctx, owner, 'name' in change ? change.name : undefined);
  if (change.op === 'start' && !(await hasRoomForThread(ctx.env, tab)))
    return refused('thread_full');
  // A lost race (someone else changed the thread between the read and the write) reads again, once.
  for (let attempt = 0; attempt < 2; attempt++) {
    const stored = change.op === 'start' ? null : await readPageThread(ctx.env, tab, change.thread);
    const outcome = applyThreadChange(tab, stored, change, author, Date.now(), () =>
      crypto.randomUUID(),
    );
    if ('refusal' in outcome) return refused(outcome.refusal);
    let op: PageThreadOp;
    if ('removed' in outcome) {
      if (!stored || !(await deletePageThread(ctx.env, stored))) continue;
      op = { kind: 'page-thread', tabId: tab, threadId: outcome.removed, removed: true };
    } else {
      const thread = publicThread(outcome.thread);
      if (!outcome.changed) return json({ thread });
      if (!(await writePageThread(ctx.env, outcome.thread))) continue;
      op = { kind: 'page-thread', tabId: tab, thread };
    }
    console.info('[page-threads] change', {
      documentId: document.id,
      tabId: tab,
      op: change.op,
      agent: ctx.token !== null && ctx.token !== undefined,
    });
    // Awaited, as Verify's patch is: the writer's own client hears the op before the answer, and nobody misses it.
    await relayPages(ctx.env, document.id, [op], '[page-threads]');
    return json('removed' in op ? { removed: op.threadId } : { thread: op.thread }, {
      status: change.op === 'start' ? 201 : 200,
    });
  }
  return conflict('thread_busy');
}
