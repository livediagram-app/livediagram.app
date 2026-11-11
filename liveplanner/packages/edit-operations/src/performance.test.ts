// The engine's cost grows with the tab and the changeset, not faster
// (docs/specs/024-agents/blueprints/edit-operations.md "Performance and limits"). Timed as growth, not as
// a ceiling: an absolute time depends on the machine, a ratio barely, and coverage judges neither (docs/ci.md "Speed budgets").
// Timed in CPU time (cpuMsOf), not wall-clock: under turbo's parallel suites a wall-clock run also
// counts the time spent waiting for a core, which pushed the ratio past its ceiling.
// Four times the elements, or four times the operations, should cost about four times as much; a
// quadratic step would cost sixteen.
import { describe, expect, it } from 'vitest';
import { cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import type { Element, Tab } from '@liveplanner/project';
import { applyEditOperations } from './apply';
import { newView } from './fixtures/sprint-dashboard';
import { createState, noteTarget } from './state';
import { parseEditOperations } from './parse';
import type { EditOperation } from './types';

const GROWTH = 4;
const RATIO_CEILING = cpuRatioCeiling(8);
// The smaller tab of the per-element growth checks: 1,200 against 4,800, not 2,400 against 9,600, so the larger keeps
// the collector out of the timing (docs/ci.md "Speed budgets"); measured at 4.3 to 5.1 for four times the tab.
const SMALL_TAB = 1200;
const RUNS = 3;
// Fresh states a run of the noteTarget check fills, so it times a millisecond or more, not timer noise.
const NOTE_PASSES = 20;
// Sized to time tens of milliseconds an apply; coverage on a CI runner makes that seconds.
const TIMEOUT_MS = 30_000;

// A Dashboard of `count` views, each labelled, in rows of four, and in one of ten groups by its label.
function tabOf(count: number): Tab {
  const elements = Array.from(
    { length: count },
    (_, i) =>
      ({
        ...newView(`v${i}`, i % 2 ? 'workload' : 'calendar'),
        x: (i % 4) * 520,
        y: Math.floor(i / 4) * 380,
        label: `View ${i} in group ${i % 10}`,
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
      // A tenth of the views, whatever the tab's size. `View 1` matched 11 of 100 views and 111 of 400, so four
      // times the tab did ten times this work and the growth read up to 8.9 against 8.
      `set label~"group 1" textSize=sm all`,
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
    // One pass over 1,200 targets takes a fraction of a millisecond, so timer noise alone read 8.5 against 8 on CI: each
    // run notes the whole tab into NOTE_PASSES fresh states (made outside the timing), a millisecond or more.
    const fastest = (tab: Tab) => {
      let best = Infinity;
      for (let run = 0; run < RUNS; run++) {
        const states = Array.from({ length: NOTE_PASSES }, () => createState(tab, {}, () => {}));
        best = Math.min(
          best,
          cpuMsOf(() => {
            for (const state of states) for (const el of tab.elements) noteTarget(state, el.id);
          }),
        );
      }
      return best;
    };
    const small = fastest(tabOf(SMALL_TAB));
    const large = fastest(tabOf(SMALL_TAB * GROWTH));
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
