import { describe, expect, it, vi } from 'vitest';
import { formTourStepTelemetryType, formTourSteps, type FormTourApi } from './form-tour-steps';

// The Forms tour's steps (docs/specs/030-forms/forms.md "The Forms tour"): it does rather than points, on the
// person's own form, with an example question it takes away again.

const api = (over: Partial<FormTourApi> = {}): FormTourApi => ({
  destination: () => ({ tabId: 'sheet-tab', kind: 'sheet' }),
  openTab: vi.fn(),
  backToForm: vi.fn(),
  addQuestion: vi.fn(() => 'q-tour'),
  editQuestion: vi.fn(),
  questionId: () => 'q-tour',
  preview: vi.fn(),
  ...over,
});

const step = (id: string, destination: 'board' | 'sheet' | null = 'sheet') =>
  formTourSteps({ destination }).find((s) => s.id === id)!;

describe('formTourSteps', () => {
  it('adds, edits and types a question, previews, then shows where responses go and sharing', () => {
    expect(formTourSteps({ destination: 'board' }).map((s) => s.id)).toEqual([
      'add',
      'edit',
      'type',
      'preview',
      'settings',
      'destination',
      'share',
      'outro',
    ]);
  });

  it('leaves out the destination with nowhere for responses to go', () => {
    expect(formTourSteps({ destination: null }).map((s) => s.id)).not.toContain('destination');
  });

  it('works its own example question', async () => {
    const a = api();
    await step('add').prepare!(a);
    expect(a.addQuestion).toHaveBeenCalledTimes(1);
    expect(step('add').selector!(a)).toBe('[data-form-page] [data-form-question="q-tour"]');
    await step('edit').prepare!(a);
    expect(a.editQuestion).toHaveBeenCalledTimes(1);
    expect(step('add').selector!(api({ questionId: () => null }))).toBeNull();
  });

  it('previews the form for its step and goes back to editing after', async () => {
    const a = api();
    await step('preview').prepare!(a);
    expect(a.preview).toHaveBeenCalledWith(true);
    step('preview').cleanup!(a);
    expect(a.preview).toHaveBeenLastCalledWith(false);
    // The example question as a respondent sees it, not the whole page.
    expect(step('preview').selector!(a)).toBe('#form-q-q-tour');
  });

  it('opens the board or sheet for its step and comes back after', async () => {
    const dest = step('destination');
    expect(dest.title).toBe('Responses Land Here');
    expect(dest.selector!(null as never)).toBe('[data-plan-sheet]');
    const a = api();
    await dest.prepare!(a);
    expect(a.openTab).toHaveBeenCalledWith('sheet-tab');
    dest.cleanup!(a);
    expect(a.backToForm).toHaveBeenCalled();
    const board = step('destination', 'board');
    expect(board.selector!(null as never)).toBe('[data-plan-board]');
    await board.prepare!({ ...a, destination: () => null });
    expect(a.openTab).toHaveBeenCalledTimes(1);
  });

  it('names its telemetry by step', () => {
    expect(formTourStepTelemetryType('destination')).toBe('FormTourStepDestination');
  });
});
