// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "What the editor shows" (AI Credits), describe-a-plan.md and describe-a-form.md
// "Limits and cost": an AI ask says what it costs and, to someone who may know, what is left of the month's credits;
// with none left it says when they start again, with the right way on for whoever is looking. A rule's credits are
// its plan's owner's; a plan or form described is nobody's yet, so its credit is the person's own.
import '@/components/automations/test-kit';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { PLAN_DRAFT_COLOURS, type PlanDraft } from '@liveplanner/items';
import type { Usage } from '@liveworkspace/subscription';
import { setProForTests } from '@liveworkspace/subscription-ui/testing';
import { AutomationRefusal } from '@/components/automations/automations-client';
import {
  AutomationsTierContext,
  automationsTierOf,
} from '@liveworkspace/automations-ui/tier/automations-tier';
import { DescribeRuleDialog } from '@liveworkspace/automations-ui/DescribeRuleDialog';
import { AiStepPanel } from '@/components/automations/step-panels/AiStepPanel';
import { outline } from '@/components/automations/test-fixtures';
import { DescribeFormDialog } from '@/components/forms/describe-form/DescribeFormDialog';
import { FormDraftRefusal } from '@/components/forms/describe-form/form-draft-client';
import { DescribePlanDialog } from '@/components/plan/start/describe-plan/DescribePlanDialog';
import { PlanDraftRefusal } from '@/components/plan/start/describe-plan/plan-draft-client';
import { ownerOf, proOnForTests, proService, withPro, type Who } from '@/test/pro';
import { usePlanTier } from './plan-tier';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

proOnForTests();
// A fixed day, so "1 December" is the first of the month after it.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 10, 20, 12) });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const USED = { limit: 'aiCreditsPerMonth', used: 50, max: 50 } as const;
const STARTS = new RegExp(
  `This month’s AI credits are used\\. They start again on ${new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(Date.UTC(2026, 11, 1))}\\.`,
);

function Tier({ who, children }: { who: Who; children: ReactNode }) {
  const plan = usePlanTier(ownerOf(who));
  return (
    <AutomationsTierContext value={automationsTierOf({ runsPerDay: 1000, rulesMax: 50 }, plan)}>
      {children}
    </AutomationsTierContext>
  );
}

const type = (label: string, words: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value: words } });

describe('Describe a Rule', () => {
  function open(who: Who, usage: Usage = {}, draft = vi.fn()) {
    const onByHand = vi.fn();
    const service = proService(who, usage);
    render(
      withPro(
        <Tier who={who}>
          <DescribeRuleDialog
            draft={draft}
            onDrafted={() => {}}
            onByHand={onByHand}
            onClose={() => {}}
          />
        </Tier>,
        service.fetcher,
      ),
    );
    return { ...service, draft, onByHand };
  }
  const refusing = () =>
    vi
      .fn()
      .mockRejectedValue(
        new AutomationRefusal(429, { error: 'automation_ai_credits_used', message: 'x', ...USED }),
      );

  it('says a draft uses a credit and, to the owner, how many are left', async () => {
    open('owner', { aiCredits: { used: 12 } });
    expect(await screen.findByText('A draft uses 1 AI credit.')).toBeTruthy();
    const meter = await screen.findByRole('meter', { name: 'AI Credits' });
    expect(meter.getAttribute('aria-valuetext')).toBe('38 of 50 AI credits left this month');
    // The day's cap is still said, as before.
    expect(screen.getByText(/counts toward this plan’s 100 AI steps a day/)).toBeTruthy();
  });

  it('tells a collaborator the cost, never what the owner has left', async () => {
    const { calls } = open('collaborator');
    await waitFor(() => expect(calls.some((c) => c.path.startsWith('/owner'))).toBe(true));
    expect(await screen.findByText('A draft uses 1 AI credit.')).toBeTruthy();
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('a refused draft offers the owner the upgrade and Build the Rule by Hand', async () => {
    const { draft, onByHand } = open('owner', {}, refusing());
    type('Describe the rule', 'flag overdue cards');
    fireEvent.click(screen.getByRole('button', { name: /Draft Rule/ }));
    const notice = await screen.findByRole('status');
    expect(draft).toHaveBeenCalledTimes(1);
    expect(notice.textContent).toMatch(STARTS);
    expect(notice.textContent).toContain('Pro has 1,000 a month.');
    await waitFor(() =>
      expect(within(notice).getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy(),
    );
    fireEvent.click(within(notice).getByRole('button', { name: 'Build the Rule by Hand' }));
    expect(onByHand).toHaveBeenCalled();
    // The words stay to use later, and Draft Rule waits for the month.
    expect(screen.getByRole('textbox', { name: 'Describe the rule' })).toHaveProperty(
      'value',
      'flag overdue cards',
    );
    expect(screen.getByRole('button', { name: /Draft Rule/ })).toHaveProperty('disabled', true);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a refused draft points a team’s member at an admin', async () => {
    open('member', {}, refusing());
    type('Describe the rule', 'flag overdue cards');
    fireEvent.click(screen.getByRole('button', { name: /Draft Rule/ }));
    const notice = await screen.findByRole('status');
    await waitFor(() =>
      expect(within(notice).getByRole('button', { name: 'Ask an Admin' })).toBeTruthy(),
    );
    expect(notice.textContent).toContain('A team admin can move this team to Pro for Teams.');
    expect(within(notice).queryByRole('button', { name: /Upgrade/ })).toBeNull();
  });

  it('a refused draft tells a collaborator what happened, with only the way on by hand', async () => {
    open('collaborator', {}, refusing());
    type('Describe the rule', 'flag overdue cards');
    fireEvent.click(screen.getByRole('button', { name: /Draft Rule/ }));
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toMatch(STARTS);
    expect(notice.textContent).not.toMatch(/Pro has|team admin/);
    expect(
      within(notice)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Build the Rule by Hand']);
  });

  it('knows the credits are used before asking, from the owner’s own usage', async () => {
    const { draft } = open('owner', { aiCredits: { used: 50 } });
    expect((await screen.findByRole('status')).textContent).toMatch(STARTS);
    type('Describe the rule', 'flag overdue cards');
    expect(screen.getByRole('button', { name: /Draft Rule/ })).toHaveProperty('disabled', true);
    expect(draft).not.toHaveBeenCalled();
  });

  it('with Pro off is as it always was: a refusal in the api’s words, and no credits line', async () => {
    setProForTests(false);
    const draft = vi.fn().mockRejectedValue(
      new AutomationRefusal(429, {
        error: 'automation_ai_capped',
        message: 'Try again tomorrow.',
      }),
    );
    const { calls } = open('owner', {}, draft);
    expect(screen.queryByText('A draft uses 1 AI credit.')).toBeNull();
    type('Describe the rule', 'flag overdue cards');
    fireEvent.click(screen.getByRole('button', { name: /Draft Rule/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Try again tomorrow.');
    expect(calls).toEqual([]);
  });
});

describe('an AI step’s panel', () => {
  const panel = (
    <AiStepPanel step={{ kind: 'ai', task: 'summarise' }} outline={outline()} onChange={() => {}} />
  );

  it('says what a run costs and what is left, and that the step is skipped once none is', async () => {
    const service = proService('owner', { aiCredits: { used: 50 } });
    render(withPro(<Tier who="owner">{panel}</Tier>, service.fetcher));
    expect(await screen.findByText('Each run of this step uses 1 AI credit.')).toBeTruthy();
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain(
      'Until then this step is skipped and the rest of the rule runs.',
    );
    await waitFor(() =>
      expect(within(notice).getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy(),
    );
    expect(screen.getByRole('meter', { name: 'AI Credits' }).getAttribute('aria-valuetext')).toBe(
      '0 of 50 AI credits left this month',
    );
  });

  it('with Pro off says only the day’s cap', () => {
    setProForTests(false);
    render(panel);
    expect(screen.getByText(/counts toward this plan’s 100 AI steps a day/)).toBeTruthy();
    expect(screen.queryByText(/AI credit/)).toBeNull();
  });
});

describe('Describe a Plan', () => {
  const PLAN: PlanDraft = {
    title: 'Hiring',
    columns: ['Applied', 'Offer'],
    cardTypes: [
      {
        name: 'Candidate',
        color: PLAN_DRAFT_COLOURS[0]!,
        glyph: 'person',
        builtInFields: [],
        fields: [],
      },
    ],
  };
  function open(who: Who, usage: Usage, draft: (prompt: string) => Promise<{ draft: PlanDraft }>) {
    const service = proService(who, usage);
    render(
      withPro(
        <DescribePlanDialog
          signedIn
          signInHref="/sign-in/"
          draft={draft}
          plan={{ catalogue: null, statuses: [] }}
          planTypes={[]}
          rulesMade
          onMake={() => null}
          onClose={() => {}}
        />,
        service.fetcher,
      ),
    );
    return service;
  }

  it('counts the person’s own credits, and reads them again once a draft has settled', async () => {
    const { calls } = open('owner', { aiCredits: { used: 12 } }, async () => ({ draft: PLAN }));
    expect(await screen.findByText('A draft uses 1 AI credit.')).toBeTruthy();
    expect(
      (await screen.findByRole('meter', { name: 'AI Credits' })).getAttribute('aria-valuetext'),
    ).toBe('38 of 50 AI credits left this month');
    const reads = () => calls.filter((c) => c.path === '/me').length;
    const before = reads();
    type('Describe the plan', 'a hiring pipeline');
    fireEvent.click(screen.getByRole('button', { name: /Draft Plan/ }));
    await screen.findByText('Check Your Plan');
    await waitFor(() => expect(reads()).toBeGreaterThan(before));
  });

  it('refused, offers someone on Free the upgrade and holds Draft Plan', async () => {
    const refusal = new PlanDraftRefusal(429, 'plan_draft_credits_used', 'x');
    refusal.tier = { ...USED };
    open('owner', {}, () => Promise.reject(refusal));
    type('Describe the plan', 'a hiring pipeline');
    fireEvent.click(screen.getByRole('button', { name: /Draft Plan/ }));
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toMatch(STARTS);
    await waitFor(() =>
      expect(within(notice).getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: /Draft Plan/ })).toHaveProperty('disabled', true);
  });

  it('refused, tells someone on Pro when they start again, with no offer', async () => {
    const refusal = new PlanDraftRefusal(429, 'plan_draft_credits_used', 'x');
    refusal.tier = { limit: 'aiCreditsPerMonth', used: 1000, max: 1000 };
    const { calls } = open('owner-pro', {}, () => Promise.reject(refusal));
    await waitFor(() => expect(calls.some((c) => c.path.startsWith('/owner'))).toBe(true));
    type('Describe the plan', 'a hiring pipeline');
    fireEvent.click(screen.getByRole('button', { name: /Draft Plan/ }));
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toMatch(STARTS);
    expect(within(notice).queryByRole('button')).toBeNull();
  });

  it('with Pro off shows no credits line and asks the service nothing', async () => {
    setProForTests(false);
    const { calls } = open('owner', {}, async () => ({ draft: PLAN }));
    expect(screen.getByText(/plans and forms share/)).toBeTruthy();
    expect(screen.queryByText('A draft uses 1 AI credit.')).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('Describe a Form', () => {
  it('refused, shows the same notice and holds Draft Form', async () => {
    const refusal = new FormDraftRefusal(429, 'form_draft_credits_used', 'x');
    refusal.tier = { ...USED };
    const service = proService('owner', { aiCredits: { used: 49 } });
    render(
      withPro(
        <DescribeFormDialog
          signedIn
          signInHref="/sign-in/"
          draft={() => Promise.reject(refusal)}
          options={[]}
          typeLabelFor={(h) => h}
          onCreate={() => null}
          onClose={() => {}}
        />,
        service.fetcher,
      ),
    );
    expect(await screen.findByText('A draft uses 1 AI credit.')).toBeTruthy();
    type('Describe the form', 'an rsvp');
    fireEvent.click(screen.getByRole('button', { name: /Draft Form/ }));
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toMatch(STARTS);
    await waitFor(() =>
      expect(within(notice).getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: /Draft Form/ })).toHaveProperty('disabled', true);
  });
});
