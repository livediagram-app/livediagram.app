// View As Diagram kept live (docs/specs/026-plan/view-as-diagram.md "Live"; liveworkspace's diagrams-and-plans.md):
// the plan room remembers each live diagram drawn from it (its own SQLite, `plan_views`, at most
// PLAN_VIEWS_PER_PLAN_MAX, the oldest forgotten). An `items` or `item-types` op starts a PLAN_VIEW_SETTLE_MS wait;
// then each view's graph is drawn again, and only the views whose graph's hash moved are sent to the index, which
// redraws them as their makers. A view the index answers `gone` is forgotten. A plan with no view pays one cached
// boolean per op: never polled, nothing read.
import { planGraphHash, type PlanGraph } from '@liveplanner/items';
import {
  PLAN_VIEW_SETTLE_MS,
  PLAN_VIEWS_PER_PLAN_MAX,
  type IndexAppClient,
  type PlanViewRedraw,
} from '@liveworkspace/index-client';

type Sql = { exec: (query: string, ...bindings: unknown[]) => { toArray(): unknown[] } };

export type PlanViewRow = {
  diagramId: string;
  tabId: string;
  board: string;
  filtered: boolean;
  person: string;
};

type Stored = {
  diagram_id: string;
  tab_id: string;
  board: string;
  filtered: number;
  person: string;
  hash: string | null;
};

type Signal = Pick<IndexAppClient, 'planDiagramsChanged'>;

/** Each view's graph now, by its board and filter, drawn for its maker: null when the plan cannot be read. */
export type DrawViews = (
  views: readonly PlanViewRow[],
) => Promise<Map<string, PlanGraph | null> | null>;

const SCHEMA = `CREATE TABLE IF NOT EXISTS plan_views (
  diagram_id TEXT PRIMARY KEY, tab_id TEXT NOT NULL, board TEXT NOT NULL, filtered INTEGER NOT NULL,
  person TEXT NOT NULL, hash TEXT, at INTEGER NOT NULL)`;

const VIEW_OPS = new Set(['items', 'item-types']);
const keyOf = (v: Pick<PlanViewRow, 'board' | 'filtered' | 'person'>) =>
  `${v.board}|${v.filtered ? 1 : 0}|${v.person}`;

export class PlanViews {
  private timer: ReturnType<typeof setTimeout> | null = null;
  // Whether the table holds a row, read once; a watch sets it.
  private any: boolean | null = null;

  // The hash of each graph the `graph` op drew, by board, filter and person: a watch starts from it, so the first
  // change after a diagram is made redraws only when it alters something.
  private readonly drawn = new Map<string, string>();
  private readonly sql: () => Sql | undefined;
  private readonly planId: () => string | null;
  private readonly draw: DrawViews;
  private readonly signal: () => Signal | null;
  private readonly settleMs: number;

  constructor(
    sql: () => Sql | undefined,
    planId: () => string | null,
    draw: DrawViews,
    signal: () => Signal | null,
    settleMs = PLAN_VIEW_SETTLE_MS,
  ) {
    this.sql = sql;
    this.planId = planId;
    this.draw = draw;
    this.signal = signal;
    this.settleMs = settleMs;
  }

  /** A graph the `graph` op just drew, remembered (a few at most) for the watch that follows it. */
  noteDrawn(view: Pick<PlanViewRow, 'board' | 'filtered' | 'person'>, graph: PlanGraph): void {
    if (this.drawn.size >= PLAN_VIEWS_PER_PLAN_MAX) this.drawn.clear();
    this.drawn.set(keyOf(view), planGraphHash(graph));
  }

  private table(sql: Sql): Sql {
    sql.exec(SCHEMA);
    return sql;
  }

  private rows(sql: Sql): Stored[] {
    return this.table(sql)
      .exec(
        'SELECT diagram_id, tab_id, board, filtered, person, hash FROM plan_views ORDER BY at DESC',
      )
      .toArray() as Stored[];
  }

  /** A live diagram remembered, with the hash of the graph just drawn for it; the oldest past the cap forgotten. */
  watch(view: PlanViewRow, now = Date.now()): void {
    const sql = this.sql();
    if (!sql) return;
    this.table(sql).exec(
      `INSERT INTO plan_views (diagram_id, tab_id, board, filtered, person, hash, at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(diagram_id) DO UPDATE SET tab_id = excluded.tab_id, board = excluded.board,
         filtered = excluded.filtered, person = excluded.person, hash = excluded.hash, at = excluded.at`,
      view.diagramId,
      view.tabId,
      view.board,
      view.filtered ? 1 : 0,
      view.person,
      this.drawn.get(keyOf(view)) ?? null,
      now,
    );
    sql.exec(
      `DELETE FROM plan_views WHERE diagram_id NOT IN
        (SELECT diagram_id FROM plan_views ORDER BY at DESC LIMIT ?)`,
      PLAN_VIEWS_PER_PLAN_MAX,
    );
    this.any = true;
  }

  /** How many views the plan keeps (tests and logs). */
  count(): number {
    const sql = this.sql();
    return sql ? this.rows(sql).length : 0;
  }

  // An op the room relayed: a card or type change starts the settle wait, when there is anything to redraw.
  changed(op: unknown): void {
    const kind = (op as { kind?: unknown } | null)?.kind;
    if (typeof kind !== 'string' || !VIEW_OPS.has(kind)) return;
    if (this.any === null) {
      const sql = this.sql();
      this.any = !!sql && this.rows(sql).length > 0;
    }
    if (!this.any) return;
    this.timer ??= setTimeout(() => void this.flush(), this.settleMs);
  }

  // Draw each view again; send the index those whose graph changed; forget the ones it says are gone.
  async flush(): Promise<void> {
    this.timer = null;
    const sql = this.sql();
    const planId = this.planId();
    const client = this.signal();
    if (!sql || !planId || !client) return;
    const stored = this.rows(sql);
    if (stored.length === 0) {
      this.any = false;
      return;
    }
    try {
      const views = stored.map((r) => ({
        diagramId: r.diagram_id,
        tabId: r.tab_id,
        board: r.board,
        filtered: r.filtered === 1,
        person: r.person,
      }));
      const graphs = await this.draw(views);
      if (!graphs) return;
      const redraws: (PlanViewRedraw & { hash: string })[] = [];
      const gone: string[] = [];
      for (const r of stored) {
        const graph = graphs.get(r.diagram_id);
        // Its board is gone: nothing left to draw, so the view goes.
        if (graph === null) gone.push(r.diagram_id);
        if (!graph) continue;
        const hash = planGraphHash(graph);
        if (hash === r.hash) continue;
        redraws.push({ diagramId: r.diagram_id, tabId: r.tab_id, person: r.person, graph, hash });
      }
      if (redraws.length > 0) {
        const answer = await client.planDiagramsChanged(
          planId,
          redraws.map(({ hash: _hash, ...v }) => v),
        );
        for (const v of answer.views) {
          if (v.status === 'gone') gone.push(v.diagramId);
          if (v.status !== 'ok') continue;
          const hash = redraws.find((r) => r.diagramId === v.diagramId)?.hash ?? null;
          sql.exec('UPDATE plan_views SET hash = ? WHERE diagram_id = ?', hash, v.diagramId);
        }
      }
      if (gone.length > 0)
        sql.exec(
          'DELETE FROM plan_views WHERE diagram_id IN (SELECT value FROM json_each(?))',
          JSON.stringify(gone),
        );
      console.info('[plan] plan views redrawn', { sent: redraws.length, gone: gone.length });
    } catch (err) {
      console.warn('[plan] plan views not redrawn', { error: String(err) });
    }
  }
}
