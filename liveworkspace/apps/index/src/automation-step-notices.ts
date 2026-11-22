// Notify, a step in another app's own (liveworkspace/docs/specs/018-automations/automations.md "Steps in other
// apps"; blueprint cross-app.md "The index"): a notice in chosen people's Inbox, in every app. Each person must reach
// the item whose rule sent it (at view, as the access rule reads them), at most 10 a step; one row a person, made from
// the step's key so a retried run writes nothing new. `GET /inbox` answers a person's newest 50 of the last 30 days as
// `notices` (inbox.ts).

import { sha256Hex } from '@liveworkspace/api-schema/sha256';
import {
  CROSS_APP_NOTICE_PEOPLE_MAX,
  type App,
  type AutomationStepAnswer,
} from '@liveworkspace/index-client';
import { loadItem } from './access';
import { isId } from './codec';
import type { Env } from './env';

export const AUTOMATION_NOTICES_READ_MAX = 50;
export const AUTOMATION_NOTICE_DAYS = 30;
const RULE_MAX = 60;
const TEXT_MAX = 2000;

const isAccount = (v: unknown): v is string =>
  typeof v === 'string' && isId(v) && v.startsWith('user_') && !v.includes(':');

/** The people a Notify names, by id: unique, accounts only, at most 10. */
export function noticePeople(to: unknown): string[] {
  if (!Array.isArray(to)) return [];
  const ids = to
    .map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>)['person'] : undefined))
    .filter(isAccount);
  return [...new Set(ids)].slice(0, CROSS_APP_NOTICE_PEOPLE_MAX);
}

export async function pushAutomationNotices(
  env: Env,
  sourceId: string,
  app: App,
  push: { key: string; rule: { name: string }; step: Record<string, unknown> },
  now: number,
): Promise<AutomationStepAnswer> {
  const text =
    typeof push.step['text'] === 'string' ? push.step['text'].trim().slice(0, TEXT_MAX) : '';
  const people = noticePeople(push.step['to']);
  if (!text || people.length === 0)
    return { ok: false, code: 'invalid', reason: 'Nobody to notify, or nothing to say' };
  // Only people who reach the item hear from its rules.
  const reach = await Promise.all(
    people.map(async (id) => {
      const loaded = await loadItem(
        env,
        sourceId,
        { person: { id, kind: 'account', teams: [] }, share: null },
        'view',
      );
      if (loaded instanceof Response) await loaded.body?.cancel();
      return loaded instanceof Response ? null : id;
    }),
  );
  const reached = reach.filter((id): id is string => id !== null);
  if (reached.length === 0) return { ok: false, code: 'no_access', reason: '' };
  const rule = push.rule.name.trim().slice(0, RULE_MAX) || 'Untitled';
  const rows = await Promise.all(
    reached.map(async (person) => ({
      id: `an:${await sha256Hex(new TextEncoder().encode(`${push.key}\n${person}`))}`,
      person,
    })),
  );
  await env.INDEX_DB.batch(
    rows.map((r) =>
      env.INDEX_DB.prepare(
        `INSERT OR IGNORE INTO automation_notices (id, person_id, app, item_id, rule, text, at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(r.id, r.person, app, sourceId, rule, text, now),
    ),
  );
  const left = people.length - reached.length;
  const said = reached.length === 1 ? 'Notified 1 person' : `Notified ${reached.length} people`;
  return { ok: true, text: left ? `${said} (${left} can't open this item)` : said };
}

export type InboxNotice = {
  id: string;
  app: App;
  itemId: string;
  itemTitle: string;
  rule: string;
  text: string;
  at: number;
};

/** A person's newest notices of the last 30 days, on items still there and out of the Trash. */
export function noticesQuery(personId: string, now: number): { sql: string; args: unknown[] } {
  return {
    sql: `SELECT n.id, n.app, n.item_id, i.title AS item_title, n.rule, n.text, n.at
      FROM automation_notices n JOIN items i ON i.id = n.item_id
      WHERE n.person_id = ? AND n.at >= ? AND i.trashed_at IS NULL
      ORDER BY n.at DESC LIMIT ${AUTOMATION_NOTICES_READ_MAX}`,
    args: [personId, now - AUTOMATION_NOTICE_DAYS * 86_400_000],
  };
}

export const noticeOf = (r: Record<string, unknown>): InboxNotice => ({
  id: String(r['id']),
  app: r['app'] as App,
  itemId: String(r['item_id']),
  itemTitle: String(r['item_title'] ?? ''),
  rule: String(r['rule']),
  text: String(r['text']),
  at: Number(r['at']),
});
