// The Inbox (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Inbox"): across every app, open actions and cards
// assigned to or by me, unresolved threads (an element's or a card's) on my items, where I commented, or where I am
// mentioned, forms with responses I haven't seen on items I own or reach through a team, limited to items I can
// reach, open access requests on items I manage, my own requests granted lately (`shares`, inbox-notices.md),
// the suggested edits waiting on my pages (`suggestions`), and updates on pages I watch (updates.ts). Seven queries,
// each starting from an index on the person.

import {
  COLLAB_CARDS_TAB,
  INBOX_SHARES_MS,
  INBOX_SUGGESTIONS_MAX,
  isApp,
  LIST_LIMIT_MAX,
  type ActionStatus,
  type App,
  type CollabCard,
  type CollabMentioner,
  type InboxAccessRequest,
  type InboxAction,
  type InboxForm,
  type InboxShare,
  type InboxSuggestion,
  type InboxThread,
} from '@liveworkspace/index-client';
import { scopesOf } from './auth';
import { INBOX_LIMIT_DEFAULT } from './config';
import { parseLimit } from './codec';
import type { PersonContext } from './context';
import { badRequest, json } from './http';
import { LIVE_LINK } from './rows';
import { inboxUpdateOf, updatesQuery, type UpdateRow } from './updates';

// Reached as owner, through a scope, or through a live link the person opened, on the tab that link opens: a link
// scoped to one tab reaches that tab's threads and actions alone, as it opens that tab alone, and the cards on that
// tab's boards (pushed under COLLAB_CARDS_TAB, each naming its board's tab). `row` is the thread's or action's alias;
// `cards` false for a table without cards (suggested edits, updates), which reaches by tab alone: an update's tab is
// always a page.
const reachable = (
  row: string,
  cards = true,
) => `((i.owner_id = ? AND i.team_id IS NULL) OR i.scope IN (SELECT value FROM json_each(?)) OR EXISTS (
  SELECT 1 FROM shared_with sw JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
  WHERE sw.person_id = ? AND sw.item_id = i.id AND (sl.tab_id IS NULL OR sl.tab_id = ${row}.tab_id${
    cards
      ? `
    OR (${row}.tab_id = '${COLLAB_CARDS_TAB}' AND json_extract(${row}.card, '$.board.tabId') = sl.tab_id)`
      : ''
  })
    AND ${LIVE_LINK('sl')}))`;

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
  latest_author_id: string | null;
  card: string | null;
  mentions_you: number;
  mentioned_by_you: string | null;
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

type AccessRequestRow = {
  id: string;
  app: App;
  item_id: string;
  item_title: string;
  item_team_id: string | null;
  requester_id: string;
  requester_name: string | null;
  note: string | null;
  asked_at: number;
};

type ShareRow = {
  id: string;
  app: App;
  item_id: string;
  item_title: string;
  item_team_id: string | null;
  shared_at: number;
  shared_by_id: string | null;
  shared_by_name: string | null;
};

type SuggestionRow = {
  app: App;
  item_id: string;
  item_title: string;
  item_team_id: string | null;
  tab_id: string;
  tab_name: string;
  suggestion_id: string;
  agent: string;
  reason: string;
  kind: InboxSuggestion['kind'];
  before_text: string;
  after_text: string;
  created_at: number;
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
        t.resolved, t.comment_count, t.latest_text, t.latest_author_name, t.latest_author_color, t.latest_author_id,
        t.card,
        EXISTS (SELECT 1 FROM json_each(t.mentioned_ids) WHERE value = ?) AS mentions_you,
        (SELECT value FROM json_each(t.mentioned_by) WHERE key = ?) AS mentioned_by_you,
        EXISTS (SELECT 1 FROM json_each(t.participant_ids) WHERE value = ?) AS you_commented,
        i.owner_id = ? AS on_your_item, t.first_at, t.latest_at
      FROM candidates c
      JOIN collab_threads t ON t.app = c.app AND t.item_id = c.item_id AND t.tab_id = c.tab_id
        AND t.element_id = c.element_id
      JOIN items i ON i.id = t.item_id
      WHERE t.resolved = 0 AND i.trashed_at IS NULL ${appClause} AND ${reachable('t')}
      ORDER BY t.latest_at DESC LIMIT ?`,
    args: [
      personId,
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
        ${app ? 'AND a.app = ?' : ''} AND ${reachable('a')}
      ORDER BY a.updated_at DESC LIMIT ?`,
    args: [personId, personId, ...(app ? [app] : []), ...reachArgs, limit],
  };
  // Forms on items I own or reach through a team (not through a link), with responses I haven't seen. From my items,
  // by owner and by scope (the items indexes), so the read never walks other people's forms: the two item reads are
  // their own union, because with the OR in one WHERE SQLite walked every form in the index and looked up its item.
  const forms = {
    sql: `SELECT f.app, f.item_id, mine.title AS item_title, mine.team_id AS item_team_id, f.tab_id, f.heading, f.board_tab_id,
        f.responses - COALESCE(r.seen, 0) AS unseen, f.latest_at
      FROM (SELECT id, title, team_id FROM items WHERE owner_id = ? AND team_id IS NULL AND trashed_at IS NULL
            UNION
            SELECT id, title, team_id FROM items
            WHERE scope IN (SELECT value FROM json_each(?)) AND trashed_at IS NULL) mine
      JOIN collab_forms f ON f.item_id = mine.id
      LEFT JOIN collab_form_reads r ON r.person_id = ? AND r.item_id = f.item_id AND r.tab_id = f.tab_id
      WHERE f.responses > COALESCE(r.seen, 0) ${app ? 'AND f.app = ?' : ''}
      ORDER BY f.latest_at DESC LIMIT ?`,
    args: [personId, JSON.stringify(scopes), personId, ...(app ? [app] : []), limit],
  };
  // Open access requests on items I manage (request-access.md "In the Inbox"): my scopes' live items (my personal
  // scope and my teams', through items_live; Archived is a scope of its own, so it lists none), each item's open
  // requests through access_requests_item. A requester who meanwhile reaches the item through a live link is left out.
  const accessRequests = {
    sql: `SELECT r.id, mine.app, r.item_id, mine.title AS item_title, mine.team_id AS item_team_id, r.requester_id,
        r.requester_name, r.note, r.asked_at
      FROM (SELECT id, app, title, team_id FROM items
            WHERE scope IN (SELECT value FROM json_each(?)) AND trashed_at IS NULL) mine
      JOIN access_requests r ON r.item_id = mine.id AND r.state = 'open'
      WHERE r.requester_id <> ? ${app ? 'AND mine.app = ?' : ''}
        AND NOT EXISTS (
          SELECT 1 FROM shared_with sw JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
          WHERE sw.person_id = r.requester_id AND sw.item_id = r.item_id AND ${LIVE_LINK('sl')})
      ORDER BY r.asked_at DESC LIMIT ?`,
    args: [JSON.stringify(scopes), personId, ...(app ? [app] : []), now, limit],
  };
  // My own requests granted in the last INBOX_SHARES_MS, while a live link still reaches the item for me (the grant's
  // link, or another): from access_requests_person_item, a handful. Who granted it is the grant's `shared` event, at
  // the grant's time (inbox-notices.md "shares in the Inbox read").
  const shares = {
    sql: `SELECT r.id, i.app, r.item_id, i.title AS item_title, i.team_id AS item_team_id, r.closed_at AS shared_at,
        MAX(e.actor_id) AS shared_by_id, MAX(e.actor_name) AS shared_by_name
      FROM access_requests r JOIN items i ON i.id = r.item_id
      LEFT JOIN events e ON e.item_id = r.item_id AND e.type = 'shared' AND e.occurred_at = r.closed_at
      WHERE r.requester_id = ? AND r.state = 'granted' AND r.closed_at >= ? AND i.trashed_at IS NULL
        ${app ? 'AND i.app = ?' : ''}
        AND EXISTS (
          SELECT 1 FROM shared_with sw JOIN share_links sl ON sl.code = sw.share_code AND sl.item_id = sw.item_id
          WHERE sw.person_id = r.requester_id AND sw.item_id = r.item_id AND ${LIVE_LINK('sl')})
      GROUP BY r.id
      ORDER BY r.closed_at DESC LIMIT ?`,
    args: [personId, now - INBOX_SHARES_MS, ...(app ? [app] : []), now, limit],
  };
  // Suggested edits waiting on my pages (one-explorer-contracts.md "Inbox"): those naming me
  // (collab_suggestions_owner), and those naming no one on items I own (items_owner, then collab_suggestions_item's
  // `owner_id IS NULL` range), on live items I still reach; newest first, at most INBOX_SUGGESTIONS_MAX.
  const suggestions = {
    sql: `WITH candidates AS (
        SELECT s.app, s.item_id, s.tab_id, s.suggestion_id FROM collab_suggestions s WHERE s.owner_id = ?
        UNION ALL
        SELECT s.app, s.item_id, s.tab_id, s.suggestion_id FROM items i
          JOIN collab_suggestions s ON s.item_id = i.id AND s.owner_id IS NULL
          WHERE i.owner_id = ?
      )
      SELECT s.app, s.item_id, i.title AS item_title, i.team_id AS item_team_id, s.tab_id, s.tab_name,
        s.suggestion_id, s.agent, s.reason, s.kind, s.before_text, s.after_text, s.created_at
      FROM candidates c
      JOIN collab_suggestions s ON s.app = c.app AND s.item_id = c.item_id AND s.tab_id = c.tab_id
        AND s.suggestion_id = c.suggestion_id
      JOIN items i ON i.id = s.item_id
      WHERE i.trashed_at IS NULL ${app ? 'AND s.app = ?' : ''} AND ${reachable('s', false)}
      ORDER BY s.created_at DESC, s.suggestion_id LIMIT ?`,
    args: [
      personId,
      personId,
      ...(app ? [app] : []),
      ...reachArgs,
      Math.min(limit, INBOX_SUGGESTIONS_MAX),
    ],
  };
  // Updates on pages I watch (updates.ts): from my people index, on items I reach as a thread's.
  const updates = updatesQuery(personId, app, limit, now, reachable('u', false), reachArgs);
  return { threads, actions, forms, accessRequests, shares, suggestions, updates };
}

/** Who mentioned the reader, as the push said (checked when it was pushed); null when it said nothing. */
function mentionerOf(text: string | null): CollabMentioner | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as CollabMentioner;
  } catch {
    return null;
  }
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
  const [threadRes, actionRes, formRes, accessRes, shareRes, suggestionRes, updateRes] =
    (await db.batch([
      db.prepare(q.threads.sql).bind(...q.threads.args),
      db.prepare(q.actions.sql).bind(...q.actions.args),
      db.prepare(q.forms.sql).bind(...q.forms.args),
      db.prepare(q.accessRequests.sql).bind(...q.accessRequests.args),
      db.prepare(q.shares.sql).bind(...q.shares.args),
      db.prepare(q.suggestions.sql).bind(...q.suggestions.args),
      db.prepare(q.updates.sql).bind(...q.updates.args),
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
    latestAuthorId: r.latest_author_id,
    card: cardOf(r.card),
    mentionsYou: r.mentions_you === 1,
    mentionedBy: r.mentions_you === 1 ? mentionerOf(r.mentioned_by_you) : null,
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
  const accessRequests: InboxAccessRequest[] = (accessRes!.results as AccessRequestRow[]).map(
    (r) => ({
      id: r.id,
      app: r.app,
      itemId: r.item_id,
      itemTitle: r.item_title,
      itemTeamId: r.item_team_id,
      requesterId: r.requester_id,
      requesterName: r.requester_name,
      note: r.note,
      askedAt: r.asked_at,
    }),
  );
  const shares: InboxShare[] = (shareRes!.results as ShareRow[]).map((r) => ({
    id: r.id,
    app: r.app,
    itemId: r.item_id,
    itemTitle: r.item_title,
    itemTeamId: r.item_team_id,
    sharedById: r.shared_by_id,
    sharedByName: r.shared_by_name,
    sharedAt: r.shared_at,
  }));
  const suggestions: InboxSuggestion[] = (suggestionRes!.results as SuggestionRow[]).map((r) => ({
    app: r.app,
    itemId: r.item_id,
    itemTitle: r.item_title,
    itemTeamId: r.item_team_id,
    tabId: r.tab_id,
    tabName: r.tab_name,
    suggestionId: r.suggestion_id,
    agent: r.agent,
    reason: r.reason,
    kind: r.kind,
    before: r.before_text,
    after: r.after_text,
    createdAt: r.created_at,
  }));
  const updates = (updateRes!.results as UpdateRow[]).map(inboxUpdateOf);
  return json({ threads, actions, forms, accessRequests, shares, suggestions, updates });
}
