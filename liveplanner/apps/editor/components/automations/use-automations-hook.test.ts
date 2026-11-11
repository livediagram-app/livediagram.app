// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Incoming Webhook": Make Secret's answer reaches the plan's listed rule, so the
// builder opened again shows the secret's last 4 and Regenerate, not Make Secret, until the list is next read.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutomationHookInfo } from '@liveplanner/api-schema';

const client = vi.hoisted(() => ({ listAutomations: vi.fn() }));
vi.mock('./automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./automations-client')>()),
  ...client,
}));

import { foldHook, forgetAutomations, readAutomations, useAutomations } from './use-automations';

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };
const URL_ = 'https://www.liveplanner.app/api/hooks/automations/p1/r1';

afterEach(forgetAutomations);

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
