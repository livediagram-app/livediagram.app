import { describe, expect, it, vi } from 'vitest';
import { formTourStepTelemetryType, formTourSteps } from './form-tour-steps';

// The Forms tour's steps (docs/specs/030-forms/forms.md "The Forms tour").

describe('formTourSteps', () => {
  it('walks the form, then where its responses go, between a welcome and an outro', () => {
    expect(formTourSteps({ destination: 'board', hasQuestions: true }).map((s) => s.id)).toEqual([
      'welcome',
      'form',
      'add',
      'status',
      'settings',
      'share',
      'destination',
      'outro',
    ]);
  });

  it('leaves out the form step with no question, and the destination with nowhere to go', () => {
    const ids = formTourSteps({ destination: null, hasQuestions: false }).map((s) => s.id);
    expect(ids).not.toContain('form');
    expect(ids).not.toContain('destination');
  });

  it('opens the board or sheet for its step and comes back after', () => {
    const steps = formTourSteps({ destination: 'sheet', hasQuestions: true });
    const dest = steps.find((s) => s.id === 'destination')!;
    expect(dest.title).toBe('Responses Land Here');
    expect(dest.selector!(null as never)).toBe('[data-plan-sheet]');
    const api = {
      destination: () => ({ tabId: 'sheet-tab', kind: 'sheet' as const }),
      openTab: vi.fn(),
      backToForm: vi.fn(),
    };
    dest.prepare!(api);
    expect(api.openTab).toHaveBeenCalledWith('sheet-tab');
    dest.cleanup!(api);
    expect(api.backToForm).toHaveBeenCalled();
    const board = formTourSteps({ destination: 'board', hasQuestions: true }).find(
      (s) => s.id === 'destination',
    )!;
    expect(board.selector!(null as never)).toBe('[data-plan-board]');
    board.prepare!({ ...api, destination: () => null });
    expect(api.openTab).toHaveBeenCalledTimes(1);
  });

  it('names its telemetry by step', () => {
    expect(formTourStepTelemetryType('destination')).toBe('FormTourStepDestination');
  });
});
