// The engine's cost grows with the tab and the changeset, not faster
// (docs/specs/024-agents/blueprints/edit-operations.md "Performance and limits"). Timed as growth, not as
// a ceiling: an absolute time depends on the machine and on coverage instrumentation, a ratio does not.
// Timed in CPU time (cpuMsOf), not wall-clock: under turbo's parallel suites a wall-clock run also
// counts the time spent waiting for a core, which pushed the ratio past its ceiling.
// Four times the elements, or four times the operations, should cost about four times as much; a
// quadratic step would cost sixteen.
import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@liveplanner/vitest-config/cpu-time';
import type { Element, Tab } from '@liveplanner/project';
import { applyEditOperations } from './apply';
import { newView } from './fixtures/sprint-dashboard';
import { createState, noteTarget } from './state';
import { parseEditOperations } from './parse';
import type { EditOperation } from './types';

const GROWTH = 4;
const RATIO_CEILING = 8;
const RUNS = 3;
// Sized to time tens of milliseconds an apply; coverage on a CI runner makes that seconds.
const TIMEOUT_MS = 30_000;

// A Dashboard of `count` views, each labelled, in rows of four.
function tabOf(count: number): Tab {
  const elements = Array.from(
    { length: count },
    (_, i) =>
      ({
        ...newView(`v${i}`, i % 2 ? 'workload' : 'calendar'),
        x: (i % 4) * 520,
        y: Math.floor(i / 4) * 380,
        label: `View ${i}`,
      }) as unknown as Element,
  );
  return { id: 'growth', name: 'Growth', kind: 'dashboard', elements };
}

// A changeset touching the views with every kind of operation, `rounds` times over.
function changesetOf(rounds: number): EditOperation[] {
  const lines: string[] = [];
  for (let r = 0; r < rounds; r++) {
    lines.push(
      `set v${r} label="Renamed ${r}" textSize=lg`,
      JSON.stringify({ op: 'add', element: newView(`n${r}`, 'gantt') }),
      `test v${r} label="Renamed ${r}"`,
      `set label~"View 1" textSize=sm all`,
      `rm n${r}`,
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
    const small = fastest(tabOf(2400));
    const large = fastest(tabOf(2400 * GROWTH));
    expect(large / small).toBeLessThan(RATIO_CEILING);
  });

  it('grows about linearly with the tab', { timeout: TIMEOUT_MS }, () => {
    const operations = changesetOf(10);
    const small = fastestApply(tabOf(100), operations);
    const large = fastestApply(tabOf(100 * GROWTH), operations);
    expect(large / small).toBeLessThan(RATIO_CEILING);
  });

  it('grows about linearly with the changeset', { timeout: TIMEOUT_MS }, () => {
    const tab = tabOf(400);
    const small = fastestApply(tab, changesetOf(5));
    const large = fastestApply(tab, changesetOf(5 * GROWTH));
    expect(large / small).toBeLessThan(RATIO_CEILING);
  });
});
