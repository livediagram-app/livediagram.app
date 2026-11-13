// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The Automations screen": Refresh beside the Runs today meter reads the rules,
// Runs today and the open Audit Trail again, busy and turning meanwhile with what was shown kept, and a failed read
// keeps it and says it could not refresh. On a phone (jsdom's default here) and on a wide screen.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { PlanProvider, type PlanContextValue } from '@/components/plan/PlanContext';
import { AutomationsDialog } from './AutomationsDialog';
import type { AutomationsTarget } from './AutomationsContext';
import { REFRESH_FAILED } from './RefreshButton';
import { forgetAutomations } from './use-automations';
import { ANA, outline, rule, run } from './test-fixtures';

const client = vi.hoisted(() => ({ listAutomations: vi.fn(), listRuns: vi.fn() }));
vi.mock('./automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./automations-client')>()),
  ...client,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const toast = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));
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

const listed = (runsThisWeek: number, runsToday: number) => ({
  rules: [rule({ stats: { lastRunAt: Date.now(), runsThisWeek, failuresInARow: 0 } })],
  runsToday,
  runsPerDay: 1000,
});

// A promise settled from the test, to hold a read open.
function held<T>() {
  let settle!: { resolve: (v: T) => void; reject: (e: unknown) => void };
  const promise = new Promise<T>((resolve, reject) => {
    settle = { resolve, reject };
  });
  return { promise, ...settle };
}

function Harness({ initial = { view: 'rules' } }: { initial?: AutomationsTarget }) {
  const [target, setTarget] = useState(initial);
  return (
    <PlanProvider value={plan}>
      <AutomationsDialog scope={SCOPE} target={target} onTarget={setTarget} onClose={() => {}} />
    </PlanProvider>
  );
}

const refreshButton = () => screen.getByRole('button', { name: 'Refresh' });
const week = () => screen.getByText('Done Means Wrapped Up').closest('li')!.textContent;
const meterText = () => screen.getByRole('meter').getAttribute('aria-valuetext');

beforeEach(() => {
  forgetAutomations();
  vi.clearAllMocks();
  client.listAutomations.mockResolvedValue(listed(38, 142));
  client.listRuns.mockResolvedValue({ runs: [run()] });
});
afterEach(cleanup);

describe('Refresh', () => {
  it('reads the rules and Runs today again, busy and turning until they land, the old ones shown meanwhile', async () => {
    render(<Harness />);
    await screen.findByText('Done Means Wrapped Up');
    expect(week()).toContain('38 runs');
    const next = held<ReturnType<typeof listed>>();
    client.listAutomations.mockReturnValueOnce(next.promise);
    fireEvent.click(refreshButton());
    expect(refreshButton().getAttribute('aria-busy')).toBe('true');
    expect(refreshButton().getAttribute('aria-disabled')).toBe('true');
    expect(refreshButton().querySelector('svg')!.getAttribute('class')).toContain('animate-spin');
    // A press while busy reads nothing more.
    fireEvent.click(refreshButton());
    expect(client.listAutomations).toHaveBeenCalledTimes(2);
    // Nothing blanks while it reads.
    expect(screen.queryByRole('status', { name: 'Loading rules' })).toBeNull();
    expect(week()).toContain('38 runs');
    expect(meterText()).toBe('142 of 1,000 runs today');
    await act(async () => next.resolve(listed(39, 150)));
    expect(week()).toContain('39 runs');
    expect(meterText()).toBe('150 of 1,000 runs today');
    expect(refreshButton().getAttribute('aria-busy')).toBeNull();
    expect(refreshButton().querySelector('svg')!.getAttribute('class') ?? '').not.toContain(
      'animate-spin',
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('keeps what was shown when the read fails, and says it could not refresh', async () => {
    render(<Harness />);
    await screen.findByText('Done Means Wrapped Up');
    client.listAutomations.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(refreshButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(REFRESH_FAILED));
    expect(week()).toContain('38 runs');
    expect(meterText()).toBe('142 of 1,000 runs today');
    expect(screen.queryByText('Couldn’t Load the Rules')).toBeNull();
    expect(refreshButton().getAttribute('aria-busy')).toBeNull();
  });

  it('says nothing failed when the read is refused (the screen says only an Editor can see rules)', async () => {
    const { AutomationRefusal } = await import('./automations-client');
    render(<Harness />);
    await screen.findByText('Done Means Wrapped Up');
    client.listAutomations.mockRejectedValueOnce(
      new AutomationRefusal(403, { error: 'automations_need_editor' }),
    );
    fireEvent.click(refreshButton());
    expect(await screen.findByText('Only an Editor Can See Rules')).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('reads the open Audit Trail again for its filters, keeping the runs until the new ones land', async () => {
    render(<Harness initial={{ view: 'runs' }} />);
    expect(await screen.findByText('Publish pricing page')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Result' }), {
      target: { value: 'done' },
    });
    await waitFor(() => expect(client.listRuns).toHaveBeenCalledTimes(2));
    const runs = held<{ runs: ReturnType<typeof run>[] }>();
    client.listRuns.mockReturnValueOnce(runs.promise);
    fireEvent.click(refreshButton());
    expect(client.listRuns).toHaveBeenLastCalledWith(
      SCOPE,
      expect.objectContaining({ result: 'done', limit: 200 }),
    );
    expect(client.listAutomations).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Publish pricing page')).toBeTruthy();
    expect(document.querySelector('[data-run-log-loading]')).toBeNull();
    expect(refreshButton().getAttribute('aria-busy')).toBe('true');
    await act(async () =>
      runs.resolve({
        runs: [run({ id: 'run2', card: { id: 'i49', key: 49, title: 'Ship the docs' } })],
      }),
    );
    expect(screen.getByText('Ship the docs')).toBeTruthy();
    expect(screen.queryByText('Publish pricing page')).toBeNull();
    expect(refreshButton().getAttribute('aria-busy')).toBeNull();
  });

  it('keeps the runs when their read fails, and says it could not refresh', async () => {
    render(<Harness initial={{ view: 'runs' }} />);
    expect(await screen.findByText('Publish pricing page')).toBeTruthy();
    client.listRuns.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(refreshButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(REFRESH_FAILED));
    expect(screen.getByText('Publish pricing page')).toBeTruthy();
    expect(screen.queryByText('Couldn’t Load the Audit Trail')).toBeNull();
  });

  it('drops runs read for filters changed meanwhile', async () => {
    render(<Harness initial={{ view: 'runs' }} />);
    expect(await screen.findByText('Publish pricing page')).toBeTruthy();
    const stale = held<{ runs: ReturnType<typeof run>[] }>();
    client.listRuns.mockReturnValueOnce(stale.promise);
    fireEvent.click(refreshButton());
    client.listRuns.mockResolvedValue({ runs: [] });
    fireEvent.change(screen.getByRole('combobox', { name: 'Result' }), {
      target: { value: 'failed' },
    });
    expect(await screen.findByRole('button', { name: /Clear/ })).toBeTruthy();
    await act(async () =>
      stale.resolve({
        runs: [run({ id: 'run3', card: { id: 'i50', key: 50, title: 'Old answer' } })],
      }),
    );
    expect(screen.queryByText('Old answer')).toBeNull();
  });

  it('sits in the phone’s foot beside the stacked meter', async () => {
    render(<Harness />);
    await screen.findByText('Done Means Wrapped Up');
    const foot = screen.getByRole('meter').closest('.border-t')!;
    expect(within(foot as HTMLElement).getByRole('button', { name: 'Refresh' })).toBeTruthy();
  });
});

describe('Refresh on a wide screen', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: query.includes('min-width'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('stands right after the meter, beside the tabs', async () => {
    render(<Harness />);
    await screen.findByText('Done Means Wrapped Up');
    const meter = screen.getByRole('meter');
    const button = refreshButton();
    expect(meter.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('tablist').parentElement!.contains(button)).toBe(true);
    expect(button.className).toContain('cursor-pointer');
  });
});
