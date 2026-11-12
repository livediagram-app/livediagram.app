// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The Automations screen", "Runs, limits and loops": a rule opened by its id
// that the plan no longer has says so (never a blank new rule), the full meter's line, and the Audit Trail's
// keeping line, with the api client mocked.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { PlanProvider, type PlanContextValue } from '@/components/plan/PlanContext';
import { AutomationsDialog } from './AutomationsDialog';
import type { AutomationsTarget } from './AutomationsContext';
import { forgetAutomations } from './use-automations';
import { ANA, outline, rule, run } from './test-fixtures';

const client = vi.hoisted(() => ({
  listAutomations: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  listRuns: vi.fn(),
}));
vi.mock('./automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./automations-client')>()),
  ...client,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };
const o = outline();
const plan = {
  types: o.types,
  statusNames: o.statuses,
  people: o.people,
  items: o.items,
  self: ANA,
  openItem: vi.fn(),
  planTabs: () => [],
} as unknown as PlanContextValue;

function Harness({ initial }: { initial: AutomationsTarget }) {
  const [target, setTarget] = useState(initial);
  return (
    <PlanProvider value={plan}>
      <AutomationsDialog scope={SCOPE} target={target} onTarget={setTarget} onClose={() => {}} />
    </PlanProvider>
  );
}

beforeEach(() => {
  forgetAutomations();
  vi.clearAllMocks();
  client.listRuns.mockResolvedValue({ runs: [run()] });
});
afterEach(cleanup);

describe('the Automations screen', () => {
  it('says a rule opened by its id was deleted, rather than opening a blank new rule', async () => {
    client.listAutomations.mockResolvedValue({ rules: [rule()], runsToday: 1, runsPerDay: 1000 });
    render(<Harness initial={{ view: 'rule', ruleId: 'r-gone' }} />);
    expect(await screen.findByText('This Rule Was Deleted')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save Rule' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Rule name' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Rules' }));
    expect(await screen.findByText('Done Means Wrapped Up')).toBeTruthy();
    expect(client.createRule).not.toHaveBeenCalled();
  });

  it('says rules run again tomorrow once the day’s runs are spent, and not before', async () => {
    client.listAutomations.mockResolvedValue({
      rules: [rule()],
      runsToday: 1000,
      runsPerDay: 1000,
    });
    render(<Harness initial={{ view: 'rules' }} />);
    expect(await screen.findByText('Daily limit reached: rules run again tomorrow')).toBeTruthy();
    cleanup();
    forgetAutomations();
    client.listAutomations.mockResolvedValue({ rules: [rule()], runsToday: 999, runsPerDay: 1000 });
    render(<Harness initial={{ view: 'rules' }} />);
    await screen.findByText('Done Means Wrapped Up');
    expect(screen.queryByText(/Daily limit reached/)).toBeNull();
  });

  it('says how long the Audit Trail keeps runs and No Matches', async () => {
    client.listAutomations.mockResolvedValue({ rules: [rule()], runsToday: 1, runsPerDay: 1000 });
    render(<Harness initial={{ view: 'runs' }} />);
    expect(
      await screen.findByText(
        'Kept for 30 days or the last 2,000 runs, and the last 500 No Matches',
      ),
    ).toBeTruthy();
  });
});
