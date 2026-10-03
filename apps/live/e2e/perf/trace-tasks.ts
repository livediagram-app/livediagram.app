// A gesture's main-thread tasks from a devtools.timeline trace (docs/instructions/trace-a-canvas-gesture.md):
// the renderer's main thread alone, since compositor and raster work runs beside it, not in the way
// of input.

export type TraceEvent = {
  name: string;
  ph?: string;
  pid: number;
  tid: number;
  ts?: number;
  dur?: number;
  args?: { name?: string; data?: { url?: string } };
};

// The probe's own browser commands (Playwright evaluating in the page at a window's edges) run as a
// script with no URL; every script the page itself runs, inline or loaded, carries one. A task that
// only does that is the probe's, not the board's: on a slow runner it read 20 ms a time.
const isProbeScript = (e: TraceEvent) => e.name === 'EvaluateScript' && !e.args?.data?.url;

/** The duration, in ms, of every task the renderer's main thread ran for the page. */
export function mainThreadTasks(events: readonly TraceEvent[]): number[] {
  const main = new Set(
    events
      .filter((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain')
      .map((e) => `${e.pid}:${e.tid}`),
  );
  const timed = events
    .filter((e) => main.has(`${e.pid}:${e.tid}`) && e.dur !== undefined)
    .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0) || b.dur! - a.dur!);
  // Tasks on one thread never overlap, so one sweep assigns each piece of work to the task around it,
  // tracking the outermost pieces (those not inside an earlier, longer one).
  const out: number[] = [];
  let task: TraceEvent | null = null;
  let taskEnd = 0;
  let outerEnd = 0;
  let onlyProbe = true;
  let anyWork = false;
  const close = () => {
    if (task && !(anyWork && onlyProbe)) out.push(task.dur! / 1000);
    task = null;
  };
  for (const e of timed) {
    const start = e.ts ?? 0;
    if (e.name === 'RunTask') {
      close();
      task = e;
      taskEnd = start + e.dur!;
      outerEnd = start;
      onlyProbe = true;
      anyWork = false;
      continue;
    }
    if (!task || start + e.dur! > taskEnd) continue;
    if (start >= outerEnd) {
      anyWork = true;
      if (!isProbeScript(e)) onlyProbe = false;
      outerEnd = start + e.dur!;
    }
  }
  close();
  return out;
}
