import { describe, expect, it } from 'vitest';
import type { EditRejection } from '@liveplanner/api-schema';
import type { Element, Tab } from '@liveplanner/project';
import { refused } from './fixtures/outcomes';
import { elementOf, run } from './fixtures/run';
import { fixedIds, newView, sprintDashboard } from './fixtures/sprint-dashboard';
import { formatRejections } from './rejections';
import { parseSelector, resolveOne, resolveSelector, resolveSome } from './selectors';
import { createState, putElement, type EditState } from './state';
import type { ApplyOptions } from './types';

const stateOf = (tab: Tab = sprintDashboard(), options: ApplyOptions = {}): EditState =>
  createState(tab, { makeId: fixedIds(), ...options }, () => {});
const ids = (selector: string, state = stateOf()) => {
  const out = resolveSelector(state, selector, 1);
  if ('rejection' in out) throw new Error(formatRejections([out.rejection]).join('\n'));
  return out.els.map((el) => el.id);
};
const refusal = (selector: string, state = stateOf()): EditRejection => {
  const out = resolveSelector(state, selector, 1);
  if (!('rejection' in out))
    throw new Error(`expected a refusal, got ${out.els.map((el) => el.id).join(', ')}`);
  return out.rejection;
};
const view = (id: string, label: string, y = 900): Element =>
  ({ ...newView(id, 'workload'), y, label }) as unknown as Element;
const withElements = (...extra: Element[]): Tab => {
  const tab = sprintDashboard();
  return { ...tab, elements: [...tab.elements, ...extra] };
};

describe('selector rows', () => {
  it('a ref, any unique prefix or the id', () => {
    expect(ids('w1')).toEqual(['w1']);
    const tab = withElements(view('7f3a2c91-0000-4000-8000-000000000001', 'Idea'));
    expect(ids('7f3a', stateOf(tab))).toEqual(['7f3a2c91-0000-4000-8000-000000000001']);
    expect(ids('7f', stateOf(tab))).toEqual(['7f3a2c91-0000-4000-8000-000000000001']);
  });

  it('the always-safe id:"" form the views print for an id that is not a plain word', () => {
    const tab = withElements(view('selected', 'Old'), view('a b', 'Spaced'));
    expect(ids('id:"selected"', stateOf(tab))).toEqual(['selected']);
    expect(ids('id:"a b"', stateOf(tab))).toEqual(['a b']);
    expect(ids('id:"w1" type:plan-view')).toEqual(['w1']);
    expect(ids('id:"gone"')).toEqual([]);
  });

  it('a quoted label, ignoring case and outer space; label~ for part of one', () => {
    expect(ids('"workload"')).toEqual(['w1']);
    expect(ids('" Due Dates "')).toEqual(['c1']);
    expect(ids('label~o')).toEqual(['m2', 'w1']);
    expect(ids('LABEL~Budget')).toEqual(['b1']);
  });

  it('type: by kind word or element type', () => {
    expect(ids('type:bar-chart')).toEqual(['b1']);
    // An exact id another term has already ruled out keeps nothing.
    expect(ids('type:bar-chart w1')).toEqual([]);
    expect(ids('type:plan-view')).toEqual(['m1', 'm2', 'm3', 'm4', 'w1', 'c1']);
    expect(ids('Type:shape')).toHaveLength(7);
  });

  it("selected: the owner's selection", () => {
    expect(ids('selected', stateOf(sprintDashboard(), { selected: ['w1', 'gone', 'c1'] }))).toEqual(
      ['w1', 'c1'],
    );
    expect(refusal('selected', stateOf(sprintDashboard(), { selected: [] })).details[0]).toBe(
      'nothing is selected',
    );
    expect(refusal('selected', stateOf(sprintDashboard(), { selected: null })).details[0]).toBe(
      'the selection could not be read',
    );
    expect(refusal('selected', stateOf()).details[0]).toBe('nothing is selected');
  });

  it('every term must match', () => {
    expect(ids('type:plan-view label~o')).toEqual(['m2', 'w1']);
    expect(ids('w1 type:bar-chart')).toEqual([]);
    expect(ids('type:plan-view w1')).toEqual(['w1']);
  });
});

describe('selector refusals', () => {
  it('reads what does not parse as a parse error naming the selector', () => {
    expect(
      ['in:f2', 'type:', 'type:a,b', 'all', '"open', ''].map((s) => refusal(s).details[0]),
    ).toEqual([
      'selector "in:f2": "in:" is not a selector key; keys: type',
      'selector "type:": type: needs a value',
      'selector "type:a,b": one value a term; join terms with spaces',
      'selector "all": "all" is a keyword; reach an element named so by its label or a longer prefix',
      'selector ""open": column 1: expected a closing "',
      'selector "": an empty selector',
    ]);
  });

  it('refuses an ambiguous prefix with every candidate, marking a stale one', () => {
    const tab = withElements(view('0bcd0001-x', 'One'), view('0bcd0002-x', 'Two', 1300));
    expect(refusal('0b', stateOf(tab)).details).toEqual([
      '"0b" matches 2 elements:',
      '  0bcd0001  plan-view "One"',
      '  0bcd0002  plan-view "Two"',
    ]);
    expect(refusal('0bcd', stateOf(tab)).details[0]).toBe(
      '"0bcd" matches 2 elements now; one was added since your read?',
    );
  });
});

describe('cardinality', () => {
  const state = () => stateOf(withElements(view('v9', 'Workload', 1300)));

  it('resolves exactly one, naming the matches otherwise', () => {
    const many = resolveOne(state(), '"Workload"', 2);
    expect(
      'rejection' in many &&
        formatRejections([{ ...many.rejection, op: 'set "Workload" textSize=lg' }]),
    ).toEqual([
      'error target_ambiguous · op 2 · set "Workload" textSize=lg',
      '  "Workload" matches 2 elements:',
      '    w1  plan-view "Workload"',
      '    v9  plan-view "Workload"',
      '  hint: use a ref, narrow with type:plan-view',
      'nothing was applied',
    ]);
    const none = resolveOne(state(), '"Workloads"', 1);
    expect('rejection' in none && none.rejection.details).toEqual([
      '"Workloads" matches nothing',
      'nearest:',
      '  w1  plan-view "Workload"',
      '  v9  plan-view "Workload"',
    ]);
    expect(resolveOne(state(), 'w1', 1)).toMatchObject({ el: { id: 'w1' } });
    const error = resolveOne(state(), 'colour:red', 1);
    expect('rejection' in error && error.rejection.code).toBe('parse_error');
  });

  it('takes one or more with all, offering all when it is missing', () => {
    const some = resolveSome(state(), '"Workload"', 1, true);
    expect('els' in some && some.els.map((el) => el.id)).toEqual(['w1', 'v9']);
    const without = resolveSome(state(), '"Workload"', 1, false);
    expect('rejection' in without && without.rejection.hint).toBe(
      'use a ref, narrow with type:plan-view, or add all',
    );
    const none = resolveSome(state(), 'type:plan-board', 1, true);
    expect('rejection' in none && none.rejection.code).toBe('target_not_found');
    const error = resolveSome(state(), 'colour:red', 1, true);
    expect('rejection' in error && error.rejection.code).toBe('parse_error');
  });

  it('cuts a long candidate list, counting the rest', () => {
    const many = Array.from({ length: 14 }, (_, i) => view(`s${i}`, 'Same', 900 + i * 400));
    const out = resolveOne(stateOf(withElements(...many)), '"Same"', 1);
    expect('rejection' in out && out.rejection.details.slice(-2)).toEqual([
      '  s9  plan-view "Same"',
      '  … 4 more',
    ]);
  });
});

describe('the working state', () => {
  it('finds what an earlier operation added, by its new ref', () => {
    const state = stateOf();
    putElement(state, view('burn', 'Burn down'), 1);
    expect(ids('burn', state)).toEqual(['burn']);
    expect(ids('"burn down"', state)).toEqual(['burn']);
  });

  it('notes each pre-existing element it resolves as a target', () => {
    const state = stateOf();
    putElement(state, view('burn', 'New'), 1);
    ids('w1', state);
    ids('burn', state);
    ids('label~o', state);
    expect(state.targets).toEqual(['w1', 'm2']);
  });
});

describe('parseSelector', () => {
  it('reads terms', () => {
    expect(parseSelector('"Sprint board" label~pay type:plan-view selected w1')).toEqual([
      { kind: 'label', text: 'Sprint board' },
      { kind: 'label~', text: 'pay' },
      { kind: 'type', value: 'plan-view' },
      { kind: 'selected' },
      { kind: 'ref', text: 'w1' },
    ]);
  });
});

// An `id:"…"` ref names one full id: once that element is gone it names nothing, never the longer id it prefixes.
describe('id:"…" refs', () => {
  it('never fall back to a prefix after their element is removed', () => {
    const tab = withElements(view('w1 0', 'Ten'), view('w1 ', 'One', 1300));
    const outcome = run('rm id:"w1 "\nset id:"w1 " label=Renamed', tab);
    expect(refused(outcome).code).toBe('target_not_found');
    expect(elementOf(tab, 'w1 0')).toMatchObject({ label: 'Ten' });
  });
});
