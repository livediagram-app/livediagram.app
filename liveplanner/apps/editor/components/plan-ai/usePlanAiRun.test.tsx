// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlanAiResponse } from '@liveplanner/api-schema';
import type { PlanAiRole } from '@liveplanner/items';
import { DraftRefusal } from '@/components/describe/draft-client';
import { planAiRoleOf } from './usePlanAiHost';
import { PLAN_AI_LOADING, PLAN_AI_MOVED_ON, usePlanAiRun } from './usePlanAiRun';
import type { PlanAiTab } from './plan-ai-host';
import {
  planAiThread,
  resetPlanAiThreads,
  startPlanAiTurn,
  updatePlanAiTurn,
  clearPlanAiThread,
  PLAN_AI_THREAD_MAX,
} from './plan-ai-thread';

// A Plan AI turn, for each role (docs/specs/026-plan/plan-ai.md "Share roles"): an Editor's and a Participant's
// changes are made, a Viewer's never are.

const asked = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('./plan-ai-client', () => ({ askPlanAi: asked.fn }));
const tracked = vi.hoisted(() => [] as string[]);
vi.mock('@/lib/telemetry', () => ({ track: (...a: string[]) => tracked.push(a.join('·')) }));

afterEach(() => {
  resetPlanAiThreads();
  asked.fn.mockReset();
  tracked.length = 0;
});

function host(over: Partial<PlanAiTab> = {}): PlanAiTab {
  return {
    kind: 'board',
    tabId: 't1',
    tabName: 'Roadmap',
    read: () => 'Board "Roadmap"',
    apply: vi.fn(async () => ({ lines: [{ text: 'Moved #1 to Done', ok: true }], steps: 2 })),
    ...over,
  };
}

const answer = (over: Partial<PlanAiResponse> = {}): PlanAiResponse => ({
  reply: 'Done.',
  changes: [{ op: 'move', item: '#1', status: 'Done' }],
  provider: 'built-in',
  role: 'edit',
  ...over,
});

function setup(
  role: PlanAiRole,
  tab = host(),
  extra: { builtIn?: boolean; teamId?: string | null } = {},
) {
  const undo = vi.fn();
  const view = renderHook(() =>
    usePlanAiRun({
      tabId: 't1',
      latest: () => tab,
      role,
      ownerId: 'u1',
      projectId: 'p1',
      teamId: extra.teamId ?? null,
      builtIn: extra.builtIn ?? false,
      undo,
    }),
  );
  return { run: view.result, tab, undo };
}

const last = () => planAiThread('t1').at(-1)!;

describe('usePlanAiRun', () => {
  it('an Editor’s turn sends the tab and makes the changes; Undo takes back each step', async () => {
    asked.fn.mockResolvedValue(answer());
    const { run, tab, undo } = setup('edit', host(), { builtIn: true, teamId: 'team1' });
    act(() => void run.current.ask('  Move the brief to Done  '));
    await waitFor(() => expect(last().status).toBe('done'));
    expect(asked.fn.mock.calls[0]![1]).toEqual({
      projectId: 'p1',
      kind: 'board',
      tabName: 'Roadmap',
      tab: 'Board "Roadmap"',
      instruction: 'Move the brief to Done',
      teamId: 'team1',
      ai: 'built-in',
    });
    expect(tab.apply).toHaveBeenCalledWith(answer().changes);
    expect(last()).toMatchObject({ reply: 'Done.', steps: 2, provider: 'built-in' });
    expect(tracked).toEqual(['Plan·Used·PlanAi', 'Plan·Changed·PlanAiChange']);
    act(() => run.current.undo(last().id));
    expect(undo).toHaveBeenCalledTimes(2);
    expect(last().undone).toBe(true);
    // Only once.
    act(() => run.current.undo(last().id));
    expect(undo).toHaveBeenCalledTimes(2);
    expect(tracked.at(-1)).toBe('Plan·Undone·PlanAiChange');
  });

  it('sends the last turns with a follow-up', async () => {
    asked.fn.mockResolvedValue(answer({ changes: [] }));
    const { run } = setup('edit');
    act(() => void run.current.ask('First'));
    await waitFor(() => expect(last().status).toBe('done'));
    act(() => void run.current.ask('Second'));
    await waitFor(() => expect(planAiThread('t1')).toHaveLength(2));
    expect((asked.fn.mock.calls[1]![1] as { turns: unknown }).turns).toEqual([
      { instruction: 'First', reply: 'Done.' },
    ]);
  });

  it('a Participant’s changes are made, as the api read them for that role', async () => {
    asked.fn.mockResolvedValue(answer({ role: 'participate' }));
    const { run, tab } = setup('participate');
    act(() => void run.current.ask('Move it'));
    await waitFor(() => expect(last().status).toBe('done'));
    expect(tab.apply).toHaveBeenCalled();
  });

  it('a Viewer asks and is answered, and nothing changes, whatever comes back', async () => {
    asked.fn.mockResolvedValue(answer({ role: 'edit' }));
    const { run, tab } = setup('view');
    act(() => void run.current.ask('Move it'));
    await waitFor(() => expect(last().status).toBe('done'));
    expect(tab.apply).not.toHaveBeenCalled();
    expect(last()).toMatchObject({ reply: 'Done.', steps: 0, lines: [] });
    asked.fn.mockResolvedValue(answer({ role: 'view' }));
    const editor = setup('edit');
    act(() => void editor.run.current.ask('Move it again'));
    await waitFor(() => expect(planAiThread('t1').at(-1)!.status).toBe('done'));
    expect(editor.tab.apply).not.toHaveBeenCalled();
  });

  it('says a refusal in the api’s words, and a failure in its own', async () => {
    asked.fn.mockRejectedValueOnce(new DraftRefusal(429, 'ask_built_in_limit', 'Used up.'));
    const { run } = setup('edit');
    act(() => void run.current.ask('One'));
    await waitFor(() => expect(last().status).toBe('failed'));
    expect(last().failure).toEqual({ message: 'Used up.', aiKey: null });
    asked.fn.mockRejectedValueOnce(new Error('network'));
    act(() => void run.current.ask('Two'));
    await waitFor(() => expect(last().status).toBe('failed'));
    expect(last().failure!.message).toMatch(/AI/);
  });

  it('says a tab still loading, and makes nothing when the tab changed under the answer', async () => {
    const loading = setup('edit', host({ read: () => null }));
    act(() => void loading.run.current.ask('Go'));
    expect(last().failure!.message).toBe(PLAN_AI_LOADING);
    resetPlanAiThreads();
    asked.fn.mockResolvedValue(answer());
    let current = host();
    const undo = vi.fn();
    const view = renderHook(() =>
      usePlanAiRun({
        tabId: 't1',
        latest: () => current,
        role: 'edit',
        ownerId: 'u1',
        projectId: 'p1',
        teamId: null,
        builtIn: false,
        undo,
      }),
    );
    act(() => {
      view.result.current.ask('Go');
      current = host({ tabId: 't2' });
    });
    await waitFor(() => expect(planAiThread('t1').at(-1)!.status).toBe('done'));
    expect(planAiThread('t1').at(-1)!.lines).toEqual([{ text: PLAN_AI_MOVED_ON, ok: false }]);
  });

  it('Stop drops the answer, so nothing changes; one turn at a time; New Chat clears', async () => {
    let resolve: (a: PlanAiResponse) => void = () => {};
    asked.fn.mockReturnValue(new Promise<PlanAiResponse>((r) => (resolve = r)));
    const { run, tab } = setup('edit');
    let taken = false;
    act(() => void run.current.ask('Go'));
    act(() => {
      taken = run.current.ask('Again');
    });
    expect(taken).toBe(false);
    act(() => run.current.clear());
    expect(planAiThread('t1')).toHaveLength(1);
    act(() => run.current.stop());
    expect(last().status).toBe('stopped');
    await act(async () => resolve(answer()));
    expect(tab.apply).not.toHaveBeenCalled();
    act(() => run.current.stop());
    act(() => run.current.clear());
    expect(planAiThread('t1')).toHaveLength(0);
    expect(run.current.ask('   ')).toBe(false);
  });
});

describe('the thread', () => {
  it('keeps its newest turns, and leaves a cleared turn alone', () => {
    for (let i = 0; i < PLAN_AI_THREAD_MAX + 2; i++) startPlanAiTurn('t9', `q${i}`);
    expect(planAiThread('t9')).toHaveLength(PLAN_AI_THREAD_MAX);
    clearPlanAiThread('t9');
    clearPlanAiThread('t9');
    updatePlanAiTurn('t9', 't1', { status: 'done' });
    expect(planAiThread('t9')).toEqual([]);
  });
});

describe('planAiRoleOf', () => {
  it('is an Editor, a Participant or a Viewer as the editor knows it', () => {
    expect(planAiRoleOf(false, true)).toBe('edit');
    expect(planAiRoleOf(true, true)).toBe('participate');
    expect(planAiRoleOf(true, false)).toBe('view');
  });
});
