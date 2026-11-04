import { describe, expect, it } from 'vitest';
import {
  OVERVIEW_HASH,
  hashTabId,
  isNewPlanEntry,
  landingOf,
  newPlanEntryState,
  pinHash,
} from './overview-address';

// Where a plan opens (docs/specs/026-plan/plan-overview.md "A plan opens on its Overview"): every way in.

const TABS = ['t1', 't2', 't3'];
const land = (over: Partial<Parameters<typeof landingOf>[0]> = {}) =>
  landingOf({
    hash: '',
    tabIds: TABS,
    firstId: 't1',
    newPlan: false,
    overviewAllowed: true,
    inScope: () => true,
    ...over,
  });

describe('landingOf', () => {
  it('opens a plain address (Explorer, recents, Start) on the Overview, over the first tab', () => {
    expect(land()).toEqual({ tabId: 't1', overview: true });
  });

  it('opens a link naming a tab on that tab (shared tab link, reload on a tab)', () => {
    expect(land({ hash: '#t=t2' })).toEqual({ tabId: 't2', overview: false });
  });

  it('opens a card or element deep link on its tab', () => {
    expect(land({ hash: '#t=t3&item=c1' })).toEqual({ tabId: 't3', overview: false });
    expect(land({ hash: '#t=t2&el=e1&open=comments' })).toEqual({ tabId: 't2', overview: false });
  });

  it('opens #overview (a reload on the Overview) on the Overview', () => {
    expect(land({ hash: OVERVIEW_HASH })).toEqual({ tabId: 't1', overview: true });
  });

  it('opens the Overview when the named tab is not in the plan', () => {
    expect(land({ hash: '#t=gone' })).toEqual({ tabId: 't1', overview: true });
  });

  it('never opens the Overview where there is none (an embed, a tab-scoped session)', () => {
    expect(land({ overviewAllowed: false })).toEqual({ tabId: 't1', overview: false });
    expect(
      land({ hash: '#t=t2', overviewAllowed: false, inScope: (id) => id === 't3', firstId: 't3' }),
    ).toEqual({
      tabId: 't3',
      overview: false,
    });
  });

  it('opens a plan just made on /new on its tab (Start Planning)', () => {
    expect(land({ newPlan: true })).toEqual({ tabId: 't1', overview: false });
  });

  it('keeps the placeholder when the plan has no tabs', () => {
    expect(land({ tabIds: [], firstId: null })).toEqual({ tabId: null, overview: true });
  });
});

describe('the address', () => {
  it('reads the tab a fragment pins, not one inside another key', () => {
    expect(hashTabId('#t=abc')).toBe('abc');
    expect(hashTabId('#t=abc&item=x')).toBe('abc');
    expect(hashTabId('#el=x&t=abc')).toBe('abc');
    expect(hashTabId('#item=x')).toBeNull();
    expect(hashTabId('#xt=abc')).toBeNull();
    expect(hashTabId(OVERVIEW_HASH)).toBeNull();
    expect(hashTabId('')).toBeNull();
  });

  it('pins the Overview or the open tab', () => {
    expect(pinHash('t1', true)).toBe('#overview');
    expect(pinHash('t1', false)).toBe('#t=t1');
  });

  it('marks the entry /new hands a new plan off on', () => {
    expect(isNewPlanEntry(newPlanEntryState())).toBe(true);
    expect(isNewPlanEntry({ ...newPlanEntryState(), __NA: true })).toBe(true);
    expect(isNewPlanEntry(null)).toBe(false);
    expect(isNewPlanEntry({})).toBe(false);
  });
});
