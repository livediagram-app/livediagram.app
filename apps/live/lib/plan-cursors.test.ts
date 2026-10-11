import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { planHidesCursors } from './plan-cursors';

const tab = (over: Partial<Tab>) => ({ id: 't', name: 'T', elements: [], ...over }) as Tab;

describe('participant cursors on Plan tabs', () => {
  it('are hidden on Board and Sheet tabs and any other Plan tab', () => {
    expect(planHidesCursors(tab({ kind: 'board' }))).toBe(true);
    expect(planHidesCursors(tab({ kind: 'sheet' }))).toBe(true);
    expect(planHidesCursors(tab({ opensIn: 'plan' }))).toBe(true);
  });

  it('show on a Dashboard and on every non-Plan tab', () => {
    expect(planHidesCursors(tab({ kind: 'dashboard', opensIn: 'plan' }))).toBe(false);
    expect(planHidesCursors(tab({}))).toBe(false);
    expect(planHidesCursors(tab({ opensIn: 'draw' }))).toBe(false);
    expect(planHidesCursors(undefined)).toBe(false);
  });
});
