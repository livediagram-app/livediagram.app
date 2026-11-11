// The engine's cost grows with the tab and the changeset, not faster
// (docs/specs/024-agents/blueprints/edit-operations.md "Performance and limits"). Timed as growth, not as
// a ceiling: an absolute time depends on the machine, a ratio barely, and coverage judges neither (docs/ci.md "Speed budgets").
// Timed in CPU time (cpuMsOf), not wall-clock: under turbo's parallel suites a wall-clock run also
// counts the time spent waiting for a core, which pushed the ratio past its ceiling.
// Four times the elements, or four times the operations, should cost about four times as much; a
// quadratic step would cost sixteen.
import { describe, expect, it } from 'vitest';
import { cpuGrowthRatio, cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import type { Element, Tab } from '@livedocuments/document';
import { applyEditOperations } from './apply';
import { containersBehindMembers } from './finalise';
import { createState, noteTarget } from './state';
import { parseEditOperations } from './parse';
import type { EditOperation } from './types';

const FRAMES = 10;
const GROWTH = 4;
const RATIO_CEILING = cpuRatioCeiling(8);
// The smaller tab of the per-element growth checks: 1,200 against 4,800, not 2,400 against 9,600, so the larger keeps
// the collector out of the timing (docs/ci.md "Speed budgets"); measured at 4.3 to 5.1 for four times the tab.
const SMALL_TAB = 1200;
// Fresh states a sample of the noteTarget check fills, so it times a millisecond or more, not timer noise.
const NOTE_PASSES = 20;
// Sized to time tens of milliseconds an apply; coverage on a CI runner makes that seconds.
const TIMEOUT_MS = 30_000;

// `FRAMES` stacks, each holding `perFrame` boxes in a column joined by arrows.
function tabOf(perFrame: number): Tab {
  const elements: Element[] = [];
  for (let frame = 0; frame < FRAMES; frame++) {
    const fx = frame * 1000;
    elements.push({
      id: `f${frame}`,
      type: 'shape',
      shape: 'stack',
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

// A changeset touching every stack with every kind of operation, `rounds` times over.
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

// One stack holding `count` boxes: a container with every element as its member.
function frameOf(count: number): Tab {
  const columns = 100;
  const elements: Element[] = [
    {
      id: 'f0',
      type: 'shape',
      shape: 'stack',
      x: 0,
      y: 0,
      width: columns * 200 + 20,
      height: 4000,
    },
  ];
  for (let i = 0; i < count; i++)
    elements.push({
      id: `b${i}`,
      type: 'shape',
      shape: 'square',
      x: 10 + (i % columns) * 200,
      y: 10 + Math.floor(i / columns) * 15,
      width: 10,
      height: 10,
    });
  return { id: 'frame', name: 'Frame', elements };
}

describe('performance', () => {
  // The container order pass once scanned the order per member and copied the member list per member: 157 ms
  // of a one-field set at 10,000 members, now 19 ms. Timed alone, so the rest of an apply does not hide it.
  it(
    'orders containers behind their members in time linear in the tab',
    { timeout: TIMEOUT_MS },
    () => {
      // Five orderings a sample, both tabs warmed and then timed in turns (cpuGrowthRatio): one ordering of the
      // smaller tab takes under a millisecond, and timed one tab after the other the growth read 1.3 to 8.3.
      const sample = (tab: Tab) =>
        cpuMsOf(() => {
          for (let k = 0; k < 5; k++) containersBehindMembers(tab.elements);
        });
      const smallTab = frameOf(SMALL_TAB);
      const largeTab = frameOf(SMALL_TAB * GROWTH);
      expectLinear(
        () => sample(smallTab),
        () => sample(largeTab),
      );
    },
  );

  // Noting each resolved target once searched the targets so far (`includes`): quadratic in a `set … all`.
  it('notes targets in time linear in their number', { timeout: TIMEOUT_MS }, () => {
    // One pass over the tab takes a fraction of a millisecond: each sample notes it into NOTE_PASSES fresh states
    // (made outside the timing), timed in turns with the larger tab (cpuGrowthRatio). liveplanner's copy, timed
    // one tab after the other, read 8.86 against 8 on CI (2026-11-11).
    const sample = (tab: Tab) => () => {
      const states = Array.from({ length: NOTE_PASSES }, () => createState(tab, {}, () => {}));
      return cpuMsOf(() => {
        for (const state of states) for (const el of tab.elements) noteTarget(state, el.id);
      });
    };
    expectLinear(sample(frameOf(SMALL_TAB)), sample(frameOf(SMALL_TAB * GROWTH)));
  });

  it('walks past a row of boxes in time linear in the row', { timeout: TIMEOUT_MS }, () => {
    const add = parseEditOperations('add square right-of:r0 gap:0');
    if ('errors' in add) throw new Error('add');
    const small = { tab: rowOf(500), operations: add.operations };
    const large = { tab: rowOf(500 * GROWTH), operations: add.operations };
    expectLinear(
      () => applyMs(small.tab, small.operations),
      () => applyMs(large.tab, large.operations),
    );
  });

  it('grows about linearly with the tab', { timeout: TIMEOUT_MS }, () => {
    const operations = changesetOf(10);
    const small = { tab: tabOf(25), operations };
    const large = { tab: tabOf(25 * GROWTH), operations };
    expectLinear(
      () => applyMs(small.tab, small.operations),
      () => applyMs(large.tab, large.operations),
    );
  });

  it('grows about linearly with the changeset', { timeout: TIMEOUT_MS }, () => {
    const tab = tabOf(100);
    const small = { tab, operations: changesetOf(5) };
    const large = { tab, operations: changesetOf(5 * GROWTH) };
    expectLinear(
      () => applyMs(small.tab, small.operations),
      () => applyMs(large.tab, large.operations),
    );
  });
});
