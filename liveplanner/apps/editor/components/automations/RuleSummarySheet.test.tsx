// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "On cards": for a Participant or a Viewer the rule's name opens a read-only sheet
// (its name, on or off, trigger, conditions, steps, who made it); an Editor still opens the builder; a rule gone says
// This Rule Was Deleted. The sheet has no control but Close.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationRuleSummary } from '@liveplanner/api-schema';
import { PlanCardContext } from '@/components/plan/PlanCardContext';
import { AutomationsContext } from './AutomationsContext';
import { AutomationAuthorName } from './AutomationAuthor';
import { AutomationRefusal } from './automations-client';
import { RuleSummarySheet } from './RuleSummarySheet';

const readRuleSummary = vi.hoisted(() => vi.fn());
vi.mock('./automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./automations-client')>()),
  readRuleSummary,
}));
// next/dynamic resolves the sheet straight away here, as the browser does once its chunk arrives.
vi.mock('next/dynamic', () => ({
  default: () =>
    function Sheet(props: Parameters<typeof RuleSummarySheet>[0]) {
      return <RuleSummarySheet {...props} />;
    },
}));

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: 'share', tabId: 't1' };

const SUMMARY: AutomationRuleSummary = {
  id: 'r1',
  name: 'Done Means Wrapped Up',
  on: true,
  paused: false,
  trigger: 'When Card Moved to Done',
  picks: false,
  conditions: ['Priority is High'],
  steps: [
    { kind: 'move', words: 'Move to Done' },
    { kind: 'email', words: 'Email 2 Addresses' },
    { kind: 'notify', via: 'slack', words: 'Post to Slack' },
    {
      kind: 'if',
      words: 'If',
      conditions: ['Column is To Do'],
      then: [{ kind: 'flag', words: 'Flag' }],
      else: [],
    },
    { kind: 'ai', words: 'An AI Step' },
  ],
  made: { by: 'Ana Costa', at: Date.now() - 2 * 60 * 60 * 1000 },
};

beforeEach(() => readRuleSummary.mockReset());
afterEach(cleanup);

function asReader(node: React.ReactNode) {
  return render(
    <PlanCardContext.Provider
      value={{
        types: [],
        statusNames: new Map(),
        statusPhases: new Map(),
        canEditCards: false,
        itemsScope: SCOPE,
      }}
    >
      {node}
    </PlanCardContext.Provider>,
  );
}

describe('a rule’s name for a reader', () => {
  it('opens the read-only sheet, asking by the comment’s id on the reader’s tab', async () => {
    readRuleSummary.mockResolvedValue({ rule: SUMMARY });
    asReader(<AutomationAuthorName rule="Done Means Wrapped Up" ruleId="r1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Done Means Wrapped Up' }));
    const dialog = await screen.findByRole('dialog');
    expect(readRuleSummary).toHaveBeenCalledWith(SCOPE, {
      ruleId: 'r1',
      name: 'Done Means Wrapped Up',
    });
    await within(dialog).findByText('When Card Moved to Done');
    for (const words of [
      'Priority is High',
      'Move to Done',
      'Email 2 Addresses',
      'Post to Slack',
      'Flag',
      'An AI Step',
    ])
      expect(within(dialog).getByText(words)).toBeTruthy();
    expect(within(dialog).getByText('On')).toBeTruthy();
    expect(within(dialog).getByText(/Made by Ana Costa/)).toBeTruthy();
    // Close is the only control: no edit, test, run, toggle, delete, or way to other rules.
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? b.textContent),
    ).toEqual(['Close']);
    expect(within(dialog).queryByRole('switch')).toBeNull();
    expect(within(dialog).queryByRole('link')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('asks a history line’s rule by its name', async () => {
    readRuleSummary.mockResolvedValue({ rule: { ...SUMMARY, on: false, paused: true } });
    asReader(<AutomationAuthorName rule="Done Means Wrapped Up" />);
    fireEvent.click(screen.getByRole('button', { name: 'Done Means Wrapped Up' }));
    expect(await screen.findByText('Paused')).toBeTruthy();
    expect(readRuleSummary).toHaveBeenCalledWith(SCOPE, {
      ruleId: undefined,
      name: 'Done Means Wrapped Up',
    });
  });

  it('says a rule gone was deleted', async () => {
    readRuleSummary.mockRejectedValueOnce(
      new AutomationRefusal(404, { error: 'automation_not_found' }),
    );
    asReader(<AutomationAuthorName rule="Old Rule" ruleId="r9" />);
    fireEvent.click(screen.getByRole('button', { name: 'Old Rule' }));
    expect(await screen.findByText('This Rule Was Deleted')).toBeTruthy();
  });

  it('offers Try Again when the read fails, and reads again', async () => {
    readRuleSummary
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ rule: SUMMARY });
    asReader(<AutomationAuthorName rule="Done Means Wrapped Up" ruleId="r1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Done Means Wrapped Up' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('When Card Moved to Done')).toBeTruthy();
    expect(readRuleSummary).toHaveBeenCalledTimes(2);
  });

  it('shows a time trigger’s conditions as the cards it picks, and an Off rule as Off', async () => {
    readRuleSummary.mockResolvedValue({
      rule: { ...SUMMARY, on: false, picks: true, trigger: 'Every Weekday at 9:00', steps: [] },
    });
    asReader(<AutomationAuthorName rule="Done Means Wrapped Up" ruleId="r1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Done Means Wrapped Up' }));
    expect(await screen.findByText('For Cards Where')).toBeTruthy();
    expect(screen.getByText('Off')).toBeTruthy();
  });

  it('still opens the builder for an Editor, never the sheet', () => {
    const open = vi.fn();
    asReader(
      <AutomationsContext.Provider value={{ scope: SCOPE, open }}>
        <AutomationAuthorName rule="Done Means Wrapped Up" ruleId="r1" />
      </AutomationsContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Done Means Wrapped Up' }));
    expect(open).toHaveBeenCalledWith({ view: 'rule', ruleId: 'r1' });
    expect(readRuleSummary).not.toHaveBeenCalled();
  });
});
