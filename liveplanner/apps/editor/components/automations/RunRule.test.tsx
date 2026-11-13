// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "On cards": Run Rule in a card's ⋯ menu is an Editor's while a Run from a Card
// rule is on; it lists them under Rules You Can Run Here, then Manage Automations, and says "Ran <rule>" or why not.
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ItemPanelMenu } from '@/components/plan/ItemPanelMenu';
import { AutomationsContext } from './AutomationsContext';
import { forgetAutomations } from './use-automations';
import { useRunRule } from './use-run-rule';
import { rule, run } from './test-fixtures';

const client = vi.hoisted(() => ({ listAutomations: vi.fn(), runRule: vi.fn() }));
vi.mock('./automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./automations-client')>()),
  ...client,
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
const { AutomationRefusal } = await import('./automations-client');

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };
const open = vi.fn();
const withAccess = ({ children }: { children: ReactNode }) => (
  <AutomationsContext.Provider value={{ scope: SCOPE, open }}>
    {children}
  </AutomationsContext.Provider>
);
const manual = rule({ id: 'm1', name: 'Escalate to Leads', trigger: { kind: 'manual' } });

function list(rules: ReturnType<typeof rule>[]) {
  client.listAutomations.mockResolvedValue({ rules, runsToday: 0, runsPerDay: 1000 });
}

// The flyout measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

beforeEach(() => {
  forgetAutomations();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('useRunRule', () => {
  it('is null without Automations, and while no manual rule is on', async () => {
    expect(renderHook(() => useRunRule('i1')).result.current).toBeNull();
    list([rule(), { ...manual, enabled: false }]);
    const { result } = renderHook(() => useRunRule('i1'), { wrapper: withAccess });
    await waitFor(() => expect(client.listAutomations).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current).toBeNull();
  });

  it('runs a manual rule on the card and says how it went', async () => {
    list([rule(), manual]);
    const { result } = renderHook(() => useRunRule('i1'), { wrapper: withAccess });
    await waitFor(() =>
      expect(result.current?.rules).toEqual([{ id: 'm1', name: 'Escalate to Leads' }]),
    );
    client.runRule.mockResolvedValueOnce({ run: run() });
    act(() => result.current!.onRun('m1'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Ran Escalate to Leads'));
    expect(client.runRule).toHaveBeenCalledWith(SCOPE, 'm1', 'i1');
    expect(track).toHaveBeenCalledWith('Plan', 'Ran', 'AutomationManual');
    client.runRule.mockResolvedValueOnce({
      run: run({ result: 'failed', reason: 'No assignee.' }),
    });
    act(() => result.current!.onRun('m1'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('No assignee.'));
    client.runRule.mockResolvedValueOnce({ run: run({ result: 'no_match' }) });
    act(() => result.current!.onRun('m1'));
    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    // A Wait holds the rest: it ran, and says when it goes on, never that it found nothing to do.
    const later = new Date();
    later.setDate(later.getDate() + 1);
    later.setHours(9, 0, 0, 0);
    client.runRule.mockResolvedValueOnce({
      run: run({ result: 'waiting', waitsUntil: later.getTime() }),
    });
    act(() => result.current!.onRun('m1'));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringMatching(
          /^Ran Escalate to Leads up to its Wait\. It goes on Tomorrow .*9.*00\.$/,
        ),
      ),
    );
    client.runRule.mockResolvedValueOnce({ run: run({ result: 'waiting' }) });
    act(() => result.current!.onRun('m1'));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Ran Escalate to Leads up to its Wait.'),
    );
    expect(toast.info).toHaveBeenCalledTimes(1);
    client.runRule.mockRejectedValueOnce(
      new AutomationRefusal(409, { error: 'automation_not_manual', message: 'Not manual.' }),
    );
    act(() => result.current!.onRun('m1'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Not manual.'));
    client.runRule.mockRejectedValueOnce(new Error('offline'));
    act(() => result.current!.onRun('m1'));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Escalate to Leads didn’t run. Try again.'),
    );
    result.current!.onManage();
    expect(open).toHaveBeenCalled();
  });
});

describe('Run Rule in the card menu', () => {
  const fns = { onDuplicate: vi.fn(), onFlag: vi.fn(), onArchive: vi.fn(), onTrash: vi.fn() };
  it('is drawn only with a manual rule on, and runs it', () => {
    render(
      <ItemPanelMenu
        itemKey={7}
        canEdit
        archived={false}
        flagged={false}
        {...fns}
        runRules={null}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More for #7' }));
    expect(screen.queryByRole('menuitem', { name: 'Run Rule' })).toBeNull();
    cleanup();
    const onRun = vi.fn();
    const onManage = vi.fn();
    render(
      <ItemPanelMenu
        itemKey={7}
        canEdit
        archived={false}
        flagged={false}
        {...fns}
        runRules={{ rules: [{ id: 'm1', name: 'Escalate to Leads' }], onRun, onManage }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More for #7' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Run Rule' }));
    expect(screen.getByText('Rules You Can Run Here')).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Escalate to Leads' }));
    expect(onRun).toHaveBeenCalledWith('m1');
    fireEvent.click(screen.getByRole('button', { name: 'More for #7' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Run Rule' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Manage Automations' }));
    expect(onManage).toHaveBeenCalled();
  });
});
