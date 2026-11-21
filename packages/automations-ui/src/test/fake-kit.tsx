// Tests only: the least an app hands the screen. Two triggers (one a time with nobody behind it), two conditions,
// two actions of its own (one that ends the rule) beside the steps every app has, one template, no branch, a subject
// that is a tab, and a client that answers from memory.

import { vi, type Mock } from 'vitest';
import type { AutomationKind, AutomationOutgoing } from '@liveworkspace/automations';
import type { IndexClient } from '@liveworkspace/index-client';
import type { AutomationsClient } from '../automations-client';
import { NOTIFY_GLYPHS, WaitGlyph, BoltIcon } from '../glyphs';
import {
  defineAutomationsKit,
  TEST_RULE,
  type ActionKind,
  type AnyAutomationsKit,
  type AutomationsKit,
  type AutomationsPlumbing,
  type AutomationsView,
} from '../kit';
import { ScheduledPanel, freshScheduled } from '../step-panels/ScheduledPanel';
import { TestRuleDialog } from '../TestRule';
import type { ListedRule, ListedRun, RuleBody } from '../types';
import { valueGroup, WEBHOOK_VALUE_GROUP } from '../value-groups';

export type FakeOutline = { tabs: readonly string[] };
export const OUTLINE: FakeOutline = { tabs: ['Roadmap', 'Notes'] };

export const SCOPE = { ownerId: 'o1', itemId: 'i1', shareCode: null };

export function fakeRule(over: Partial<ListedRule> = {}): ListedRule {
  return {
    id: 'r1',
    name: 'Nightly Snapshot',
    enabled: true,
    trigger: { kind: 'tab_added' },
    conditions: [],
    steps: [{ kind: 'take_snapshot', name: 'Nightly' } as AutomationKind],
    chain: false,
    timeZone: 'UTC',
    edited: { by: { name: 'Ana Costa' }, at: 0 },
    stats: { lastRunAt: null, runsThisWeek: 0, failuresInARow: 0 },
    attention: [],
    ...over,
  };
}

export function fakeRun(over: Partial<ListedRun> = {}): ListedRun & { tab: string | null } {
  return {
    id: 'run1',
    ruleId: 'r1',
    ruleName: 'Nightly Snapshot',
    at: Date.UTC(2026, 10, 20, 9),
    result: 'done',
    tookMs: 12,
    steps: [
      { kind: 'trigger', text: 'Ana Costa added a tab', by: { name: 'Ana Costa' } },
      { kind: 'action', ok: true, text: 'Would take a snapshot “Nightly”' },
    ],
    tab: 'Roadmap',
    ...over,
  };
}

export type FakeClient = AutomationsClient & Record<keyof AutomationsClient, Mock>;

export function fakeClient(rules: ListedRule[] = [fakeRule()]): FakeClient {
  const held = [...rules];
  const client: FakeClient = {
    list: vi.fn(async () => ({ rules: [...held], runsToday: 3, runsPerDay: 1000 })),
    create: vi.fn(async (_scope: unknown, body: RuleBody) => {
      const rule = fakeRule({ ...body, id: `r${held.length + 1}`, enabled: false });
      held.push(rule);
      return { rule };
    }),
    update: vi.fn(async (_scope: unknown, id: string, body: RuleBody) => ({
      rule: fakeRule({ ...body, id }),
    })),
    toggle: vi.fn(async (_scope: unknown, id: string, enabled: boolean) => ({
      rule: fakeRule({ id, enabled }),
    })),
    duplicate: vi.fn(async (_scope: unknown, id: string) => ({
      rule: fakeRule({ id: `${id}-copy`, name: 'Nightly Snapshot 2' }),
    })),
    remove: vi.fn(async () => {}),
    test: vi.fn(async () => ({ run: fakeRun() })),
    draft: vi.fn(async () => ({
      rule: { ...fakeRule(), name: 'Drafted' } as RuleBody,
      picks: [],
    })),
    run: vi.fn(async () => ({ run: fakeRun() })),
    runs: vi.fn(async () => ({ runs: [fakeRun()] })),
    makeSecret: vi.fn(async () => ({
      secret: 'lws_secret',
      hook: {
        url: 'https://example.test/hook',
        secret: { last4: 'cret', madeAt: 0, usedAt: null },
      },
    })),
    summary: vi.fn(),
  };
  return client;
}

const action = (
  name: string,
  over: Partial<ActionKind<AutomationKind, FakeOutline>> = {},
): ActionKind<AutomationKind, FakeOutline> => ({
  name,
  line: `${name}.`,
  glyph: BoltIcon,
  scene: () => <span data-scene={name} />,
  fresh: () => ({ kind: 'take_snapshot', name: '' }) as AutomationKind,
  ...over,
});

const message = (via: AutomationOutgoing['via'], name: string) =>
  action(name, {
    glyph: NOTIFY_GLYPHS[via],
    fresh: () => ({ kind: 'notify', via, webhook: '', text: 'Hello' }) as AutomationKind,
    top: true,
  });

export function fakeKit(
  client: AutomationsClient,
  over: Partial<AutomationsKit<AutomationKind, AutomationKind, AutomationKind, FakeOutline>> = {},
  views: readonly AutomationsView[] = [],
): { kit: AnyAutomationsKit; plumbing: AutomationsPlumbing; track: Mock } {
  const track = vi.fn();
  const plumbing: AutomationsPlumbing = {
    words: {
      item: 'Space',
      subject: 'tab',
      toolLine: 'Rules that act on this Space for you.',
      subtitle: 'Rules this Space runs for you.',
      empty: 'A rule watches this Space.',
      test: TEST_RULE,
    },
    client,
    track,
  };
  const kit = defineAutomationsKit<
    AutomationKind,
    AutomationKind,
    AutomationKind,
    FakeOutline,
    ListedRule,
    ListedRun,
    never
  >({
    plumbing,
    helpButton: <a href="/help">How Rules Work</a>,
    kinds: {
      triggerGroups: [
        { id: 'item', name: 'This Space', kinds: ['tab_added'] },
        { id: 'times', name: 'Times', kinds: ['scheduled'] },
      ],
      triggerHint: 'Try another word.',
      triggers: {
        tab_added: {
          name: 'Tab Added',
          line: 'A tab is added.',
          scene: () => <span data-scene="tab_added" />,
          fresh: () => ({ kind: 'tab_added' }),
        },
        scheduled: {
          name: 'Scheduled',
          line: 'A time comes round.',
          time: true,
          personless: true,
          scene: () => <span data-scene="scheduled" />,
          fresh: freshScheduled,
          Panel: ScheduledPanel as never,
        },
      },
      triggerOrder: ['tab_added', 'scheduled'],
      firstTrigger: 'tab_added',
      conditions: {
        tab: {
          name: 'Tab',
          fresh: (outline) => ({ kind: 'tab', tabs: outline.tabs.slice(0, 1) }) as AutomationKind,
          Panel: ({ condition }) => (
            <p data-condition-panel="">
              {(condition as unknown as { tabs: string[] }).tabs.join()}
            </p>
          ),
        },
        day: { name: 'Day of Week', fresh: () => ({ kind: 'day' }) },
      },
      actionGroups: [
        { id: 'snapshots', name: 'Snapshots', kinds: ['take_snapshot', 'revert_snapshot'] },
        { id: 'timing', name: 'Timing', kinds: ['wait'] },
        {
          id: 'tools',
          name: 'Other Tools',
          kinds: ['notify_slack', 'notify_webhook'],
          note: 'Free',
        },
      ],
      actionHint: 'Try another word.',
      actions: {
        take_snapshot: action('Take Snapshot', {
          Panel: ({ action: step, onChange, personless, branch, invalidPath }) => (
            <label>
              Snapshot Name
              <input
                data-personless={String(personless)}
                data-branch={String(branch)}
                data-invalid={invalidPath ?? ''}
                value={(step as unknown as { name: string }).name}
                onChange={(e) => onChange({ ...step, name: e.target.value } as AutomationKind)}
              />
            </label>
          ),
        }),
        revert_snapshot: action('Revert to Snapshot', {
          fresh: () => ({ kind: 'revert_snapshot' }),
          note: 'Puts the Space back. Nothing follows it.',
          last: true,
        }),
        wait: action('Wait', {
          glyph: WaitGlyph,
          fresh: () => ({ kind: 'wait', hours: 24 }) as AutomationKind,
          top: true,
        }),
        notify_slack: message('slack', 'Post to Slack'),
        notify_webhook: message('webhook', 'Send to Webhook'),
      },
    },
    sentence: {
      rule: (rule) => [
        { word: 'When' },
        { chip: rule.trigger.kind, trigger: true },
        { word: 'then' },
        { chip: `${rule.steps.length} steps` },
      ],
      trigger: (trigger) => [{ word: 'When' }, { chip: trigger.kind, trigger: true }],
      condition: (condition) => `Condition ${condition.kind}`,
      step: (step) => `Step ${step.kind}`,
      text: (step) =>
        step.kind === 'take_snapshot' ? (step as { name?: string }).name || null : null,
      picksLabel: 'For tabs where',
      needs: (attention) => `${attention.length} gone`,
      gone: (text) => text,
      pick: (pick) => `Pick a ${pick}`,
      picksLeft: (_body, picks) => [...picks],
    },
    useOutline: () => OUTLINE,
    values: ({ body }) => [
      valueGroup('item', 'This Space', ['item.name', 'rule'] as const, {
        'item.name': 'Space Name',
        rule: 'Rule Name',
      }),
      ...(body?.trigger.kind === 'incoming_webhook' ? [WEBHOOK_VALUE_GROUP] : []),
    ],
    valuesLine: 'Put a value of the Space at the caret.',
    templates: {
      list: [
        { id: 'nightly', name: 'Nightly Snapshot', description: 'Every night.', category: 'care' },
      ],
      categories: [{ id: 'care', name: 'Care' }],
      build: (id) =>
        id === 'nightly'
          ? {
              body: { ...fakeRule(), name: 'Nightly Snapshot' },
              picks: [{ path: 'steps.0', pick: 'snapshot' }],
            }
          : null,
      scene: (id) => <span data-template-scene={id} />,
    },
    Test: TestRuleDialog,
    audit: {
      column: 'Tab',
      none: 'No tab',
      subjectOf: (run) => {
        const tab = (run as ListedRun & { tab?: string | null }).tab;
        return tab ? { id: tab, title: tab } : null;
      },
      useRef: () => () => '',
    },
    messages: {
      fresh: (via) => ({ kind: 'notify', via, webhook: '', text: 'Hello' }),
      hints: { webhook: 'Signed JSON.', slack: 'A Slack post.', teams: 'A Teams card.' },
    },
    incoming: {
      example: '{"status": "green"}',
      howTo: 'Send JSON.',
      runsOn: () => 'Once, on the Space.',
      signatureHeader: 'X-Liveworkspace-Signature',
    },
    connections: {
      client: {
        listWebhooks: vi.fn(async () => ({
          webhooks: [{ id: 'w1', name: 'Launch Channel', kind: 'slack', pausedAt: null }],
        })),
      } as unknown as IndexClient,
      app: 'livehuddle',
      useSignInHref: () => '/sign-in/',
    },
    describe: {
      examples: [{ label: 'Snapshot Nightly', text: 'Every night' }],
      placeholder: 'Say',
    },
    ...(views.length ? { views } : {}),
    ...over,
  });
  return { kit, plumbing, track };
}
