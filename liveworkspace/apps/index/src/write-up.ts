// Write It Up on the index (liveworkspace/docs/specs/004-index/write-up.md, its blueprint): something from an item (a
// card's decision, an article) written as a page in a knowledgebase, as the person, through the knowledgebase's own
// door, the way a call's summary is.
//
//   GET  /items/:id/write-up    the knowledgebase a write-up from the item goes to, on the person's access   → 200
//   POST /items/:id/write-up    the page, written as the person                                                → 201

import {
  readWriteUpAsk,
  type WriteUpAnswer,
  type WriteUpTarget,
} from '@liveworkspace/index-client';
import { loadItem } from './access';
import type { Person } from './auth';
import { takeTargetedStep } from './automation-steps';
import { isDelegate } from './connections';
import type { RouteContext } from './context';
import { badRequest, forbidden, json, notFound, readObject, unauthorized } from './http';
import { itemLink } from './item-call-reads';
import { defaultKnowledgebase } from './knowledgebase-default';
import { overRunLimit } from './kits';
import { getItemRow } from './rows';

const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

// An account in person, never an app, the Drive mirror or an export acting for them.
function account(ctx: RouteContext): Person | Response {
  const person = ctx.caller.person;
  if (!person) return unauthorized();
  if (isDelegate(person)) return forbidden();
  if (person.kind !== 'account') return forbidden('sign_in_required');
  return person;
}

/** GET: where a write-up from this item goes, `{knowledgebase: null}` when the person can edit none. */
async function readTarget(ctx: RouteContext, itemId: string): Promise<Response> {
  const person = account(ctx);
  if (person instanceof Response) return person;
  const item = await loadItem(ctx.env, itemId, ctx.caller, 'edit');
  if (item instanceof Response) return item;
  if (item.row.app === 'liveknowledge')
    return json({ knowledgebase: null } satisfies WriteUpTarget);
  const knowledgebase = await defaultKnowledgebase(ctx.env, item.row, person, { own: true });
  return json({ knowledgebase } satisfies WriteUpTarget);
}

/** POST: the page, written in the knowledgebase as the person, stamped with the item it came from. */
async function writeUp(ctx: RouteContext, itemId: string): Promise<Response> {
  const { env } = ctx;
  const person = account(ctx);
  if (person instanceof Response) return person;
  const item = await loadItem(env, itemId, ctx.caller, 'edit');
  if (item instanceof Response) return item;
  if (item.row.trashed_at !== null) return notFound();
  const limited = await overRunLimit(env, `write-up:${person.id}`);
  if (limited) return limited;
  const ask = readWriteUpAsk(await readObject(ctx.request));
  if (!ask) return badRequest();
  const kb = await getItemRow(env, ask.knowledgebase);
  if (!kb || kb.app !== 'liveknowledge' || kb.id === itemId) return badRequest();
  const answered = await takeTargetedStep(
    env,
    {
      author: person.id,
      rule: { id: 'write-up', name: 'Write It Up' },
      from: { title: cut(item.row.title || 'Untitled', 200), url: itemLink(env, item.row) },
      chain: {
        id: `wu_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`,
        hops: 0,
        rules: [],
      },
      app: item.row.app,
      sourceId: itemId,
      ruleKey: `${item.row.app}:${itemId}:write-up`,
    },
    {
      kind: 'kb_page',
      target: { app: 'liveknowledge', item: kb.id, title: kb.title },
      title: ask.title,
      body: ask.body,
    },
  );
  if (!answered.ok || !answered.link) {
    console.warn('[index] write-up not written', { code: answered.ok ? 'no_link' : answered.code });
    const reason = answered.ok ? '' : answered.reason;
    const code = answered.ok ? 'failed' : answered.code;
    return json({ error: 'write_up_refused', code, reason }, { status: 422 });
  }
  console.info('[index] write-up written', { app: item.row.app });
  return json({ page: { title: ask.title, link: answered.link } } satisfies WriteUpAnswer, {
    status: 201,
  });
}

export async function handleWriteUp(ctx: RouteContext, itemId: string): Promise<Response> {
  if (ctx.request.method === 'GET') return readTarget(ctx, itemId);
  if (ctx.request.method === 'POST') return writeUp(ctx, itemId);
  return notFound();
}
