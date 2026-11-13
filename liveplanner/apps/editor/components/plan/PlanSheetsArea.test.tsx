// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanSlice } from '@/hooks/plan/usePlanSlice';

// docs/specs/026-plan/plan-board.md "A panel that fails to draw closes": the bug was a boundary drawing nothing while
// the card stayed open, so every later click changed the address and opened nothing until a reload.

let thrown: Error | null = null;
vi.mock('next/dynamic', () => ({
  default: () =>
    function FakeHost() {
      if (thrown) throw thrown;
      return <p>Card panel</p>;
    },
}));
vi.mock('@/lib/telemetry', () => ({ track: () => {} }));
vi.mock('@liveworkspace/workbench/lib/stale-build-navigation', () => ({
  browserNavigationDeps: () => ({}),
  recoverInBrowser: () => Promise.resolve('gave-up'),
}));

import { PANEL_FAILED_TEXT, PANEL_STALE_TEXT, PlanSheetsArea } from './PlanSheetsArea';

function planWith(requiredFields: unknown = null) {
  return {
    closeItem: vi.fn(),
    closeTypeEditor: vi.fn(),
    settleRequiredFields: vi.fn(),
    requiredFields,
    context: { notify: vi.fn() },
  } as unknown as PlanSlice & {
    closeItem: ReturnType<typeof vi.fn>;
    closeTypeEditor: ReturnType<typeof vi.fn>;
    settleRequiredFields: ReturnType<typeof vi.fn>;
    context: { notify: ReturnType<typeof vi.fn> };
  };
}

describe('PlanSheetsArea', () => {
  beforeEach(() => {
    thrown = null;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('draws the panel', () => {
    const plan = planWith();
    const { getByText } = render(<PlanSheetsArea plan={plan} />);
    expect(getByText('Card panel')).toBeTruthy();
    expect(plan.closeItem).not.toHaveBeenCalled();
  });

  it('closes the card when the panel fails to draw, so the next click opens afresh', () => {
    thrown = new TypeError('x is undefined');
    const plan = planWith();
    render(<PlanSheetsArea plan={plan} />);
    expect(plan.closeItem).toHaveBeenCalledTimes(1);
    expect(plan.closeTypeEditor).toHaveBeenCalledTimes(1);
    expect(plan.settleRequiredFields).not.toHaveBeenCalled();
    expect(plan.context.notify).toHaveBeenCalledWith(PANEL_FAILED_TEXT);
  });

  it('asks for a reload when the panel’s code is a chunk a release removed', () => {
    const chunk = new Error('Loading chunk 123 failed.');
    chunk.name = 'ChunkLoadError';
    thrown = chunk;
    const plan = planWith({ id: 'r' });
    render(<PlanSheetsArea plan={plan} />);
    expect(plan.closeItem).toHaveBeenCalledTimes(1);
    expect(plan.settleRequiredFields).toHaveBeenCalledWith(null);
    expect(plan.context.notify).toHaveBeenCalledWith(PANEL_STALE_TEXT);
  });
});
