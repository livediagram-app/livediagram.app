// The canvas performance budget (docs/specs/008-canvas/canvas-performance.md "The budget"), as rules
// over what the probe measures, and the report it renders. Pure: the probe measures, this judges.

// docs/specs/008-canvas/blueprints/canvas-performance.md "Constants and configuration".
export const LONG_TASK_MS = 50;
export const DRAG_MEDIAN_FRAME_MS = 33;
export const SELECT_TASK_MS = 100;
export const OPEN_INTERACTIVE_MS = 3000;
// docs/specs/008-canvas/blueprints/DEFAULTS.md D66.
export const IDLE_WORK_MS = 5;

export type Gesture =
  | 'open'
  | 'idle'
  | 'pan'
  | 'zoom'
  | 'select'
  | 'drag'
  | 'deselect'
  | 'marquee'
  | 'stroke'
  | 'hover';

export type Measurement = {
  tab: 'whiteboard' | 'diagram';
  zoom: 'fit' | '100%';
  gesture: Gesture;
  longestTaskMs: number;
  medianFrameMs?: number;
  idleWorkMs?: number;
  openMs?: number;
};

export type BudgetRow = Measurement & { rule: string; measured: string; pass: boolean };

type Metric = 'longestTaskMs' | 'medianFrameMs' | 'idleWorkMs' | 'openMs';
type Limit = { metric: Metric; max: number; label: string };

const task = (max: number): Limit => ({ metric: 'longestTaskMs', max, label: 'longest task' });
const RULES: Record<Gesture, Limit[]> = {
  open: [{ metric: 'openMs', max: OPEN_INTERACTIVE_MS, label: 'interactive' }],
  idle: [{ metric: 'idleWorkMs', max: IDLE_WORK_MS, label: 'main-thread work' }],
  pan: [task(LONG_TASK_MS)],
  zoom: [task(LONG_TASK_MS)],
  marquee: [task(LONG_TASK_MS)],
  stroke: [task(LONG_TASK_MS)],
  hover: [task(LONG_TASK_MS)],
  drag: [
    task(LONG_TASK_MS),
    { metric: 'medianFrameMs', max: DRAG_MEDIAN_FRAME_MS, label: 'median frame' },
  ],
  select: [task(SELECT_TASK_MS)],
  deselect: [task(SELECT_TASK_MS)],
};

export function evaluateBudget(measurements: readonly Measurement[]): BudgetRow[] {
  return measurements.map((m) => {
    const limits = RULES[m.gesture];
    const values = limits.map((l) => {
      const v = m[l.metric];
      if (v === undefined) throw new Error(`MissingMetric: ${m.gesture}`);
      return v;
    });
    return {
      ...m,
      rule: limits.map((l) => `${l.label} ≤ ${l.max} ms`).join(', '),
      // Rounded up, so a value over its ceiling never reads as equal to it.
      measured: values.map((v) => `${Math.ceil(v)} ms`).join(', '),
      pass: limits.every((l, i) => values[i]! <= l.max),
    };
  });
}

export function budgetTable(rows: readonly BudgetRow[]): string {
  return [
    '| Tab | Zoom | Gesture | Rule | Measured | Verdict |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${r.tab} | ${r.zoom} | ${r.gesture} | ${r.rule} | ${r.measured} | ${r.pass ? 'pass' : '**fail**'} |`,
    ),
  ].join('\n');
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

// One row from repeated runs of the same gesture: each metric the median of the runs, since a single
// run of a gesture can read two to five times another (docs/specs/008-canvas/canvas-performance.md).
export function medianOfRuns(runs: readonly Measurement[]): Measurement {
  const [first] = runs;
  if (!first) throw new Error('NoRuns');
  if (runs.some((r) => r.tab !== first.tab || r.zoom !== first.zoom || r.gesture !== first.gesture))
    throw new Error('MixedRuns');
  const metric = (key: 'medianFrameMs' | 'idleWorkMs' | 'openMs') => {
    const values = runs.map((r) => r[key]).filter((v): v is number => v !== undefined);
    return values.length ? { [key]: median(values) } : {};
  };
  return {
    tab: first.tab,
    zoom: first.zoom,
    gesture: first.gesture,
    longestTaskMs: median(runs.map((r) => r.longestTaskMs)),
    ...metric('medianFrameMs'),
    ...metric('idleWorkMs'),
    ...metric('openMs'),
  };
}
