// The Inbox (liveworkspace/docs/one-explorer-contracts.md "Inbox"): across every app, open actions and cards
// assigned to or by me, unresolved threads (an element's or a card's) on my items, where I commented, or where I am
// mentioned, and forms with responses I haven't seen on items I own or reach through a team, limited to items I can
// reach. Three queries, each starting from an index on the person.

import {
  isApp,
  LIST_LIMIT_MAX,
  type ActionStatus,
  type App,
  type CollabCard,
  type InboxAction,
  type InboxForm,
  type InboxThread,
} from '@liveworkspace/index-client';
import { scopesOf } from './auth';
import { INBOX_LIMIT_DEFAULT } from './config';
import { parseLimit } from './codec';
import type { PersonContext } from './context';
import { badRequest, json } from './http';
import { LIVE_LINK } from './rows';
import { timelineNewQuery } from './timeline';

// Reached as owner, through a scope, or through a live link the person opened.
const REACHABLE = `(i.owner_id = ? OR i.scope IN (SELECT value FROM json_each(?)) OR EXISTS (
  SELECT 1 FROM shared_with sw JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
  WHERE sw.person_id = ? AND sw.item_id = i.id AND ${LIVE_LINK('sl')}))`;

type ThreadRow = {
  app: App;
  item_id: string;
  item_title: string;
  item_team_id: string | null;
  tab_id: string;
  tab_name: string;
  element_id: string;
  element_label: string;
  resolved: number;
  comment_count: number;
  latest_text: string;
  latest_author_name: string;
  latest_author_color: string;
  card: string | null;
  mentions_you: number;
  you_commented: number;
  on_your_item: number;
  first_at: number;
  latest_at: number;
};

type ActionRow = {
  app: App;
  item_id: string;
  item_title: string;
  item_team_id: string | null;
  tab_id: string;
  tab_name: string;
  element_id: string;
  action_id: string;
  element_label: string;
  name: string;
  description: string;
  status: ActionStatus;
  assignee_id: string | null;
  assignee_name: string | null;
  assigner_id: string;
  assigner_name: string | null;
  team_id: string | null;
  card: string | null;
  created_at: number;
  updated_at: number;
};

type FormRow = {
  app: App;
  item_id: string;
  item_title: string;
  item_team_id: string | null;
  tab_id: string;
  heading: string;
  board_tab_id: string | null;
  unseen: number;
  latest_at: number;
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
      SELECT t.app, t.item_id, i.title AS item_title, i.team_id AS item_team_id, t.tab_id, t.tab_name, t.element_id, t.element_label,
        t.resolved, t.comment_count, t.latest_text, t.latest_author_name, t.latest_author_color, t.card,
        EXISTS (SELECT 1 FROM json_each(t.mentioned_ids) WHERE value = ?) AS mentions_you,
        EXISTS (SELECT 1 FROM json_each(t.participant_ids) WHERE value = ?) AS you_commented,
        i.owner_id = ? AS on_your_item, t.first_at, t.latest_at
      FROM candidates c
      JOIN collab_threads t ON t.app = c.app AND t.item_id = c.item_id AND t.tab_id = c.tab_id
        AND t.element_id = c.element_id
      JOIN items i ON i.id = t.item_id
      WHERE t.resolved = 0 AND i.trashed_at IS NULL ${appClause} AND ${REACHABLE}
      ORDER BY t.latest_at DESC LIMIT ?`,
    args: [
      personId,
      personId,
      personId,
      personId,
      personId,
      ...(app ? [app] : []),
      ...reachArgs,
      limit,
    ],
  };
  const actions = {
    sql: `SELECT a.app, a.item_id, i.title AS item_title, i.team_id AS item_team_id, a.tab_id, a.tab_name, a.element_id, a.action_id,
        a.element_label, a.name, a.description, a.status, a.assignee_id, a.assignee_name, a.assigner_id,
        a.assigner_name, a.team_id, a.card, a.created_at, a.updated_at
      FROM collab_actions a JOIN items i ON i.id = a.item_id
      WHERE a.status = 'open' AND (a.assignee_id = ? OR a.assigner_id = ?) AND i.trashed_at IS NULL
        ${app ? 'AND a.app = ?' : ''} AND ${REACHABLE}
      ORDER BY a.updated_at DESC LIMIT ?`,
    args: [personId, personId, ...(app ? [app] : []), ...reachArgs, limit],
  };
  // Forms on items I own or reach through a team (not through a link), with responses I haven't seen. From my items,
  // by owner and by scope (the items indexes), so the read never walks other people's forms.
  const forms = {
    sql: `SELECT f.app, f.item_id, i.title AS item_title, i.team_id AS item_team_id, f.tab_id, f.heading, f.board_tab_id,
        f.responses - COALESCE(r.seen, 0) AS unseen, f.latest_at
      FROM items i
      JOIN collab_forms f ON f.item_id = i.id
      LEFT JOIN collab_form_reads r ON r.person_id = ? AND r.item_id = f.item_id AND r.tab_id = f.tab_id
      WHERE (i.owner_id = ? OR i.scope IN (SELECT value FROM json_each(?)))
        AND i.trashed_at IS NULL ${app ? 'AND f.app = ?' : ''}
        AND f.responses > COALESCE(r.seen, 0)
      ORDER BY f.latest_at DESC LIMIT ?`,
    args: [personId, personId, JSON.stringify(scopes), ...(app ? [app] : []), limit],
  };
  return { threads, actions, forms };
}

function cardOf(text: string | null): CollabCard | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as CollabCard;
  } catch {
    return null;
  }
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
  // The sidebar's Timeline count rides along, so the Explorer reads it with the Inbox it already asks for.
  const fresh = timelineNewQuery(person, app, Date.now());
  const [threadRes, actionRes, formRes, freshRes] = (await db.batch([
    db.prepare(q.threads.sql).bind(...q.threads.args),
    db.prepare(q.actions.sql).bind(...q.actions.args),
    db.prepare(q.forms.sql).bind(...q.forms.args),
    db.prepare(fresh.sql).bind(...fresh.args),
  ])) as D1Result<Record<string, unknown>>[];
  const threads: InboxThread[] = (threadRes!.results as ThreadRow[]).map((r) => ({
    app: r.app,
    itemId: r.item_id,
    itemTitle: r.item_title,
    itemTeamId: r.item_team_id,
    tabId: r.tab_id,
    tabName: r.tab_name,
    elementId: r.element_id,
    elementLabel: r.element_label,
    resolved: r.resolved === 1,
    commentCount: r.comment_count,
    latestText: r.latest_text,
    latestAuthorName: r.latest_author_name,
    latestAuthorColor: r.latest_author_color,
    card: cardOf(r.card),
    mentionsYou: r.mentions_you === 1,
    youCommented: r.you_commented === 1,
    onYourItem: r.on_your_item === 1,
    firstAt: r.first_at,
    latestAt: r.latest_at,
  }));
  const actions: InboxAction[] = (actionRes!.results as ActionRow[]).map((r) => ({
    app: r.app,
    itemId: r.item_id,
    itemTitle: r.item_title,
    itemTeamId: r.item_team_id,
    tabId: r.tab_id,
    tabName: r.tab_name,
    elementId: r.element_id,
    actionId: r.action_id,
    elementLabel: r.element_label,
    name: r.name,
    description: r.description,
    status: r.status,
    assigneeId: r.assignee_id,
    assigneeName: r.assignee_name,
    assignerId: r.assigner_id,
    assignerName: r.assigner_name,
    teamId: r.team_id,
    card: cardOf(r.card),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  const forms: InboxForm[] = (formRes!.results as FormRow[]).map((r) => ({
    app: r.app,
    itemId: r.item_id,
    itemTitle: r.item_title,
    itemTeamId: r.item_team_id,
    tabId: r.tab_id,
    heading: r.heading,
    boardTabId: r.board_tab_id,
    unseen: r.unseen,
    latestAt: r.latest_at,
  }));
  const timelineNew = Number((freshRes!.results[0] as { n?: number } | undefined)?.n ?? 0);
  return json({ threads, actions, forms, timelineNew });
}
