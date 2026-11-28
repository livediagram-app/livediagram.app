// An item's editor address opened by someone with no access (liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Opened by its editor address", Work Tracker 1518): an owner often copies the address from the bar instead of the
// share link. The grant's refusal then names the item's least live link, and the editor opens the item through that
// link's own door (`GET /share/:code`), so its sign-in rule, password, level, tab and expiry all hold. With no live
// link the refusal goes out untouched: the address alone still reveals nothing.
import type { Caller } from './auth';
import type { Env } from './env';
import { json } from './http';
import { LIVE_LINK } from './rows';

// The live link that gives least, or null: the lowest level, at one level a one-tab link before a whole-item one, then
// the oldest. A public link (a Community post's) is the Community's viewing surface, never an editor's way in; an item
// in the Trash or Archived opens through no link. One query over `share_links_item`, at most 100 rows an item.
export async function fallbackLinkOf(env: Env, itemId: string): Promise<string | null> {
  const row = await env.INDEX_DB.prepare(
    `SELECT sl.code FROM share_links sl JOIN items i ON i.id = sl.item_id
     WHERE sl.item_id = ? AND sl.public = 0 AND ${LIVE_LINK('sl')}
       AND i.trashed_at IS NULL AND i.archived_at IS NULL
     ORDER BY CASE sl.level WHEN 'view' THEN 0 WHEN 'participate' THEN 1 ELSE 2 END,
       sl.tab_id IS NULL, sl.created_at, sl.code
     LIMIT 1`,
  )
    .bind(itemId, Date.now())
    .first<{ code: string }>();
  return row?.code ?? null;
}

// Whether a refused grant may name a link: a person asking for themselves (or nobody) who sent no code, refused as
// missing (`404`), or as nobody (`401 unauthorized`). A person's `401` is their own link's password or sign-in
// refusal, which stands. An app acting for a person, the Drive mirror and the export never hear of a link.
function mayFallBack(caller: Caller, refused: Response): boolean {
  if (caller.share) return false;
  const person = caller.person;
  if (person && (person.app || person.drive || person.export || person.grantOnly)) return false;
  return refused.status === 404 || (refused.status === 401 && !person);
}

// A grant's refusal, naming the item's least live link when it has one and the caller may hear it. The query runs for
// every such refusal, real item or not, so a made-up id answers in the same time as one with no link.
export async function withFallbackLink(
  env: Env,
  itemId: string,
  caller: Caller,
  refused: Response,
): Promise<Response> {
  if (!mayFallBack(caller, refused)) return refused;
  const link = await fallbackLinkOf(env, itemId);
  if (!link) return refused;
  return json({ error: 'not_found', link }, { status: 404 });
}
