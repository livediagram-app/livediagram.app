// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Incoming Webhook": Make Secret's answer reaches the plan's listed rule, so the
// builder opened again shows the secret's last 4 and Regenerate, not Make Secret, until the list is next read.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutomationHookInfo } from '@liveplanner/api-schema';

const client = vi.hoisted(() => ({ listAutomations: vi.fn(), toggleRule: vi.fn() }));
vi.mock('./automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./automations-client')>()),
  ...client,
}));

import { foldHook, forgetAutomations, readAutomations, useAutomations } from './use-automations';

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };
const URL_ = 'https://www.liveplanner.app/api/hooks/automations/p1/r1';

afterEach(() => {
  forgetAutomations();
  client.listAutomations.mockReset();
  client.toggleRule.mockReset();
});

describe('foldHook', () => {
  it('puts the new secret on its rule and leaves the others', async () => {
    const rules = [
      { id: 'r1', hook: { url: URL_, secret: null } },
      { id: 'r2', hook: { url: `${URL_}2`, secret: null } },
    ];
    client.listAutomations.mockResolvedValue({ rules });
    await readAutomations(SCOPE);
    const { result } = renderHook(() => useAutomations(SCOPE, false));
    const hook: AutomationHookInfo = {
      url: URL_,
      secret: { last4: 'Xf3k', madeAt: 1, usedAt: null },
    };
    act(() => foldHook(SCOPE, 'r1', hook));
    const listed = result.current.data!.rules;
    expect(listed[0]!.hook).toEqual(hook);
    expect(listed[1]!.hook!.secret).toBeNull();
  });

  it('does nothing before the list is read', () => {
    const { result } = renderHook(() => useAutomations(SCOPE, false));
    act(() => foldHook(SCOPE, 'r1', { url: URL_, secret: null }));
    expect(result.current.data).toBeNull();
  });
});

// docs/specs/026-plan/automations.md "The Automations screen": what was read before shows while the screen reads the
// list again, so a change can be answered while that read is under way.
describe('a change answered while the list is read', () => {
  const rule = (enabled: boolean) => ({ id: 'r1', name: 'Done stamp', enabled });
  const deferred = <T>() => {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
  };

  it('reads again, so a read served before the change never undoes it', async () => {
    client.listAutomations.mockResolvedValueOnce({ rules: [rule(true)] });
    await readAutomations(SCOPE);
    const { result } = renderHook(() => useAutomations(SCOPE, false));
    // The screen opens again: a read starts, served before the toggle lands.
    const before = deferred<unknown>();
    client.listAutomations.mockReturnValueOnce(before.promise);
    client.listAutomations.mockResolvedValueOnce({ rules: [rule(false)] });
    client.toggleRule.mockResolvedValueOnce({ rule: rule(false) });
    let reading!: Promise<boolean>;
    act(() => {
      reading = readAutomations(SCOPE);
    });
    await act(() => result.current.toggle('r1', false).then(() => {}));
    expect(result.current.data!.rules[0]!.enabled).toBe(false);
    await act(async () => {
      before.resolve({ rules: [rule(true)] });
      await reading;
    });
    expect(result.current.data!.rules[0]!.enabled).toBe(false);
    expect(client.listAutomations).toHaveBeenCalledTimes(3);
  });

  it('lands a change on the plan it was made on, when another plan is open by then', async () => {
    const OTHER = { ...SCOPE, projectId: 'p2' };
    client.listAutomations.mockResolvedValueOnce({ rules: [rule(true)] });
    await readAutomations(SCOPE);
    client.listAutomations.mockResolvedValueOnce({ rules: [{ ...rule(true), id: 'r9' }] });
    await readAutomations(OTHER);
    const answer = deferred<unknown>();
    client.toggleRule.mockReturnValueOnce(answer.promise);
    const { result, rerender } = renderHook(({ scope }) => useAutomations(scope, false), {
      initialProps: { scope: SCOPE },
    });
    const toggled = result.current.toggle('r1', false);
    rerender({ scope: OTHER });
    await act(async () => {
      answer.resolve({ rule: rule(false) });
      await toggled;
    });
    expect(result.current.data!.rules.map((r) => r.id)).toEqual(['r9']);
    rerender({ scope: SCOPE });
    expect(result.current.data!.rules[0]!.enabled).toBe(false);
  });
});
