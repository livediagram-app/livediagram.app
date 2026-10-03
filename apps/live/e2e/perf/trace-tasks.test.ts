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
      { ...task(1, 10, 61), ts: 50_000 },
    ];
    expect(mainThreadTasks(events)).toEqual([12.5, 61]);
  });

  it('finds no tasks without a renderer main thread', () => {
    expect(mainThreadTasks([task(1, 10, 5)])).toEqual([]);
  });
});

// A still board on a slow runner read 40-49 ms of work: the probe's own commands (Playwright's
// evaluations at the window's edges), which carry no script URL. Page scripts and loaded chunks do.
describe("mainThreadTasks and the probe's own scripts", () => {
  const child = (
    name: string,
    ts: number,
    dur: number,
    data: Record<string, unknown> = {},
  ): TraceEvent =>
    ({
      name,
      ph: 'X',
      pid: 1,
      tid: 10,
      ts: ts * 1000,
      dur: dur * 1000,
      args: { data },
    }) as TraceEvent;
  const at = (ts: number, dur: number): TraceEvent => ({ ...task(1, 10, dur), ts: ts * 1000 });

  it('leaves out a task that only evaluates a script with no URL', () => {
    const events = [meta(1, 10, 'CrRendererMain'), at(0, 20), child('EvaluateScript', 0.1, 19.5)];
    expect(mainThreadTasks(events)).toEqual([]);
  });

  it('keeps a script the page loaded, and a task with other work in it', () => {
    const events = [
      meta(1, 10, 'CrRendererMain'),
      at(0, 30),
      child('EvaluateScript', 0.1, 29, { url: 'http://localhost/live/_next/static/chunks/a.js' }),
      at(100, 12),
      child('FunctionCall', 100.5, 11),
    ];
    expect(mainThreadTasks(events)).toEqual([30, 12]);
  });
});
