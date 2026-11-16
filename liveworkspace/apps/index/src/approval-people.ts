// Who may be named as an approver (liveworkspace/docs/specs/004-index/approvals.md "Who may be named"): an account who
// reaches the whole item now, at any level: its owner (a personal item), a joined member of its team (as accounts says
// now), or someone in its Shared with me through a live link that opens every tab. Checked on the server for every
// request; the editor's list of candidates is presentation.

import { APPROVAL_PEOPLE_MAX, type ApprovalCandidate } from '@liveworkspace/index-client';
import { accountsPeopleNames, accountsPersonTeams } from './accounts-access';
import type { Env } from './env';
import { LIVE_LINK, type ItemRow } from './rows';

export const isAccountId = (id: string) => id.startsWith('user_');

// The people among `ids` who reach the item through a live whole-item link they opened (Shared with me).
async function viaLink(env: Env, itemId: string, ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { results } = await env.INDEX_DB.prepare(
    `SELECT sw.person_id FROM shared_with sw
     JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
     WHERE sw.item_id = ? AND sw.person_id IN (SELECT value FROM json_each(?))
       AND sl.tab_id IS NULL AND sl.public = 0 AND ${LIVE_LINK('sl')}`,
  )
    .bind(itemId, JSON.stringify(ids), Date.now())
    .all<{ person_id: string }>();
  return new Set(results.map((r) => r.person_id));
}

/** Whether every id reaches the whole item now: `ok`, the first who doesn't (`cannot`), or accounts couldn't say. */
export async function checkNameable(
  env: Env,
  row: ItemRow,
  ids: readonly string[],
): Promise<'ok' | 'cannot' | 'unavailable'> {
  const owner = row.team_id === null ? row.owner_id : null;
  const rest = ids.filter((id) => id !== owner);
  const linked = await viaLink(env, row.id, rest);
  const left = rest.filter((id) => !linked.has(id));
  if (left.length === 0) return 'ok';
  if (row.team_id === null) return 'cannot';
  // A team item: the rest must be in its team as accounts says now, each asked at once.
  const teamsOf = accountsPersonTeams(env);
  const teams = await Promise.all(left.map((id) => teamsOf(id)));
  if (teams.some((t) => t === null)) return 'unavailable';
  return teams.every((t) => t!.has(row.team_id!)) ? 'ok' : 'cannot';
}

/** Whom an Editor may name beside the team's members: the owner of a personal item, then the accounts who came in
 *  through a live whole-item link, newest visitor first; never `self`. */
export async function approvalCandidates(
  env: Env,
  row: ItemRow,
  self: string,
): Promise<ApprovalCandidate[]> {
  const { results } = await env.INDEX_DB.prepare(
    `SELECT sw.person_id FROM shared_with sw
     JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
     WHERE sw.item_id = ? AND sl.tab_id IS NULL AND sl.public = 0 AND ${LIVE_LINK('sl')}
       AND sw.person_id LIKE 'user\\_%' ESCAPE '\\'
     ORDER BY sw.last_seen DESC LIMIT ?`,
  )
    .bind(row.id, Date.now(), APPROVAL_PEOPLE_MAX)
    .all<{ person_id: string }>();
  const people: { id: string; via: 'owner' | 'link' }[] = [];
  if (row.team_id === null && row.owner_id !== self && isAccountId(row.owner_id)) {
    people.push({ id: row.owner_id, via: 'owner' });
  }
  for (const r of results) {
    if (r.person_id !== self && r.person_id !== row.owner_id) {
      people.push({ id: r.person_id, via: 'link' });
    }
  }
  const capped = people.slice(0, APPROVAL_PEOPLE_MAX);
  const names = capped.length > 0 ? await accountsPeopleNames(env)(capped.map((p) => p.id)) : null;
  return capped.map((p) => ({ ...p, name: names?.get(p.id) ?? null }));
}
