import { describe, expect, it } from 'vitest';
import { mainThreadTasks, type TraceEvent } from './trace-tasks';

// docs/instructions/trace-a-canvas-gesture.md: a gesture's cost is its tasks on the renderer's main
// thread, not the compositor's or the raster workers'.

const meta = (pid: number, tid: number, name: string): TraceEvent => ({
  name: 'thread_name',
  ph: 'M',
  pid,
  tid,
  args: { name },
});
const task = (pid: number, tid: number, dur: number): TraceEvent => ({
  name: 'RunTask',
  ph: 'X',
  pid,
  tid,
  ts: 0,
  dur: dur * 1000,
});

describe('mainThreadTasks', () => {
  it("keeps the renderer main thread's tasks, in ms", () => {
    const events = [
      meta(1, 10, 'CrRendererMain'),
      meta(1, 11, 'Compositor'),
      meta(2, 20, 'CrBrowserMain'),
      task(1, 10, 12.5),
      task(1, 11, 90),
      task(2, 20, 70),
      task(1, 10, 61),
    ];
    expect(mainThreadTasks(events)).toEqual([12.5, 61]);
  });

  it('finds no tasks without a renderer main thread', () => {
    expect(mainThreadTasks([task(1, 10, 5)])).toEqual([]);
  });
});
