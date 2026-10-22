// The engine's invariants (docs/specs/024-agents/blueprints/edit-operations.md "Behaviour and state",
// I1 to I7), held by one changeset per operation of the vocabulary on the Sprint 14 Dashboard.

import { describe, expect, it } from 'vitest';
import { applyElementOps, type Tab } from '@liveplanner/project';
import { newView, sprintDashboard } from './fixtures/sprint-dashboard';
import { applied } from './fixtures/outcomes';
import { addLine, dashboardWith, run } from './fixtures/run';
import { EDIT_OPERATION_NAMES } from './vocabulary';

const SAMPLES: Readonly<Record<(typeof EDIT_OPERATION_NAMES)[number], string>> = {
  add: addLine(newView('g1', 'gantt')),
  set: 'set w1 planView={"view":"priority-matrix"} label=Priorities',
  rm: 'rm m3',
  test: 'test w1 label=Workload',
};

const samples = Object.entries(SAMPLES);
const frozen = (tab: Tab) => JSON.parse(JSON.stringify(tab)) as Tab;

describe('invariants', () => {
  it('has a sample for every operation', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...EDIT_OPERATION_NAMES].sort());
  });

  it.each(samples)(
    '%s: a rejected changeset carries no tab and the input is untouched (I1)',
    (_, text) => {
      const tab = sprintDashboard();
      const outcome = run(`${text}\ntest m1 label=Nope`, tab);
      expect(outcome).not.toHaveProperty('tab');
      expect(tab).toEqual(frozen(sprintDashboard()));
    },
  );

  it.each(samples)(
    '%s: the input tab is never mutated, and what stayed is the same object (I1, I2)',
    (_, text) => {
      const tab = sprintDashboard();
      const { tab: next } = applied(run(text, tab));
      expect(tab).toEqual(frozen(sprintDashboard()));
      const before = new Map(tab.elements.map((el) => [el.id, el]));
      for (const el of next.elements) {
        const was = before.get(el.id);
        if (was && JSON.stringify(was) === JSON.stringify(el)) expect(el).toBe(was);
      }
    },
  );

  it.each(samples)('%s: element ops and their inverse round trip (I4)', (_, text) => {
    const tab = sprintDashboard();
    const { tab: next, elementOps, inverse } = applied(run(text, tab));
    expect(applyElementOps(tab.elements, elementOps)).toEqual(next.elements);
    expect(applyElementOps(next.elements, inverse)).toEqual(tab.elements);
  });

  it.each(samples)('%s: the same input gives the same outcome (I5)', (_, text) => {
    expect(run(text)).toEqual(run(text));
  });

  it.each(samples)('%s: no locked element changes (I7)', (_, text) => {
    for (const id of sprintDashboard().elements.map((el) => el.id)) {
      const tab = dashboardWith((el) => (el.id === id ? { ...el, locked: true } : el));
      const outcome = run(text, tab);
      if ('errors' in outcome) {
        expect(outcome.errors[0]!.code).toBe('element_locked');
        continue;
      }
      const lockedBefore = tab.elements.find((el) => el.id === id);
      expect(outcome.tab.elements.find((el) => el.id === id)).toEqual(lockedBefore);
    }
  });
});
