import { describe, expect, it, vi } from 'vitest';
import { overviewStyleOpener } from './overview-dock';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/026-plan/plan-overview.md "The dock", "Style" and "Share roles": on the Overview the dock's Style is an
// Editor's (Overview Style); a Participant and a Viewer have none. On a tab it is Tab Style, as before.
describe('the dock’s Style button', () => {
  const session = (over: boolean, canEdit: boolean, readOnly = !canEdit) => ({
    overviewOpen: over,
    canEdit,
    readOnly,
    embedMode: false,
  });

  it('opens Overview Style for an Editor on the Overview', () => {
    const open = vi.fn();
    const press = overviewStyleOpener(session(true, true), open);
    expect(press).toBeTypeOf('function');
    press!();
    expect(open).toHaveBeenCalledWith('looks');
  });

  it('is not there for a Participant or a Viewer on the Overview', () => {
    // A Participant takes part on a tab (not read-only there), yet may not style the plan's Overview.
    expect(overviewStyleOpener(session(true, false, false), vi.fn())).toBeUndefined();
    expect(overviewStyleOpener(session(true, false, true), vi.fn())).toBeUndefined();
  });

  it('keeps Tab Style on a tab for whoever may style it, and none in an embed', () => {
    expect(overviewStyleOpener(session(false, true), vi.fn())).toBeTypeOf('function');
    expect(overviewStyleOpener(session(false, false), vi.fn())).toBeUndefined();
    expect(
      overviewStyleOpener({ ...session(true, true), embedMode: true }, vi.fn()),
    ).toBeUndefined();
  });
});
