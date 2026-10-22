import { describe, expect, it } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { planHidesCursors } from './plan-cursors';

const tab = (over: Partial<Tab>) => ({ id: 't', name: 'T', elements: [], ...over });

describe('participant cursors on Plan tabs', () => {
  it('are hidden on Board and Sheet tabs and any other Plan tab', () => {
    expect(planHidesCursors(tab({ kind: 'board' }))).toBe(true);
    expect(planHidesCursors(tab({ kind: 'sheet' }))).toBe(true);
    expect(planHidesCursors(tab({}))).toBe(true);
  });

  it('show on a Dashboard, and with no tab', () => {
    expect(planHidesCursors(tab({ kind: 'dashboard' }))).toBe(false);
    expect(planHidesCursors(undefined)).toBe(false);
  });
});
