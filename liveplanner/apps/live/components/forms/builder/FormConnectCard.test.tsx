// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FormDefinition } from '@liveplanner/forms';
import type { FormActions } from '@/hooks/forms/useFormActions';
import { FormBuilderContext, type FormBuilderValue } from './form-builder-context';
import { FormConnectCard } from './FormConnectCard';

// The connect box (docs/specs/030-forms/forms.md "Responses Go To and Settings"): an Editor's, above the form's title,
// while the form sends its responses nowhere.

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const BLANK: FormDefinition = { v: 1, heading: 'Feedback', sections: [] };

function setup(
  over: Partial<FormDefinition> = {},
  {
    canEdit = true,
    hasExisting = true,
    problem = null,
  }: { canEdit?: boolean; hasExisting?: boolean; problem?: 'sheet_missing' | null } = {},
) {
  const actions = {
    newResponsesBoard: vi.fn(),
    newResponsesSheet: vi.fn(),
  } as unknown as FormActions;
  const openSettings = vi.fn();
  const value = {
    form: { ...BLANK, ...over },
    canEdit,
    actions,
    openSettings,
  } as unknown as FormBuilderValue;
  render(
    <FormBuilderContext.Provider value={value}>
      <FormConnectCard hasExisting={hasExisting} problem={problem} />
    </FormBuilderContext.Provider>,
  );
  return { actions, openSettings };
}

const box = () => screen.queryByRole('region', { name: 'Where Should Responses Go?' });

describe('FormConnectCard', () => {
  it('asks an Editor where responses go while the form has no board or sheet', () => {
    setup();
    expect(box()).toBeTruthy();
  });

  it.each([
    ['a board', { destination: { tabId: 't', typeId: 'bug', status: 'new' } }],
    ['a sheet', { sheet: { tabId: 't', sheetId: 's' } }],
  ])('is gone once the form sends to %s', (_what, over) => {
    setup(over);
    expect(box()).toBeNull();
  });

  it('is never shown to someone who may not edit', () => {
    setup({}, { canEdit: false });
    expect(box()).toBeNull();
  });

  it('New Board connects the form to a new board', () => {
    const { actions } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Cards on a Board/ }));
    expect(actions.newResponsesBoard).toHaveBeenCalledOnce();
    expect(track).toHaveBeenCalledWith('Form', 'Linked', 'ConnectNewBoard');
  });

  it('New Sheet connects the form to a new sheet', () => {
    const { actions } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Rows in a Sheet/ }));
    expect(actions.newResponsesSheet).toHaveBeenCalledOnce();
    expect(track).toHaveBeenCalledWith('Form', 'Linked', 'ConnectNewSheet');
  });

  it('Choose Existing opens Responses Go To', () => {
    const { openSettings } = setup();
    fireEvent.click(screen.getByRole('button', { name: /already have/ }));
    expect(openSettings).toHaveBeenCalledWith('destination');
    expect(track).toHaveBeenCalledWith('Form', 'Linked', 'ConnectChoose');
  });

  it('offers no Choose Existing when the project has no board or sheet', () => {
    setup({}, { hasExisting: false });
    expect(screen.queryByRole('button', { name: /already have/ })).toBeNull();
  });

  // The user's report: a removed sheet left the form with nowhere to go and no box to fix it.
  it('comes back, saying why, when the sheet or board it named was removed', () => {
    setup({ sheet: { tabId: 't', sheetId: 's' } }, { problem: 'sheet_missing' });
    expect(box()).toBeTruthy();
    expect(screen.getByText('Its sheet was removed. Choose where responses go.')).toBeTruthy();
  });
});
