// @vitest-environment jsdom
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  AutomationsContext,
  AutomationsDoorContext,
  type AutomationsAccess,
  type AutomationsDoor,
} from './AutomationsContext';

// A template's starter rules made once the plan can hold them (docs/specs/026-plan/plan-templates.md "Starter
// rules"): a signed-in Editor's cloud plan gets them; a plan in This Browser or a guest's drops them for good.
const makeStarterRules = vi.fn(async () => {});
vi.mock('@/components/plan/start/describe-plan/starter-rules-client', () => ({
  STARTER_RULES_FAILED: 'failed',
  makeStarterRules,
}));
const readAutomations = vi.fn(async () => {});
vi.mock('./use-automations', () => ({ readAutomations }));
const toast = { error: vi.fn() };
const offlineSaveStarterRules = vi.fn(async () => {});
vi.mock('@/lib/offline/offline-store', () => ({ offlineSaveStarterRules }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

const { PendingStarterRules } = await import('./PendingStarterRules');
const { markPendingStarterRules, takePendingStarterRules } =
  await import('@/lib/pending-starter-rules');

const SCOPE = { ownerId: 'o', projectId: 'p', shareCode: null };
const access: AutomationsAccess = { scope: SCOPE, open: () => {} };

function wrap(value: AutomationsAccess | null, door: AutomationsDoor | null) {
  return ({ children }: { children: ReactNode }) => (
    <AutomationsDoorContext.Provider value={door}>
      <AutomationsContext.Provider value={value}>{children}</AutomationsContext.Provider>
    </AutomationsDoorContext.Provider>
  );
}

const settle = () => act(async () => await new Promise((r) => setTimeout(r, 0)));

beforeEach(() => {
  makeStarterRules.mockClear();
  readAutomations.mockClear();
  toast.error.mockClear();
  offlineSaveStarterRules.mockClear();
});
afterEach(() => sessionStorage.clear());

describe('PendingStarterRules', () => {
  it('makes a signed-in Editor’s rules once, each as its template ships it', async () => {
    markPendingStarterRules('t1', 'kanban');
    const { rerender } = render(<PendingStarterRules tabId="t1" projectId="p" offline={false} />, {
      wrapper: wrap(access, { open: () => {}, offline: false }),
    });
    await waitFor(() => expect(makeStarterRules).toHaveBeenCalledTimes(1));
    const [scope, rules] = makeStarterRules.mock.calls[0] as unknown as [
      unknown,
      { body: { name: string }; on: boolean }[],
    ];
    expect(scope).toBe(SCOPE);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some((r) => r.on)).toBe(true);
    await waitFor(() => expect(readAutomations).toHaveBeenCalledWith(SCOPE));
    rerender(<PendingStarterRules tabId="t1" projectId="p" offline={false} />);
    await settle();
    expect(makeStarterRules).toHaveBeenCalledTimes(1);
  });

  it('hears Start Planning leave a kind while it is open', async () => {
    render(<PendingStarterRules tabId="t1" projectId="p" offline={false} />, {
      wrapper: wrap(access, null),
    });
    await settle();
    expect(makeStarterRules).not.toHaveBeenCalled();
    act(() => markPendingStarterRules('t1', 'sprint-board'));
    await waitFor(() => expect(makeStarterRules).toHaveBeenCalledTimes(1));
  });

  it('says so when the rules can’t be made', async () => {
    makeStarterRules.mockRejectedValueOnce(new Error('403'));
    markPendingStarterRules('t1', 'kanban');
    render(<PendingStarterRules tabId="t1" projectId="p" offline={false} />, {
      wrapper: wrap(access, null),
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('failed'));
  });

  it('keeps the kind with a plan in This Browser, for its sync to make', async () => {
    markPendingStarterRules('t1', 'kanban');
    render(<PendingStarterRules tabId="t1" projectId="p" offline />, {
      wrapper: wrap(null, { open: () => {}, offline: true }),
    });
    await settle();
    expect(makeStarterRules).not.toHaveBeenCalled();
    expect(offlineSaveStarterRules).toHaveBeenCalledWith('p', {
      template: 'kanban',
      timeZone: expect.any(String),
    });
  });

  it('keeps nothing in This Browser while no project is open', async () => {
    markPendingStarterRules('t1', 'kanban');
    render(<PendingStarterRules tabId="t1" projectId={null} offline />, {
      wrapper: wrap(null, { open: () => {}, offline: true }),
    });
    await settle();
    expect(offlineSaveStarterRules).not.toHaveBeenCalled();
  });

  it('says so when This Browser can’t keep it', async () => {
    offlineSaveStarterRules.mockRejectedValueOnce(new Error('idb'));
    markPendingStarterRules('t1', 'kanban');
    render(<PendingStarterRules tabId="t1" projectId="p" offline />, {
      wrapper: wrap(null, { open: () => {}, offline: true }),
    });
    await settle();
    expect(toast.error).toHaveBeenCalledWith('failed');
  });

  it('drops the kind for a guest on a server plan, who can hold no rule', async () => {
    markPendingStarterRules('t1', 'kanban');
    render(<PendingStarterRules tabId="t1" projectId="p" offline={false} />, {
      wrapper: wrap(null, { open: () => {}, offline: true }),
    });
    await settle();
    expect(makeStarterRules).not.toHaveBeenCalled();
    expect(offlineSaveStarterRules).not.toHaveBeenCalled();
    expect(takePendingStarterRules('t1')).toBeNull();
  });

  it('keeps the kind while it is not yet known who may make rules', async () => {
    markPendingStarterRules('t1', 'kanban');
    render(<PendingStarterRules tabId="t1" projectId="p" offline={false} />, {
      wrapper: wrap(null, null),
    });
    render(<PendingStarterRules tabId={undefined} projectId="p" offline={false} />, {
      wrapper: wrap(access, null),
    });
    await settle();
    expect(makeStarterRules).not.toHaveBeenCalled();
    expect(takePendingStarterRules('t1')).toBe('kanban');
  });
});
