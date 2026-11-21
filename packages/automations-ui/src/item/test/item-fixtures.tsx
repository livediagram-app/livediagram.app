// Tests only: a small registry (the kinds every app has, with comments and tab templates, plus one trigger and one
// action of the app's own), an item of two tabs and two people, and a client that answers from memory, checking
// every body it is handed as the api would (`readItemRule`).

import { vi, type Mock } from 'vitest';
import {
  defineAction,
  defineItemKinds,
  defineTrigger,
  readItemRule,
  type ItemKinds,
  type ItemPart,
  type ItemRuleBody,
  type ItemRun,
  type ItemTemplate,
} from '@liveworkspace/automations/item';
import type { IndexClient } from '@liveworkspace/index-client';
import { BoltIcon } from '../../glyphs';
import type { AnyAutomationsKit, AutomationsPlumbing } from '../../kit';
import type { ItemListedRule } from '../client';
import { defineItemAutomationsKit } from '../define-kit';
import { defineItemPlumbing, type ItemAutomationsClient } from '../plumbing';
import type { ItemAutomationsKitInput, ItemSnapshot, ItemView } from '../types';

export const SCOPE = { ownerId: 'o1', itemId: 'd1', shareCode: null };

const pollEnded = defineTrigger({
  kind: 'poll_ended',
  name: 'Poll Ended',
  group: 'Polls',
  line: 'a facilitator ends a live poll',
  format: '{"kind":"poll_ended"}',
  hears: ['poll_ended'],
  read: () => ({ kind: 'poll_ended' }),
  defaults: () => ({ kind: 'poll_ended' }),
  matches: () => true,
  words: () => [{ chip: 'Poll Ended', trigger: true }],
  said: () => 'A poll ended',
});

const clearBox = defineAction({
  kind: 'clear_box',
  name: 'Clear the Suggestion Box',
  group: 'Suggestions',
  line: 'empties the suggestion box',
  format: '{"kind":"clear_box"}',
  read: () => ({ kind: 'clear_box' }),
  defaults: () => ({ kind: 'clear_box' }),
  words: () => [{ chip: 'Clear the Suggestion Box' }],
  would: () => 'Would clear the suggestion box',
});

export const KINDS: ItemKinds = defineItemKinds({
  itemWord: 'document',
  collab: true,
  tabTemplates: true,
  triggers: [pollEnded],
  actions: [clearBox],
  values: [
    {
      name: 'poll.question',
      label: 'Poll Question',
      under: ['poll_ended'],
      fill: () => 'Which name?',
    },
  ],
});

export const openTab: Mock = vi.fn();

export const ITEM: ItemView = {
  id: 'd1',
  name: 'Launch Plan',
  tabs: [
    { id: 't1', name: 'Roadmap' },
    { id: 't2', name: 'Notes' },
  ],
  currentTabId: 't2',
  people: [
    { id: 'p1', name: 'Ana Costa' },
    { id: 'p2', name: 'Kai Park' },
  ],
  shareCode: null,
  signedIn: true,
  openTab,
};

export const SNAPSHOTS: readonly ItemSnapshot[] = [
  { id: 's1', name: 'Clean board', createdAt: Date.UTC(2026, 10, 18, 9), kept: true },
  { id: 's2', name: null, createdAt: Date.UTC(2026, 10, 19, 17, 30) },
];

export const TEMPLATES: readonly ItemTemplate[] = [
  {
    id: 'reset-nightly',
    name: 'Reset Every Night',
    description: 'Every day at midnight, put this back to a snapshot.',
    category: 'care',
    build: ({ timeZone }) => ({
      body: {
        name: 'Reset Every Night',
        trigger: { kind: 'scheduled', every: 'day', at: '00:00' },
        conditions: [],
        steps: [{ kind: 'revert_snapshot', snapshot: '' }],
        chain: false,
        timeZone,
      },
      picks: [{ path: 'steps.0', pick: 'snapshot' }],
    }),
  },
  {
    id: 'poll-to-box',
    name: 'Clear After a Poll',
    description: 'When a poll ends, clear the box.',
    category: 'polls',
    build: ({ timeZone }) => ({
      body: {
        name: 'Clear After a Poll',
        trigger: { kind: 'poll_ended' },
        conditions: [],
        steps: [
          {
            kind: 'if',
            conditions: [{ kind: 'weekday', days: [1] }],
            then: [{ kind: 'clear_box' }],
            else: [],
          },
        ],
        chain: false,
        timeZone,
      },
      picks: [],
    }),
  },
];

const ANA = { id: 'p1', name: 'Ana Costa', color: '#0ea5e9' };

export function itemRule(over: Partial<ItemListedRule> = {}): ItemListedRule {
  return {
    id: 'r1',
    name: 'Nightly Snapshot',
    enabled: true,
    trigger: { kind: 'edited', minutes: 30, tab: 't1' },
    conditions: [],
    steps: [{ kind: 'take_snapshot', name: 'Nightly' }],
    chain: false,
    timeZone: 'UTC',
    made: { by: ANA, at: 0 },
    edited: { by: ANA, at: 0 },
    stats: { lastRunAt: null, runsThisWeek: 0, failuresInARow: 0 },
    needs: [],
    attention: [],
    ...over,
  };
}

export function itemRun(over: Partial<ItemRun> = {}): ItemRun {
  return {
    id: 'run1',
    ruleId: 'r1',
    ruleName: 'Nightly Snapshot',
    at: Date.UTC(2026, 10, 20, 9),
    result: 'done',
    tookMs: 12,
    steps: [
      { kind: 'trigger', text: 'Edited, then quiet for 30 minutes' },
      { kind: 'action', ok: true, text: 'Would take a snapshot named “Nightly”' },
    ],
    subject: { id: 't1', title: 'Roadmap' },
    ...over,
  };
}

export type ItemFakeClient = ItemAutomationsClient & Record<keyof ItemAutomationsClient, Mock>;

/** The bodies the client was handed that the api would refuse, with why: a test asserts it stays empty. */
export const refusedBodies: { body: unknown; why: unknown }[] = [];

function checked(body: ItemRuleBody): ItemRuleBody {
  const read = readItemRule(body, KINDS);
  if (!('body' in read)) refusedBodies.push({ body, why: read });
  return body;
}

export function itemClient(rules: ItemListedRule[] = [itemRule()]): ItemFakeClient {
  const held = [...rules];
  const client: ItemFakeClient = {
    list: vi.fn(async () => ({ rules: [...held], runsToday: 3, runsPerDay: 1000 })),
    create: vi.fn(async (_scope: unknown, body: ItemRuleBody) => {
      const rule = itemRule({ ...checked(body), id: `r${held.length + 1}`, enabled: false });
      held.push(rule);
      return { rule };
    }),
    update: vi.fn(async (_scope: unknown, id: string, body: ItemRuleBody) => ({
      rule: itemRule({ ...checked(body), id }),
    })),
    toggle: vi.fn(async (_scope: unknown, id: string, enabled: boolean) => ({
      rule: itemRule({ id, enabled }),
    })),
    duplicate: vi.fn(async (_scope: unknown, id: string) => ({
      rule: itemRule({ id: `${id}-copy`, name: 'Nightly Snapshot 2' }),
    })),
    remove: vi.fn(async () => {}),
    test: vi.fn(async (_scope: unknown, body: ItemRuleBody) => {
      checked(body);
      return { run: itemRun() };
    }),
    draft: vi.fn(async () => ({ rule: itemRule() as ItemRuleBody, picks: [] })),
    run: vi.fn(async () => ({ run: itemRun() })),
    runs: vi.fn(async () => ({ runs: [itemRun(), itemRun({ id: 'run2', subject: null })] })),
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

export const WEBHOOKS = [
  { id: 'w1', name: 'Launch Channel', kind: 'slack', pausedAt: null },
  { id: 'w2', name: 'Launch Team', kind: 'teams', pausedAt: null },
  { id: 'w3', name: 'Our Service', kind: 'json', pausedAt: null },
];

export type ItemFakes = {
  kit: AnyAutomationsKit;
  plumbing: AutomationsPlumbing;
  track: Mock;
  snapshots: Mock;
  listWebhooks: Mock;
  input: ItemAutomationsKitInput;
};

/** A kit over the small registry. `item`: what `useItem()` answers (the same object each time). */
export function itemKit(
  client: ItemAutomationsClient,
  over: Partial<ItemAutomationsKitInput> = {},
  item: ItemView = ITEM,
): ItemFakes {
  const track = vi.fn();
  const snapshots = vi.fn(async () => SNAPSHOTS);
  const listWebhooks = vi.fn(async () => ({ webhooks: WEBHOOKS }));
  const plumbing = defineItemPlumbing({
    itemWord: KINDS.itemWord,
    examples: 'Snapshot it every Friday, or tell Slack when it changes.',
    client,
    track,
  });
  const input: ItemAutomationsKitInput = {
    kinds: KINDS,
    app: 'livediagram',
    plumbing,
    useItem: () => item,
    snapshots,
    tabTemplates: [
      { id: 'retro', name: 'Retrospective', picture: <span data-tab-picture="retro" /> },
      { id: 'kanban', name: 'Kanban' },
    ],
    own: {
      triggers: { poll_ended: { scene: () => <span data-own-scene="poll_ended" /> } },
      actions: {
        clear_box: { scene: () => <span data-own-scene="clear_box" />, glyph: BoltIcon },
      },
      tones: { Polls: 'orange' },
    },
    templates: {
      list: TEMPLATES,
      categories: [
        { id: 'care', name: 'Care' },
        { id: 'polls', name: 'Polls' },
      ],
    },
    describe: {
      examples: [{ label: 'Snapshot Nightly', text: 'Every night' }],
      placeholder: 'Say',
    },
    helpButton: <a href="/help">How Rules Work</a>,
    indexClient: { listWebhooks } as unknown as IndexClient,
    useSignInHref: () => '/sign-in/',
    signatureHeader: 'X-Liveworkspace-Signature',
    ...over,
  };
  return { kit: defineItemAutomationsKit(input), plumbing, track, snapshots, listWebhooks, input };
}

/** A part as a panel is handed it. */
export const part = <T extends ItemPart>(value: T): T => value;
