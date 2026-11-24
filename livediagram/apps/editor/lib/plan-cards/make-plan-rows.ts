// Make Plan Cards' preview (livediagram/docs/specs/013-workspace/make-plan-cards.md "The preview"; the platform's
// diagrams-and-plans.md): the shapes an app read, turned into the rows the dialog lists and the ask it sends, for the
// plan, board and column picked and how lanes land. Pure and linear in shapes plus arrows (a loop check walks each
// arrow's upstream once), so a 500-shape tab previews in a few milliseconds (read-shapes.perf.test.ts).
import {
  PLAN_MAKE_CARDS_MAX,
  PLAN_MAKE_LABEL_MAX,
  PLAN_MAKE_TEXT_MAX,
  PLAN_MAKE_TITLE_MAX,
  planSendRef,
  type PlanMakeAsk,
  type PlanMakeCard,
  type PlanSend,
} from '@liveworkspace/index-client';

/** One shape as the app read it: its words, the lane it sits in, its dates, the shapes it waits on. */
export type MakeShape = {
  element: string;
  title: string;
  text: string;
  lane?: string;
  start?: string;
  due?: string;
  blockedBy: string[];
};

/** A card an earlier make (or send) made from a shape no longer on the tab: offered for the Trash. */
export type RemovedCard = { send: PlanSend };

export type LaneMode = 'columns' | 'labels' | 'none';

export type MakeRow = {
  element: string;
  title: string;
  ticked: boolean;
  // Where it lands: a column (matched or not), a label, or the column picked.
  lands:
    | { kind: 'column'; name: string; matched: boolean }
    | { kind: 'label'; name: string }
    | { kind: 'picked' };
  start?: string;
  due?: string;
  // Ticked shapes it waits on.
  waits: number;
  // The live card it updates in this plan.
  updates: PlanSend | null;
};

export type MakePreview = {
  rows: MakeRow[];
  // Removed shapes' cards in this plan.
  removed: PlanSend[];
  made: number;
  updated: number;
  links: number;
  // Links left out because they would close a loop among the ticked shapes.
  loops: number;
  // Shapes past PLAN_MAKE_CARDS_MAX, never sent.
  cut: number;
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Lanes Become's starting choice: Columns when any lane is a column of the board, else Labels. */
export function defaultLaneMode(
  shapes: readonly MakeShape[],
  columns: readonly string[],
): LaneMode {
  const lanes = shapes.map((s) => s.lane).filter((l): l is string => !!l);
  if (lanes.length === 0) return 'none';
  return lanes.some((l) => columns.some((c) => same(c, l))) ? 'columns' : 'labels';
}

// Each shape's links kept: in order, a link dropped when its blocker already waits on the shape (a loop).
function keptLinks(shapes: readonly MakeShape[], ticked: ReadonlySet<string>) {
  const waitsOn = new Map<string, string[]>();
  let loops = 0;
  const reaches = (from: string, to: string) => {
    const seen = new Set([from]);
    const stack = [from];
    while (stack.length) {
      const at = stack.pop()!;
      if (at === to) return true;
      for (const n of waitsOn.get(at) ?? [])
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
    }
    return false;
  };
  for (const s of shapes) {
    if (!ticked.has(s.element)) continue;
    const mine: string[] = [];
    waitsOn.set(s.element, mine);
    for (const b of s.blockedBy) {
      if (!ticked.has(b) || b === s.element || mine.includes(b)) continue;
      if (reaches(b, s.element)) {
        loops += 1;
        continue;
      }
      mine.push(b);
    }
  }
  return { waitsOn, loops };
}

export function makePreview({
  shapes,
  ticked,
  laneMode,
  columns,
  planId,
  tabId,
  sends,
  removed,
}: {
  shapes: readonly MakeShape[];
  ticked: ReadonlySet<string>;
  laneMode: LaneMode;
  // The picked board's columns, by name.
  columns: readonly string[];
  planId: string | null;
  tabId: string;
  // The source's sends as its chips read them, and the removed shapes' cards.
  sends: readonly PlanSend[];
  removed: readonly RemovedCard[];
}): MakePreview {
  const kept = shapes.slice(0, PLAN_MAKE_CARDS_MAX);
  const live = new Map<string, PlanSend>();
  if (planId)
    for (const s of sends)
      if (s.plan.id === planId && s.kind === 'element' && !live.has(s.ref)) live.set(s.ref, s);
  const { waitsOn, loops } = keptLinks(kept, ticked);
  let made = 0;
  let updated = 0;
  let links = 0;
  const rows = kept.map((s): MakeRow => {
    const on = ticked.has(s.element);
    const ref = planSendRef({ kind: 'element', tabId, elementId: s.element, part: null });
    const updates = live.get(ref) ?? null;
    const waits = on ? (waitsOn.get(s.element)?.length ?? 0) : 0;
    if (on) {
      if (updates) updated += 1;
      else made += 1;
      links += waits;
    }
    const lands: MakeRow['lands'] =
      s.lane && laneMode === 'columns'
        ? { kind: 'column', name: s.lane, matched: columns.some((c) => same(c, s.lane!)) }
        : s.lane && laneMode === 'labels'
          ? { kind: 'label', name: s.lane.slice(0, PLAN_MAKE_LABEL_MAX).trim() }
          : { kind: 'picked' };
    return {
      element: s.element,
      title: s.title,
      ticked: on,
      lands,
      ...(s.start ? { start: s.start } : {}),
      ...(s.due ? { due: s.due } : {}),
      waits,
      updates,
    };
  });
  return {
    rows,
    removed: planId ? removed.filter((r) => r.send.plan.id === planId).map((r) => r.send) : [],
    made,
    updated,
    links,
    loops,
    cut: shapes.length - kept.length,
  };
}

/** The ask a preview sends: the ticked shapes as cards, their kept links, and the removed cards ticked for the Trash. */
export function makeAsk({
  shapes,
  ticked,
  removedTicked,
  laneMode,
  columns,
  board,
  column,
  source,
}: {
  shapes: readonly MakeShape[];
  ticked: ReadonlySet<string>;
  removedTicked: ReadonlySet<string>;
  laneMode: LaneMode;
  columns: readonly string[];
  board: string;
  column: string;
  source: PlanMakeAsk['source'];
}): PlanMakeAsk {
  const kept = shapes.slice(0, PLAN_MAKE_CARDS_MAX);
  const { waitsOn } = keptLinks(kept, ticked);
  const cards: PlanMakeCard[] = kept
    .filter((s) => ticked.has(s.element))
    .map((s) => {
      const lane = s.lane?.trim();
      const column =
        lane && laneMode === 'columns' ? columns.find((c) => same(c, lane)) : undefined;
      const label =
        lane && laneMode === 'labels' ? lane.slice(0, PLAN_MAKE_LABEL_MAX).trim() : undefined;
      const blockedBy = waitsOn.get(s.element) ?? [];
      return {
        element: s.element,
        title: s.title.slice(0, PLAN_MAKE_TITLE_MAX),
        text: s.text.slice(0, PLAN_MAKE_TEXT_MAX),
        ...(column ? { column } : {}),
        ...(label ? { labels: [label] } : {}),
        ...(s.start ? { start: s.start } : {}),
        ...(s.due ? { due: s.due } : {}),
        ...(blockedBy.length ? { blockedBy } : {}),
      };
    });
  const trash = [...removedTicked];
  return { board, column, source, cards, ...(trash.length ? { trash } : {}) };
}
