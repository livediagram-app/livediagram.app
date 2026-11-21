// The comment and action triggers (liveworkspace/docs/specs/018-automations/automations.md "Triggers every app has";
// blueprint item-engine.md "The collab watch"): Comment Added, Thread Resolved, All Threads Resolved, Action Assigned
// and Action Done, worked out from what a tab's threads and actions were and now are. Comments arrive by many roads
// (a tab save, the comment routes, a changeset, a Participant's write), so the one place they are read is where an
// app's outbox already parses a changed tab for the Inbox: each tab's last summary is kept in
// `automation_collab_seen` and diffed there (item/collab.ts collabEvents).
//
// Costs nothing while no rule that is on hears one of the five kinds: the drain's check is five Set lookups, the
// table is empty, and no baseline is read. When a rule first hears one, every tab's standing threads are read once
// (the baseline, a few tabs a wake on the room's alarm), so they start nothing and the first comment after does.
// When the last such rule goes (off, deleted, the item put away) the table is emptied, so a rule turned on later
// never answers what was written while nobody listened.
import { collabEvents, type CollabSummary } from '../../item';
import type { AutomationPerson } from '../../types';
import type { ItemEngine } from '../item/engine';
import { queueItemEvent } from '../item/intake';
import type { Sql } from '../sql';

// The kinds the diff makes.
export const COLLAB_KINDS = [
  'comment_added',
  'thread_resolved',
  'threads_resolved',
  'action_assigned',
  'action_done',
] as const;

// Tabs read for the baseline in one wake, and the pause before the next.
export const COLLAB_BASELINE_TABS = 10;
export const COLLAB_BASELINE_MORE_MS = 1000;

// The schema step a collab app appends after the engine's own (item/schema.ts): each tab's comment threads and
// actions as the comment triggers last saw them, kept only while a rule that is on hears one.
export const COLLAB_SEEN_SCHEMA_STEP = `
CREATE TABLE IF NOT EXISTS automation_collab_seen (
  tab_id  TEXT PRIMARY KEY,
  summary TEXT NOT NULL
) WITHOUT ROWID;
`;

// A thread and an action as the apps' Inbox rows hold them: the fields the diff reads.
export interface CollabThreadRowLike {
  elementId: string;
  resolved: boolean;
  commentCount: number;
  latestText: string;
  latestAuthorId: string | null;
  latestAuthorName?: string | null;
  latestAuthorColor?: string | null;
}
export interface CollabActionRowLike {
  elementId: string;
  actionId: string;
  name: string;
  status: string;
  assigneeUserId?: string | null;
  assigneeMemberId?: string | null;
  assigneeName?: string | null;
}
export interface CollabRows {
  threads: readonly CollabThreadRowLike[];
  actions: readonly CollabActionRowLike[];
}

// What the table keeps of a tab: only what the diff compares. Threads as [elementId, resolved, commentCount],
// actions as [elementId, actionId, status, assigneeId].
type Seen = {
  t: [string, 0 | 1, number][];
  a: [string, string, string, string | null][];
};

/** A tab's threads and actions as the diff reads them, from the rows the Inbox's push is built from. */
export function collabSummaryOf(
  threads: readonly CollabThreadRowLike[],
  actions: readonly CollabActionRowLike[],
): CollabSummary {
  return {
    threads: threads.map((t) => ({
      elementId: t.elementId,
      resolved: t.resolved,
      commentCount: t.commentCount,
      latestText: t.latestText,
      latestAuthorId: t.latestAuthorId,
      latestAuthorName: t.latestAuthorName ?? '',
      latestAuthorColor: t.latestAuthorColor ?? '',
    })),
    actions: actions.map((a) => ({
      elementId: a.elementId,
      actionId: a.actionId,
      name: a.name,
      status: a.status,
      assigneeId: a.assigneeUserId ?? a.assigneeMemberId ?? null,
      assigneeName: a.assigneeName,
    })),
  };
}

const seenOf = (summary: CollabSummary): Seen => ({
  t: summary.threads.map((t) => [t.elementId, t.resolved ? 1 : 0, t.commentCount]),
  a: summary.actions.map((a) => [a.elementId, a.actionId, a.status, a.assigneeId]),
});

// A kept summary as the diff's `before`: the texts and names it never reads are left empty.
const summaryOfSeen = (seen: Seen): CollabSummary => ({
  threads: seen.t.map(([elementId, resolved, commentCount]) => ({
    elementId,
    resolved: resolved === 1,
    commentCount,
    latestText: '',
    latestAuthorId: null,
    latestAuthorName: '',
  })),
  actions: seen.a.map(([elementId, actionId, status, assigneeId]) => ({
    elementId,
    actionId,
    name: '',
    status,
    assigneeId,
  })),
});

function parseSeen(raw: unknown): Seen | null {
  try {
    const seen = JSON.parse(String(raw)) as Partial<Seen>;
    return Array.isArray(seen.t) && Array.isArray(seen.a) ? (seen as Seen) : null;
  } catch {
    return null;
  }
}

/** A stored tab body's elements (`{"elements":[…]}`), or none for anything else. */
export function tabElements(data: string): unknown[] {
  try {
    const body = JSON.parse(data) as { elements?: unknown };
    return Array.isArray(body.elements) ? body.elements : [];
  } catch {
    return [];
  }
}

export interface CollabWatchInput {
  engine: () => ItemEngine;
  sql: () => Sql;
  ready: () => boolean;
  arm: () => void;
  // The app's tab link table (its tab column is `tab_id`), as the schema step was given it.
  links: string;
  // A stored tab body's threads and actions, as the app's Inbox rows.
  rows: (data: string) => CollabRows;
}

export class CollabWatch {
  // 'clear': no rule listens and the table is empty. 'partial': a rule listens and some tab may lack its baseline.
  // 'ready': every tab the item held when last asked has one.
  private state: 'clear' | 'partial' | 'ready' = 'clear';
  private moreAt: number | null = null;
  private readonly input: CollabWatchInput;

  constructor(input: CollabWatchInput) {
    if (!/^[a-z_]+$/.test(input.links)) throw new Error(`not a table name: ${input.links}`);
    this.input = input;
  }

  /** Whether a rule that is on hears a comment or an action trigger. */
  watching(): boolean {
    const kinds = this.input.engine().kinds;
    return COLLAB_KINDS.some((kind) => kinds.has(kind));
  }

  /** After a wake: an item some rule listens to checks its baseline once, on its next alarm. */
  restore(): void {
    this.state = this.watching() ? 'partial' : 'clear';
    this.moreAt = this.state === 'partial' ? Date.now() : null;
  }

  /** The rules changed, or the item was put away or brought back. */
  rulesChanged(): void {
    if (!this.input.ready()) return;
    if (!this.watching()) {
      if (this.state !== 'clear') this.input.sql().exec('DELETE FROM automation_collab_seen');
      this.state = 'clear';
      this.moreAt = null;
      return;
    }
    if (this.state !== 'clear') return;
    this.state = 'partial';
    this.moreAt = Date.now();
    this.input.arm();
  }

  /** When the baseline next reads tabs, for the room's alarm; null when it has nothing to read. */
  get at(): number | null {
    return this.state === 'partial' ? this.moreAt : null;
  }

  /** The baseline's share of an alarm: up to COLLAB_BASELINE_TABS tabs with no summary kept get theirs, with no
   *  event made. Answers how many it read. */
  baseline(now: number): number {
    if (this.state !== 'partial' || this.moreAt === null || this.moreAt > now) return 0;
    if (!this.input.ready() || !this.watching()) {
      this.rulesChanged();
      return 0;
    }
    const sql = this.input.sql();
    const rows = sql
      .exec<{ id: string; data: string }>(
        `SELECT t.id, t.data FROM tabs t JOIN ${this.input.links} l ON l.tab_id = t.id
          WHERE NOT EXISTS (SELECT 1 FROM automation_collab_seen s WHERE s.tab_id = t.id)
          LIMIT ?`,
        COLLAB_BASELINE_TABS + 1,
      )
      .toArray();
    for (const row of rows.slice(0, COLLAB_BASELINE_TABS)) {
      const found = this.input.rows(row.data);
      this.keep(sql, row.id, JSON.stringify(seenOf(collabSummaryOf(found.threads, found.actions))));
    }
    const more = rows.length > COLLAB_BASELINE_TABS;
    this.state = more ? 'partial' : 'ready';
    this.moreAt = more ? now + COLLAB_BASELINE_MORE_MS : null;
    return Math.min(rows.length, COLLAB_BASELINE_TABS);
  }

  private keep(sql: Sql, tabId: string, seen: string): void {
    sql.exec(
      `INSERT INTO automation_collab_seen (tab_id, summary) VALUES (?, ?)
       ON CONFLICT (tab_id) DO UPDATE SET summary = excluded.summary`,
      tabId,
      seen,
    );
  }

  /** A changed tab as the outbox just read it (`null`: the tab is gone): the events between what was kept and
   *  what is there now are queued, and what is there now is kept. A tab seen for the first time makes none.
   *  `sole`: whoever alone saved since the last drain, asked for only when an event would name them. Answers how
   *  many events it queued. */
  async note(
    tabId: string,
    rows: CollabRows | null,
    now: number,
    sole: () => Promise<AutomationPerson | null>,
  ): Promise<number> {
    if (!this.input.ready() || !this.watching()) return 0;
    const sql = this.input.sql();
    if (!rows) {
      sql.exec('DELETE FROM automation_collab_seen WHERE tab_id = ?', tabId);
      return 0;
    }
    const after = collabSummaryOf(rows.threads, rows.actions);
    const kept = sql
      .exec('SELECT summary FROM automation_collab_seen WHERE tab_id = ?', tabId)
      .toArray()[0];
    const next = JSON.stringify(seenOf(after));
    if (kept && kept['summary'] === next) return 0;
    const seen = kept ? parseSeen(kept['summary']) : null;
    const before = seen ? summaryOfSeen(seen) : null;
    let events = collabEvents(before, after, { tab: tabId, at: now });
    // A thread resolved, an action assigned or done: by whoever alone saved since the last drain, when there was
    // one person (as the Inbox names them). A comment names its own author.
    if (events.some((e) => e.kind !== 'comment_added')) {
      const by = await sole();
      if (by) events = collabEvents(before, after, { tab: tabId, at: now, by });
    }
    this.keep(sql, tabId, next);
    const engine = this.input.engine();
    let queued = 0;
    for (const event of events) if (queueItemEvent(sql, engine, event)) queued += 1;
    return queued;
  }

  /** The item is gone. */
  forget(): void {
    this.state = 'clear';
    this.moreAt = null;
  }
}

/** Every rule write from now on: the watch follows what the rules hear. Called once, by the room's constructor. */
export function watchRules(engine: ItemEngine, watch: CollabWatch): void {
  const synced = engine.store.onSchedule;
  engine.store.onSchedule = () => {
    synced();
    watch.rulesChanged();
  };
}
