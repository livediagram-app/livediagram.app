// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "What the editor shows": who is looking at a plan's limits. With Pro off, or no
// owner from the api, nothing is asked and the answer is off. With it on the action follows the plan's owner, and the
// owner's usage is read only by the owner and the owning team.
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { setProForTests } from '@liveworkspace/subscription-ui/testing';
import { ownerOf, proOnForTests, proService, withPro, type Who } from '@/test/pro';
import { tierUsage, usePlanTier } from './plan-tier';

proOnForTests();

function tierOf(who: Who, usage = {}) {
  const { fetcher, calls } = proService(who, usage);
  const hook = renderHook(() => usePlanTier(ownerOf(who)), {
    wrapper: ({ children }: { children: ReactNode }) => withPro(children, fetcher),
  });
  return { hook, calls };
}

describe('usePlanTier', () => {
  it('is off and asks nothing with Pro off in the build', async () => {
    setProForTests(false);
    const { hook, calls } = tierOf('owner');
    expect(hook.result.current.on).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toEqual([]);
  });

  it('is off when the api named no owner (Pro off on the server)', () => {
    const { fetcher } = proService('owner');
    const hook = renderHook(() => usePlanTier(undefined), {
      wrapper: ({ children }: { children: ReactNode }) => withPro(children, fetcher),
    });
    expect(hook.result.current.on).toBe(false);
    expect(hook.result.current.action).toBe('none');
  });

  it('the owner: may upgrade to Pro, hears the tier, and reads their own usage', async () => {
    const { hook } = tierOf('owner', { aiCredits: { used: 12 } });
    await waitFor(() => expect(hook.result.current.action).toBe('upgrade'));
    const tier = hook.result.current;
    expect(tier.voice).toEqual({
      tier: 'Free',
      offer: { tier: 'pro', name: 'Pro' },
      whose: 'yours',
    });
    expect(tier.paid).toBe(false);
    await waitFor(() =>
      expect(tierUsage(hook.result.current, 'aiCredits')).toEqual({ used: 12, limit: 50 }),
    );
  });

  it('an owner on Pro: nothing higher to offer, and the solid badge', async () => {
    const { hook } = tierOf('owner-pro');
    await waitFor(() => expect(hook.result.current.action).toBe('manage'));
    expect(hook.result.current.voice.offer).toBeNull();
    expect(hook.result.current.voice.tier).toBe('Pro');
    expect(hook.result.current.paid).toBe(true);
  });

  it('a team’s admin is offered Pro for Teams, a member is not, and both read the team’s usage', async () => {
    const admin = tierOf('admin', { automationRuns: { used: 3 } });
    await waitFor(() => expect(admin.hook.result.current.action).toBe('upgrade'));
    expect(admin.hook.result.current.voice.offer).toEqual({ tier: 'team', name: 'Pro for Teams' });
    admin.hook.unmount();
    const member = tierOf('member', { aiCredits: { used: 50 } });
    await waitFor(() => expect(member.hook.result.current.action).toBe('ask_admin'));
    expect(member.hook.result.current.voice).toEqual({ tier: 'Free', offer: null, whose: 'team' });
    await waitFor(() => expect(member.hook.result.current.summary?.usage.aiCredits?.used).toBe(50));
  });

  it('a collaborator: no action, no tier named, and none of the owner’s usage', async () => {
    const { hook, calls } = tierOf('collaborator');
    await waitFor(() => expect(calls.some((c) => c.path.startsWith('/owner'))).toBe(true));
    await waitFor(() => expect(hook.result.current.owner.status).toBe('ready'));
    const tier = hook.result.current;
    expect(tier.action).toBe('none');
    expect(tier.voice).toEqual({ tier: null, offer: null, whose: 'owner' });
    expect(tier.summary).toBeNull();
    expect(tierUsage(tier, 'aiCredits')).toBeNull();
  });
});
