// The engine's cost grows with the tab and the changeset, not faster
// (docs/specs/024-agents/blueprints/edit-operations.md "Performance and limits"). Timed as growth, not as
// a ceiling: an absolute time depends on the machine, a ratio barely, and coverage judges neither (docs/ci.md "Speed budgets").
// Timed in CPU time (cpuMsOf), not wall-clock: under turbo's parallel suites a wall-clock run also
// counts the time spent waiting for a core, which pushed the ratio past its ceiling.
// Four times the elements, or four times the operations, should cost about four times as much; a
// quadratic step would cost sixteen.
import { describe, expect, it } from 'vitest';
import { cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import type { Element, Tab } from '@livehuddle/document';
import { applyEditOperations } from './apply';
import { createState, noteTarget } from './state';
import { parseEditOperations } from './parse';
import type { EditOperation } from './types';

const FRAMES = 10;
const GROWTH = 4;
const RATIO_CEILING = cpuRatioCeiling(8);
// The smaller tab of the per-element growth checks: 1,200 against 4,800, not 2,400 against 9,600, so the larger keeps
// the collector out of the timing (docs/ci.md "Speed budgets"); measured at 4.3 to 5.1 for four times the tab.
const SMALL_TAB = 1200;
// Fastest of five: a run takes a few milliseconds now, so one garbage collection in three runs moved a ratio.
const RUNS = 5;
// Sized to time tens of milliseconds an apply; coverage on a CI runner makes that seconds.
const TIMEOUT_MS = 30_000;

// `FRAMES` stored boundaries (a retired kind, docs/specs/002-project-scope/not-in-livehuddle.md "The element engine",
// part 3), each behind `perFrame` boxes in a column joined by arrows.
function tabOf(perFrame: number): Tab {
  const elements: Element[] = [];
  for (let frame = 0; frame < FRAMES; frame++) {
    const fx = frame * 1000;
    elements.push({
      id: `f${frame}`,
      type: 'shape',
      shape: 'boundary',
      x: fx,
      y: 0,
      width: 400,
      height: perFrame * 100 + 100,
    } as unknown as Element);
    for (let i = 0; i < perFrame; i++) {
      elements.push({
        id: `n${frame}x${i}`,
        type: 'shape',
        shape: 'signpost',
        label: `Step ${frame} ${i}`,
        x: fx + 40,
        y: i * 100 + 60,
        width: 140,
        height: 60,
      });
      if (i > 0)
        elements.push({
          id: `a${frame}x${i}`,
          type: 'arrow',
          from: { kind: 'pinned', elementId: `n${frame}x${i - 1}`, anchor: 's' },
          to: { kind: 'pinned', elementId: `n${frame}x${i}`, anchor: 'n' },
        });
    }
  }
  return { id: 'growth', name: 'Growth', elements };
}

// A changeset touching every frame with every kind of operation, `rounds` times over.
function changesetOf(rounds: number): EditOperation[] {
  const lines: string[] = [];
  for (let r = 0; r < rounds; r++) {
    const frame = r % FRAMES;
    lines.push(
      `set n${frame}x${r} label="Renamed ${r}"`,
      `add sticky id=s${r} label="Note ${r}" right-of:n${frame}x${r}`,
      `order s${r} back`,
      `layout s${r} n${frame}x${r}`,
      `move s${r} by=10,0`,
      `test n${frame}x${r} label="Renamed ${r}"`,
    );
  }
  const parsed = parseEditOperations(lines.join('\n'));
  if ('errors' in parsed) throw new Error(parsed.errors[0]!.details.join('\n'));
  return parsed.operations;
}

function fastestApply(tab: Tab, operations: readonly EditOperation[]): number {
  let fastest = Infinity;
  for (let run = 0; run < RUNS; run++) {
    let outcome: ReturnType<typeof applyEditOperations> | undefined;
    fastest = Math.min(
      fastest,
      cpuMsOf(() => (outcome = applyEditOperations(tab, operations))),
    );
    expect(outcome).not.toHaveProperty('errors');
  }
  return fastest;
}

// One row of `count` boxes side by side: a box placed right of the first walks past every one.
function rowOf(count: number): Tab {
  const elements: Element[] = Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    type: 'shape',
    shape: 'signpost',
    x: i * 150,
    y: 0,
    width: 140,
    height: 60,
  }));
  return { id: 'row', name: 'Row', elements };
}

// `count` small boxes in rows.
function boxesOf(count: number): Tab {
  const columns = 100;
  const elements: Element[] = [];
  for (let i = 0; i < count; i++)
    elements.push({
      id: `b${i}`,
      type: 'shape',
      shape: 'signpost',
      x: 10 + (i % columns) * 200,
      y: 10 + Math.floor(i / columns) * 15,
      width: 10,
      height: 10,
    });
  return { id: 'boxes', name: 'Boxes', elements };
}

describe('performance', () => {
  // Noting each resolved target once searched the targets so far (`includes`): quadratic in a `set … all`.
  it('notes targets in time linear in their number', { timeout: TIMEOUT_MS }, () => {
    const fastest = (tab: Tab) => {
      let best = Infinity;
      for (let run = 0; run < RUNS; run++) {
        const state = createState(tab, {}, () => {});
        best = Math.min(
          best,
          cpuMsOf(() => {
            for (const el of tab.elements) noteTarget(state, el.id);
          }),
        );
      }
      return best;
    };
    const small = fastest(boxesOf(SMALL_TAB));
    const large = fastest(boxesOf(SMALL_TAB * GROWTH));
    expect(large / small).toBeLessThan(RATIO_CEILING);
  });

  it('walks past a row of boxes in time linear in the row', { timeout: TIMEOUT_MS }, () => {
    const add = parseEditOperations('add signpost right-of:r0 gap:0');
    if ('errors' in add) throw new Error('add');
    // A row of 1,000: at 500 the small apply was so quick that timer noise reached the ceiling (9.2 against 8).
    const small = fastestApply(rowOf(1000), add.operations);
    const large = fastestApply(rowOf(1000 * GROWTH), add.operations);
    expect(large / small).toBeLessThan(RATIO_CEILING);
  });

  it('grows about linearly with the tab', { timeout: TIMEOUT_MS }, () => {
    const operations = changesetOf(10);
    const small = fastestApply(tabOf(25), operations);
    const large = fastestApply(tabOf(25 * GROWTH), operations);
    expect(large / small).toBeLessThan(RATIO_CEILING);
  });

  it('grows about linearly with the changeset', { timeout: TIMEOUT_MS }, () => {
    const tab = tabOf(100);
    const small = fastestApply(tab, changesetOf(5));
    const large = fastestApply(tab, changesetOf(5 * GROWTH));
    expect(large / small).toBeLessThan(RATIO_CEILING);
  });
});
