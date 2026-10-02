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
  args?: { name?: string };
};

/** The duration, in ms, of every task the renderer's main thread ran. */
export function mainThreadTasks(events: readonly TraceEvent[]): number[] {
  const main = new Set(
    events
      .filter((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain')
      .map((e) => `${e.pid}:${e.tid}`),
  );
  return events
    .filter((e) => e.name === 'RunTask' && e.dur !== undefined && main.has(`${e.pid}:${e.tid}`))
    .map((e) => e.dur! / 1000);
}
