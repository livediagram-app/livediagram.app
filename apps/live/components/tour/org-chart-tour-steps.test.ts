// The Org Chart tour (docs/specs/007-editor/element-tours.md "The Org Chart tour"): a person's name, role and initials,
// reports and peers, a team moved as one, and the menu it shares with mind maps.

import { describe, expect, it } from 'vitest';
import type { ElementTourApi } from './element-tour-api';
import { orgChartTourSteps, type OrgChartTourContext } from './org-chart-tour-steps';

const ctxOf = (over: Partial<OrgChartTourContext> = {}): OrgChartTourContext => ({
  elementId: 'ak',
  hasMore: true,
  touch: false,
  hasReports: true,
  ...over,
});
const api = {} as ElementTourApi;

describe('orgChartTourSteps', () => {
  it('walks the person, role, initials, a report, a peer, the team and the menu', () => {
    expect(orgChartTourSteps(ctxOf()).map((s) => s.id)).toEqual([
      'person',
      'role',
      'initials',
      'report',
      'peer',
      'team',
      'menu',
      'outro',
    ]);
    expect(orgChartTourSteps(ctxOf({ hasMore: false })).map((s) => s.id)).not.toContain('menu');
  });

  it("points at the person's role line, initials and grow buttons", () => {
    const steps = orgChartTourSteps(ctxOf());
    const sel = (id: string) => steps.find((s) => s.id === id)!.selector!(api);
    expect(sel('role')).toBe('[data-element-id="ak"] [data-tour-part="person-role"]');
    expect(sel('initials')).toBe('[data-element-id="ak"] [data-tour-part="person-initials"]');
    expect(sel('report')).toBe('[data-testid="selection-popover"] button[aria-label="Add Child"]');
    expect(sel('peer')).toBe('[data-testid="selection-popover"] button[aria-label="Add Sibling"]');
  });

  it('calls a child a report and a sibling a peer, with keys on a keyboard only', () => {
    const keys = orgChartTourSteps(ctxOf());
    expect(keys.find((s) => s.id === 'report')!.body).toMatch(/^Tab, or Add Child/);
    expect(keys.find((s) => s.id === 'peer')!.body).toMatch(/^Enter, or Add Sibling/);
    const touch = orgChartTourSteps(ctxOf({ touch: true }));
    expect(touch.find((s) => s.id === 'report')!.body).not.toContain('Tab');
    expect(touch.find((s) => s.id === 'role')!.body).toMatch(/^Tap/);
    expect(touch.find((s) => s.id === 'person')!.body).toContain('Double-tap');
  });

  it('speaks of their own team when they have reports', () => {
    expect(orgChartTourSteps(ctxOf()).find((s) => s.id === 'team')!.title).toBe(
      'Move a Whole Team',
    );
    expect(
      orgChartTourSteps(ctxOf({ hasReports: false })).find((s) => s.id === 'team')!.title,
    ).toBe('Teams Move Together');
    expect(orgChartTourSteps(ctxOf()).at(-1)).toMatchObject({
      card: 'outro',
      title: 'That Is an Org Chart',
    });
  });
});
