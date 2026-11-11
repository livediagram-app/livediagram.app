// The engine's cost grows with the tab and the changeset, not faster
// (docs/specs/024-agents/blueprints/edit-operations.md "Performance and limits"). Timed as growth, not as
// a ceiling: an absolute time depends on the machine, a ratio barely, and coverage judges neither (docs/ci.md "Speed budgets").
// Timed in CPU time (cpuMsOf), not wall-clock: under turbo's parallel suites a wall-clock run also
// counts the time spent waiting for a core, which pushed the ratio past its ceiling.
// Four times the elements, or four times the operations, should cost about four times as much; a
// quadratic step would cost sixteen.
import { describe, expect, it } from 'vitest';
import { cpuGrowthRatio, cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import type { Element, Tab } from '@livehuddle/document';
import { applyEditOperations } from './apply';
import { createState, noteTarget } from './state';
import { parseEditOperations } from './parse';
import type { EditOperation } from './types';

const FRAMES = 10;
const GROWTH = 4;
const RATIO_CEILING = cpuRatioCeiling(8);
// The noteTarget check's smaller tab and the fresh states a sample fills, one at a time: 600 against 2,400, 40
// states, a millisecond or more a sample. Twenty states of 4,800 held at once outgrew a CI runner's cache, and four
// times the tab read 8.52 (liveplanner) and 9.43 (livedocuments) against 8 on CI (2026-11-11) for work that is one Set
// lookup an element; liveplanner's copy now reads 4.2 to 5.0 beside two more runs of the same suite.
const NOTE_TAB = 600;
const NOTE_PASSES = 40;
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

// `count` small boxes in rows.
function boxesOf(count: number): Tab {
  const columns = 100;
  const elements: Element[] = [];
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
  return { id: 'boxes', name: 'Boxes', elements };
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
    expectLinear(sample(boxesOf(NOTE_TAB)), sample(boxesOf(NOTE_TAB * GROWTH)));
  });

  it('walks past a row of boxes in time linear in the row', { timeout: TIMEOUT_MS }, () => {
    const add = parseEditOperations('add square right-of:r0 gap:0');
    if ('errors' in add) throw new Error('add');
    // A row of 1,000: at 500 the small apply was so quick that timer noise reached the ceiling (9.2 against 8).
    const small = { tab: rowOf(1000), operations: add.operations };
    const large = { tab: rowOf(1000 * GROWTH), operations: add.operations };
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
