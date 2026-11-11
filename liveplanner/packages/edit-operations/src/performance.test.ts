// The engine's cost grows with the tab and the changeset, not faster
// (docs/specs/024-agents/blueprints/edit-operations.md "Performance and limits"). Timed as growth, not as
// a ceiling: an absolute time depends on the machine, a ratio barely, and coverage judges neither (docs/ci.md "Speed budgets").
// Timed in CPU time (cpuMsOf), not wall-clock: under turbo's parallel suites a wall-clock run also
// counts the time spent waiting for a core, which pushed the ratio past its ceiling.
// Four times the elements, or four times the operations, should cost about four times as much; a
// quadratic step would cost sixteen.
import { describe, expect, it } from 'vitest';
import { cpuGrowthRatio, cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import type { Element, Tab } from '@liveplanner/project';
import { applyEditOperations } from './apply';
import { newView } from './fixtures/sprint-dashboard';
import { createState, noteTarget } from './state';
import { parseEditOperations } from './parse';
import type { EditOperation } from './types';

const GROWTH = 4;
const RATIO_CEILING = cpuRatioCeiling(8);
// The noteTarget check's smaller tab and the fresh states a sample fills, one at a time: 600 against 2,400, 40
// states, a millisecond or more a sample. Twenty states of 4,800 held at once outgrew a CI runner's cache, and four
// times the tab read 8.52 against 8 on main (2026-11-11) for work that is one Set lookup an element; these read 4.2
// to 5.0 here, beside two more runs of the same suite.
const NOTE_TAB = 600;
const NOTE_PASSES = 40;
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

// One apply's CPU time: a sample for cpuGrowthRatio, which warms each size and times the two in turns.
function applyMs(tab: Tab, operations: readonly EditOperation[]): number {
  let outcome: ReturnType<typeof applyEditOperations> | undefined;
  const ms = cpuMsOf(() => (outcome = applyEditOperations(tab, operations)));
  expect(outcome).not.toHaveProperty('errors');
  return ms;
}

// The growth from `small` to `large` (each one sample's CPU time), held under the ceiling.
function expectLinear(small: () => number, large: () => number): void {
  expect(cpuGrowthRatio(small, large, { ceiling: RATIO_CEILING })).toBeLessThan(RATIO_CEILING);
}

describe('performance', () => {
  // Noting each resolved target once searched the targets so far (`includes`): quadratic in a `set … all`.
  it('notes targets in time linear in their number', { timeout: TIMEOUT_MS }, () => {
    // One pass over the targets takes a fraction of a millisecond, so a sample sums NOTE_PASSES passes, each into a
    // fresh state made outside its timing; cpuGrowthRatio warms both sizes and times them in turns.
    const sample = (tab: Tab) => () => {
      let ms = 0;
      for (let pass = 0; pass < NOTE_PASSES; pass++) {
        const state = createState(tab, {}, () => {});
        ms += cpuMsOf(() => {
          for (const el of tab.elements) noteTarget(state, el.id);
        });
      }
      return ms;
    };
    expectLinear(sample(tabOf(NOTE_TAB)), sample(tabOf(NOTE_TAB * GROWTH)));
  });

  it('grows about linearly with the tab', { timeout: TIMEOUT_MS }, () => {
    const operations = changesetOf(10);
    const small = tabOf(100);
    const large = tabOf(100 * GROWTH);
    expectLinear(
      () => applyMs(small, operations),
      () => applyMs(large, operations),
    );
  });

  it('grows about linearly with the changeset', { timeout: TIMEOUT_MS }, () => {
    const tab = tabOf(400);
    const small = changesetOf(5);
    const large = changesetOf(5 * GROWTH);
    expectLinear(
      () => applyMs(tab, small),
      () => applyMs(tab, large),
    );
  });
});
