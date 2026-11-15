// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceIdentity } from '@/lib/explorer/token';

// The Explorer's bounded wait for the person (liveworkspace/docs/specs/010-site/site.md "The Explorer"): 2026-11-15, a
// token answer that never came kept every app's Explorer on its placeholders. Now Try Again shows in their place.

const token = vi.hoisted(() => ({
  workspaceIdentity: vi.fn<() => Promise<WorkspaceIdentity | null>>(),
  resetWorkspaceIdentity: vi.fn(),
}));
const telemetry = vi.hoisted(() => ({ trackExplorerStalled: vi.fn() }));
vi.mock('@/lib/explorer/token', () => token);
vi.mock('@/lib/explorer/telemetry', () => telemetry);

import { IDENTITY_WAIT_MS, useExplorerIdentity } from './useExplorerIdentity';
import { EXPLORER_UNREACHABLE_COPY, ExplorerUnreachable } from './ExplorerUnreachable';

const ADA: WorkspaceIdentity = { token: 't', kind: 'account', sub: 'user_1', expiresAt: 0 };
const never = () => new Promise<WorkspaceIdentity | null>(() => {});

beforeEach(() => {
  vi.useFakeTimers();
  token.workspaceIdentity.mockReset();
  token.resetWorkspaceIdentity.mockReset();
  telemetry.trackExplorerStalled.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const mount = (ready = true) =>
  renderHook(({ ready: r }) => useExplorerIdentity({ ready: r, sessionState: 'in' }), {
    initialProps: { ready },
  });

describe('useExplorerIdentity', () => {
  it('asks nothing until the page knows where it is, then knows the person', async () => {
    token.workspaceIdentity.mockResolvedValue(ADA);
    const hook = mount(false);
    expect(token.workspaceIdentity).not.toHaveBeenCalled();
    hook.rerender({ ready: true });
    await act(async () => {});
    expect(hook.result.current.identity).toBe(ADA);
    expect(hook.result.current.failed).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(IDENTITY_WAIT_MS));
    expect(telemetry.trackExplorerStalled).not.toHaveBeenCalled();
  });

  it('gives up on an answer that never comes, counts it once, and still takes a late one', async () => {
    let answer: (found: WorkspaceIdentity) => void = () => {};
    token.workspaceIdentity.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const hook = mount();
    await act(async () => vi.advanceTimersByTimeAsync(IDENTITY_WAIT_MS - 1));
    expect(hook.result.current.failed).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(hook.result.current.failed).toBe(true);
    expect(telemetry.trackExplorerStalled).toHaveBeenCalledTimes(1);
    await act(async () => answer(ADA));
    expect(hook.result.current.identity).toBe(ADA);
    expect(hook.result.current.failed).toBe(false);
  });

  it('says so at once on a failed answer, and Try Again asks afresh', async () => {
    token.workspaceIdentity.mockResolvedValueOnce(null).mockResolvedValueOnce(ADA);
    const hook = mount();
    await act(async () => {});
    expect(hook.result.current.failed).toBe(true);
    expect(telemetry.trackExplorerStalled).toHaveBeenCalledTimes(1);
    act(() => hook.result.current.retry());
    expect(token.resetWorkspaceIdentity).toHaveBeenCalledTimes(1);
    await act(async () => {});
    expect(token.workspaceIdentity).toHaveBeenCalledTimes(2);
    expect(hook.result.current.identity).toBe(ADA);
    expect(hook.result.current.failed).toBe(false);
  });

  it('drops a superseded answer once unmounted', async () => {
    token.workspaceIdentity.mockImplementation(never);
    const hook = mount();
    hook.unmount();
    await act(async () => vi.advanceTimersByTimeAsync(IDENTITY_WAIT_MS));
    expect(telemetry.trackExplorerStalled).not.toHaveBeenCalled();
  });
});

describe('ExplorerUnreachable', () => {
  it('says what happened, with Try Again and the status page', () => {
    const onRetry = vi.fn();
    render(<ExplorerUnreachable onRetry={onRetry} />);
    expect(screen.getByText(EXPLORER_UNREACHABLE_COPY.title)).toBeTruthy();
    act(() => screen.getByRole('button', { name: EXPLORER_UNREACHABLE_COPY.retry }).click());
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Check the Status Page' }).getAttribute('href')).toBe(
      '/status',
    );
  });
});
