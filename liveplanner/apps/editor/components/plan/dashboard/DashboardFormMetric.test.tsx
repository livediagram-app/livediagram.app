// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "A slot's name": a Form figure in a named slot shows the slot's name in place of the
// figure's ("Responses"), before its form is chosen too.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FormMetricContent } from '@liveplanner/project';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardFormMetric } from './DashboardFormMetric';

afterEach(cleanup);

function show(content: FormMetricContent) {
  const value = {
    tabs: [{ id: 'f1', name: 'Sign-up', kind: 'form', elements: [] }],
    elements: new Map(),
    canEdit: true,
    actions: { setSlotContent: vi.fn() },
  } as unknown as DashboardContextValue;
  render(
    <DashboardContext.Provider value={value}>
      <DashboardFormMetric slotId="s1" content={content} />
    </DashboardContext.Provider>,
  );
}

describe('a Form figure’s name', () => {
  it('is the slot’s own where it has one, else the figure’s', () => {
    show({ type: 'form-metric', metric: 'responses', formTabId: 'f1', name: 'Sign-ups so far' });
    expect(screen.getByRole('group', { name: /^Sign-ups so far: / })).toBeTruthy();
    cleanup();
    show({ type: 'form-metric', metric: 'responses', formTabId: 'f1' });
    expect(screen.getByRole('group', { name: /^Responses: / })).toBeTruthy();
  });

  it('shows the slot’s name while its form is still to be chosen', () => {
    show({ type: 'form-metric', metric: 'responses', formTabId: '', name: 'Sign-ups so far' });
    expect(screen.getByText('Sign-ups so far')).toBeTruthy();
    expect(screen.queryByText('Responses')).toBeNull();
  });
});
