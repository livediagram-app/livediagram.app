// The engine's cost grows with the tab and the changeset, not faster
// (docs/specs/024-agents/blueprints/edit-operations.md "Performance and limits"). Timed as growth, not as
// a ceiling: an absolute time depends on the machine and on coverage instrumentation, a ratio does not.
// Timed in CPU time (cpuMsOf), not wall-clock: under turbo's parallel suites a wall-clock run also
// counts the time spent waiting for a core, which pushed the ratio past its ceiling.
// Four times the elements, or four times the operations, should cost about four times as much; a
// quadratic step would cost sixteen.
import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import type { Element, Tab } from '@livediagram/document';
import { applyEditOperations } from './apply';
import { parseEditOperations } from './parse';
import type { EditOperation } from './types';

const FRAMES = 10;
const GROWTH = 4;
const RATIO_CEILING = 8;
const RUNS = 3;
// Sized to time tens of milliseconds an apply; coverage on a CI runner makes that seconds.
const TIMEOUT_MS = 30_000;

// `FRAMES` frames, each holding `perFrame` boxes in a column joined by arrows.
function tabOf(perFrame: number): Tab {
  const elements: Element[] = [];
  for (let frame = 0; frame < FRAMES; frame++) {
    const fx = frame * 1000;
    elements.push({
      id: `f${frame}`,
      type: 'shape',
      shape: 'frame',
      x: fx,
      y: 0,
      width: 400,
      height: perFrame * 100 + 100,
    });
    for (let i = 0; i < perFrame; i++) {
      elements.push({
        id: `n${frame}x${i}`,
        type: 'shape',
        shape: 'square',
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
      `connect n${frame}x${r} -> s${r}`,
      `insert square id=i${r} between n${frame}x${r + 1} n${frame}x${r + 2}`,
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
    shape: 'square',
    x: i * 150,
    y: 0,
    width: 140,
    height: 60,
  }));
  return { id: 'row', name: 'Row', elements };
}

describe('performance', () => {
  it('walks past a row of boxes in time linear in the row', { timeout: TIMEOUT_MS }, () => {
    const add = parseEditOperations('add square right-of:r0 gap:0');
    if ('errors' in add) throw new Error('add');
    const small = fastestApply(rowOf(500), add.operations);
    const large = fastestApply(rowOf(500 * GROWTH), add.operations);
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
