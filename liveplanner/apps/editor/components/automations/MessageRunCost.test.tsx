// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "What the editor shows": with Pro on an outgoing step's panel says each message
// counts as one of the owner's automation runs, on every tier, with no gate and no badge on the step, its action in
// the Add an Action picker or a template that sends one. Nothing of it with Pro off.
import './test-kit';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { AutomationsListResponse } from '@liveplanner/api-schema';
import type { AutomationOutgoing } from '@liveplanner/items';
import type { Usage } from '@liveworkspace/subscription';
import { setProForTests } from '@liveworkspace/subscription-ui/testing';
import { usePlanTier } from '@/components/tier/plan-tier';
import { ownerOf, proOnForTests, proService, withPro, type Who } from '@/test/pro';
import { AddActionDialog } from '@liveworkspace/automations-ui/AddActionDialog';
import {
  AutomationsTierContext,
  automationsTierOf,
} from '@liveworkspace/automations-ui/tier/automations-tier';
import { OutgoingPanel } from '@liveworkspace/automations-ui/step-panels/OutgoingPanel';
import { TemplatesGallery } from '@liveworkspace/automations-ui/TemplatesGallery';
import { newRuleBody } from './rule-draft';
import { pickerTile } from './test-fixtures';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

proOnForTests();
afterEach(cleanup);

type Limits = Pick<AutomationsListResponse, 'runsPerDay' | 'rulesMax'>;
const FREE: Limits = { runsPerDay: 1000, rulesMax: 50 };

// The screen's tier, as AutomationsDialog provides it from the list.
function Tier({ who, limits, children }: { who: Who; limits: Limits; children: ReactNode }) {
  const plan = usePlanTier(ownerOf(who));
  return (
    <AutomationsTierContext value={automationsTierOf(limits, plan)}>
      {children}
    </AutomationsTierContext>
  );
}

function show(who: Who, limits: Limits, node: ReactNode, usage: Usage = {}) {
  const service = proService(who, usage);
  render(
    withPro(
      <Tier who={who} limits={limits}>
        {node}
      </Tier>,
      service.fetcher,
    ),
  );
  return service;
}

const STEP: AutomationOutgoing = { kind: 'notify', via: 'webhook', webhook: '', text: 'Shipped' };
const panel = (
  <OutgoingPanel
    step={STEP}
    invalidPath={null}
    onChange={() => {}}
    change={{ rest: newRuleBody('New Rule', 'UTC'), last: true, onKind: () => {} }}
  />
);
const cost = () => document.querySelector('[data-message-run-cost]');

describe('an outgoing step’s panel', () => {
  it('says what each message costs, on Free too, with no gate', async () => {
    show('owner', FREE, panel);
    expect(
      await screen.findByText('Each message this step sends counts as one automation run.'),
    ).toBeTruthy();
    expect(document.querySelector('[data-pro-gate]')).toBeNull();
    expect(screen.getByRole('textbox', { name: /Message/ })).toBeTruthy();
  });

  it('draws the panel as it always was with Pro off', () => {
    setProForTests(false);
    const { calls } = show('owner', FREE, panel);
    expect(cost()).toBeNull();
    expect(document.querySelector('[data-pro-badge]')).toBeNull();
    expect(screen.getByRole('textbox', { name: /Message/ })).toBeTruthy();
    expect(calls).toEqual([]);
  });
});

describe('the Add an Action picker', () => {
  const picker = (
    <AddActionDialog
      body={newRuleBody('New Rule', 'Europe/London')}
      where="top"
      onClose={() => {}}
      onPick={() => {}}
    />
  );
  const badged = () =>
    ['notify_webhook', 'notify_slack', 'notify_teams', 'move', 'ai_summarise'].filter((kind) =>
      pickerTile(kind)?.querySelector('[data-pro-badge]'),
    );

  it('badges no action, and says what is left of the month’s AI credits', async () => {
    show('owner', FREE, picker, { aiCredits: { used: 12 } });
    expect(
      await screen.findByText('100 a day per plan · 38 of 50 AI credits left this month'),
    ).toBeTruthy();
    expect(badged()).toEqual([]);
    expect(pickerTile('notify_webhook')).toHaveProperty('disabled', false);
    expect(screen.getByText(/38 of 50 AI credits left/).getAttribute('data-picker-note')).toBe('');
  });

  it('tones the AI note amber once the month’s credits are used, as a meter at its limit', async () => {
    show('owner', FREE, picker, { aiCredits: { used: 50 } });
    const note = await screen.findByText('100 a day per plan · 0 of 50 AI credits left this month');
    expect(note.getAttribute('data-picker-note')).toBe('limit');
    expect(note.className).toContain('text-amber-700');
  });

  it('says only the day’s cap with Pro off', () => {
    setProForTests(false);
    show('owner', FREE, picker);
    expect(badged()).toEqual([]);
    expect(screen.getByText('100 a day per plan')).toBeTruthy();
  });
});

describe('the templates', () => {
  it('badges none, a template that sends a message included', async () => {
    show('owner', FREE, <TemplatesGallery onPick={() => {}} />);
    await waitFor(() =>
      expect(document.querySelector('[data-template="shipped-to-slack"]')).not.toBeNull(),
    );
    expect(document.querySelector('[data-template] [data-pro-badge]')).toBeNull();
  });
});
