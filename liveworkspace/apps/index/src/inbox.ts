// The Inbox (liveworkspace/docs/one-explorer-contracts.md "Inbox"): across every app, open actions
// assigned to or by me, and unresolved threads on my items, where I commented, or where I am mentioned,
// limited to items I can reach. Two queries, each starting from an index on the person.

import {
  isApp,
  LIST_LIMIT_MAX,
  type ActionStatus,
  type App,
  type InboxAction,
  type InboxThread,
} from '@liveworkspace/index-client';
import { scopesOf } from './auth';
import { INBOX_LIMIT_DEFAULT } from './config';
import { parseLimit } from './codec';
import type { PersonContext } from './context';
import { badRequest, json } from './http';
import { LIVE_LINK } from './rows';

// Reached as owner, through a scope, or through a live link the person opened.
const REACHABLE = `(i.owner_id = ? OR i.scope IN (SELECT value FROM json_each(?)) OR EXISTS (
  SELECT 1 FROM shared_with sw JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
  WHERE sw.person_id = ? AND sw.item_id = i.id AND ${LIVE_LINK('sl')}))`;

type ThreadRow = {
  app: App;
  item_id: string;
  item_title: string;
  tab_id: string;
  element_id: string;
  element_label: string;
  resolved: number;
  comment_count: number;
  latest_text: string;
  latest_author_name: string;
  first_at: number;
  latest_at: number;
};

type ActionRow = {
  app: App;
  item_id: string;
  item_title: string;
  tab_id: string;
  element_id: string;
  action_id: string;
  element_label: string;
  name: string;
  status: ActionStatus;
  assignee_id: string | null;
  assigner_id: string;
  team_id: string | null;
  created_at: number;
  updated_at: number;
};

export function inboxQueries(personId: string, scopes: string[], app: App | null, limit: number) {
  const now = Date.now();
  const reachArgs = [personId, JSON.stringify(scopes), personId, now];
  const appClause = app ? 'AND t.app = ?' : '';
  const threads = {
    sql: `WITH candidates AS (
        SELECT t.app, t.item_id, t.tab_id, t.element_id FROM items i
          JOIN collab_threads t ON t.item_id = i.id
          WHERE i.owner_id = ? AND t.resolved = 0
        UNION
        SELECT p.app, p.item_id, p.tab_id, p.element_id FROM collab_thread_people p WHERE p.person_id = ?
      )
      SELECT t.app, t.item_id, i.title AS item_title, t.tab_id, t.element_id, t.element_label, t.resolved,
        t.comment_count, t.latest_text, t.latest_author_name, t.first_at, t.latest_at
      FROM candidates c
      JOIN collab_threads t ON t.app = c.app AND t.item_id = c.item_id AND t.tab_id = c.tab_id
        AND t.element_id = c.element_id
      JOIN items i ON i.id = t.item_id
      WHERE t.resolved = 0 AND i.trashed_at IS NULL ${appClause} AND ${REACHABLE}
      ORDER BY t.latest_at DESC LIMIT ?`,
    args: [personId, personId, ...(app ? [app] : []), ...reachArgs, limit],
  };
  const actions = {
    sql: `SELECT a.app, a.item_id, i.title AS item_title, a.tab_id, a.element_id, a.action_id, a.element_label,
        a.name, a.status, a.assignee_id, a.assigner_id, a.team_id, a.created_at, a.updated_at
      FROM collab_actions a JOIN items i ON i.id = a.item_id
      WHERE a.status = 'open' AND (a.assignee_id = ? OR a.assigner_id = ?) AND i.trashed_at IS NULL
        ${app ? 'AND a.app = ?' : ''} AND ${REACHABLE}
      ORDER BY a.updated_at DESC LIMIT ?`,
    args: [personId, personId, ...(app ? [app] : []), ...reachArgs, limit],
  };
  return { threads, actions };
}

export async function handleInbox(ctx: PersonContext): Promise<Response> {
  const { env, url, person } = ctx;
  const app = url.searchParams.get('app');
  if (app !== null && !isApp(app)) return badRequest('invalid_app');
  const limit = parseLimit(
    url.searchParams.get('limit'),
    Math.min(INBOX_LIMIT_DEFAULT, LIST_LIMIT_MAX),
  );
  if (limit === null) return badRequest('invalid_query');
  const q = inboxQueries(person.id, scopesOf(person), app, limit);
  const db = env.INDEX_DB;
  const [threadRes, actionRes] = (await db.batch([
    db.prepare(q.threads.sql).bind(...q.threads.args),
    db.prepare(q.actions.sql).bind(...q.actions.args),
  ])) as D1Result<Record<string, unknown>>[];
  const threads: InboxThread[] = (threadRes!.results as ThreadRow[]).map((r) => ({
    app: r.app,
    itemId: r.item_id,
    itemTitle: r.item_title,
    tabId: r.tab_id,
    elementId: r.element_id,
    elementLabel: r.element_label,
    resolved: r.resolved === 1,
    commentCount: r.comment_count,
    latestText: r.latest_text,
    latestAuthorName: r.latest_author_name,
    firstAt: r.first_at,
    latestAt: r.latest_at,
  }));
  const actions: InboxAction[] = (actionRes!.results as ActionRow[]).map((r) => ({
    app: r.app,
    itemId: r.item_id,
    itemTitle: r.item_title,
    tabId: r.tab_id,
    elementId: r.element_id,
    actionId: r.action_id,
    elementLabel: r.element_label,
    name: r.name,
    status: r.status,
    assigneeId: r.assignee_id,
    assignerId: r.assigner_id,
    teamId: r.team_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  return json({ threads, actions });
}
