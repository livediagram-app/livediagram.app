// livediagram's ready-made rules (docs/specs/013-workspace/automations.md "Templates"; blueprint automations.md
// "Editor"): the Templates gallery of the Automations screen, by category. Each builds a rule over the open document,
// leaving empty what is the person's to pick (a snapshot, a connection), which the screen marks until it is picked.
// Pure: a template's id is its telemetry type (`UI·Opened·AutomationTemplate.<id>`), so each stays short.

import type { AutomationTemplatePickAt } from '@liveworkspace/automations';
import type { ItemPick, ItemRuleBody, ItemTemplate } from '@liveworkspace/automations/item';
import { AGENT_CHANGED_EVENT, POLL_ENDED_EVENT, QUESTION_ASKED_EVENT } from './triggers';

/** The gallery's sections, in order. */
export const TEMPLATE_CATEGORIES = [
  { id: 'safe', name: 'Keep It Safe' },
  { id: 'loop', name: 'Stay in the Loop' },
  { id: 'workshops', name: 'Workshops' },
  { id: 'agents', name: 'Agents and Tools' },
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]['id'];

// The template a fresh retro is made from: the library's Retrospective (@livediagram/templates `retrospective`).
export const RETRO_TEMPLATE_ID = 'retrospective';

type Part = ItemRuleBody['trigger'];

// A rule of one trigger and these steps, with no conditions, in the person's time zone.
const rule = (name: string, trigger: Part, steps: Part[], timeZone: string): ItemRuleBody => ({
  name,
  trigger,
  conditions: [],
  steps,
  chain: false,
  timeZone,
});

const toOwner = (subject: string, body: string): Part => ({
  kind: 'email',
  to: { owner: true },
  subject,
  body,
});

// A Slack message through a connection the person picks.
const toSlack = (text: string): Part => ({ kind: 'notify', via: 'slack', webhook: '', text });

type Picks = AutomationTemplatePickAt<ItemPick>[];
const SNAPSHOT_PICK: Picks = [{ path: 'steps.0', pick: 'snapshot' }];
const SLACK_PICK: Picks = [{ path: 'steps.0', pick: 'connection' }];

type Template = ItemTemplate<string, TemplateCategory>;

const template = (
  id: string,
  category: TemplateCategory,
  name: string,
  description: string,
  trigger: Part,
  steps: Part[],
  picks: Picks,
): Template => ({
  id,
  name,
  description,
  category,
  // A fresh body each opening: the builder edits what it is handed.
  build: ({ timeZone }) => ({
    body: rule(name, structuredClone(trigger), structuredClone(steps), timeZone),
    picks: picks.map((p) => ({ ...p })),
  }),
});

/** Every template, in the gallery's order within each category. */
export const DOCUMENT_TEMPLATES: readonly Template[] = [
  template(
    'reset-nightly',
    'safe',
    'Reset Every Night',
    'Every night at midnight, put this canvas back to a snapshot: a workshop board that starts clean.',
    { kind: 'scheduled', every: 'day', at: '00:00' },
    [{ kind: 'revert_snapshot', snapshot: '' }],
    SNAPSHOT_PICK,
  ),
  template(
    'snapshot-friday',
    'safe',
    'Snapshot Every Friday',
    'Every Friday at 5 pm, take a snapshot named for the week.',
    { kind: 'scheduled', every: 'week', days: [5], at: '17:00' },
    [{ kind: 'take_snapshot', name: 'Week of {{now.date}}' }],
    [],
  ),
  template(
    'slack-on-change',
    'loop',
    'Tell Slack When This Changes',
    'When someone has been editing and then stops for half an hour, post to Slack.',
    { kind: 'edited', minutes: 30 },
    [toSlack('{{item.name}} changed: {{item.url}}')],
    SLACK_PICK,
  ),
  template(
    'comments-slack',
    'loop',
    'Comments to Slack',
    'When someone comments, post what they said to Slack.',
    { kind: 'comment_added' },
    [toSlack('{{person}}: {{comment}}')],
    SLACK_PICK,
  ),
  template(
    'review-finished',
    'loop',
    'Review Finished',
    'When the last open thread on a tab is resolved, email the owner.',
    { kind: 'threads_resolved' },
    [
      toOwner(
        'Review finished on {{item.name}}',
        'Every thread on {{tab.name}} is resolved: {{tab.url}}',
      ),
    ],
    [],
  ),
  template(
    'still-right',
    'loop',
    'Is This Still Right?',
    'When nothing has changed for 90 days, ask the owner to check it is still right.',
    { kind: 'not_edited', days: 90, at: '09:00' },
    [
      toOwner(
        'Is {{item.name}} still right?',
        'Nobody has changed {{item.name}} for 90 days. Have a look: {{item.url}}',
      ),
    ],
    [],
  ),
  template(
    'weekly-summary',
    'loop',
    'Weekly Summary by Email',
    'Every Friday at 4 pm, summarise the canvas with AI and email the owner the summary.',
    { kind: 'scheduled', every: 'week', days: [5], at: '16:00' },
    [
      { kind: 'ai', task: 'summarise' },
      toOwner('This week in {{item.name}}', '{{summary}}\n\n{{item.url}}'),
    ],
    [],
  ),
  template(
    'access-slack',
    'loop',
    'Access Requests to Slack',
    'When someone asks for access, post to Slack so an owner can let them in.',
    { kind: 'access_requested' },
    [toSlack('{{person}} asked for access to {{item.name}}: {{item.url}}')],
    SLACK_PICK,
  ),
  template(
    'fresh-retro',
    'workshops',
    'A Fresh Retro Each Sprint',
    'Every Monday at 9 am, add a new Retrospective tab named for the day.',
    { kind: 'scheduled', every: 'week', days: [1], at: '09:00' },
    [{ kind: 'add_tab', template: RETRO_TEMPLATE_ID, name: 'Retro {{now.date}}' }],
    [],
  ),
  template(
    'poll-results-slack',
    'workshops',
    'Poll Results to Slack',
    'When a facilitator ends a live poll, post its question and results to Slack.',
    { kind: POLL_ENDED_EVENT },
    [toSlack('{{poll.question}}\n{{poll.results}}')],
    SLACK_PICK,
  ),
  template(
    'questions-slack',
    'workshops',
    'Questions to Slack',
    'When someone adds a note to a Q&A board, post the question to Slack.',
    { kind: QUESTION_ASKED_EVENT },
    [toSlack('New question on {{tab.name}}: {{question}}')],
    SLACK_PICK,
  ),
  template(
    'agent-edits',
    'agents',
    'Tell Me When an Agent Edits',
    'When an agent changes the canvas through the MCP server, the CLI or the API, email the owner.',
    { kind: AGENT_CHANGED_EVENT },
    [toOwner('{{person}} changed {{item.name}}', '{{person}} changed {{tab.name}}: {{tab.url}}')],
    [],
  ),
  template(
    'snapshot-release',
    'agents',
    'Snapshot Before a Release',
    'When your release tool calls the rule’s address, take a snapshot named for the version.',
    { kind: 'incoming_webhook' },
    [{ kind: 'take_snapshot', name: 'Before {{webhook.version}}' }],
    [],
  ),
];
