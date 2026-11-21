// livedesign's ready-made rules (docs/specs/013-workspace/automations.md "Templates"; blueprint automations.md
// "Editor"): the Templates gallery of the Automations screen, by category. Each builds a rule over the open design,
// leaving empty what is the person's to pick (a connection), which the screen marks until it is picked. Pure: a
// template's id is its telemetry type (`UI·Opened·AutomationTemplate.<id>`), so each stays short.

import type { AutomationTemplatePickAt } from '@liveworkspace/automations';
import type { ItemPick, ItemRuleBody, ItemTemplate } from '@liveworkspace/automations/item';
import { AGENT_CHANGED_EVENT } from '@liveworkspace/automations/item';
import { COMPONENT_CHANGED_EVENT } from './triggers';

/** The gallery's sections, in order. */
export const TEMPLATE_CATEGORIES = [
  { id: 'feedback', name: 'Feedback and Handoff' },
  { id: 'loop', name: 'Stay in the Loop' },
  { id: 'safe', name: 'Keep It Safe' },
  { id: 'library', name: 'Library and Agents' },
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]['id'];

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
const slackPick = (step: number): Picks => [{ path: `steps.${step}`, pick: 'connection' }];

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

/** Every template, in the spec's order; the gallery groups them by category. */
export const DESIGN_TEMPLATES: readonly Template[] = [
  template(
    'feedback-slack',
    'feedback',
    'Feedback to Slack',
    'When someone comments, post what they said and on which tab to Slack.',
    { kind: 'comment_added' },
    [toSlack('{{person}} on {{tab.name}}: {{comment}}')],
    slackPick(0),
  ),
  template(
    'feedback-done',
    'feedback',
    'Feedback Addressed',
    'When the last open thread on a tab is resolved, email the owner that the feedback is addressed.',
    { kind: 'threads_resolved' },
    [
      toOwner(
        'Feedback on {{tab.name}} is addressed',
        'Every thread on {{tab.name}} is resolved. Have a look: {{tab.url}}',
      ),
    ],
    [],
  ),
  template(
    'ready-for-build',
    'feedback',
    'Ready for Build',
    'Run it by hand when a design is ready: take a snapshot for the handoff and post the link to Slack.',
    { kind: 'manual' },
    [
      { kind: 'take_snapshot', name: 'Handoff {{now.date}}' },
      toSlack('{{item.name}} is ready for build: {{item.url}}'),
    ],
    slackPick(1),
  ),
  template(
    'slack-on-change',
    'loop',
    'Tell Slack When This Changes',
    'When someone has been editing and then stops for half an hour, post to Slack.',
    { kind: 'edited', minutes: 30 },
    [toSlack('{{person}} changed {{tab.name}} in {{item.name}}: {{tab.url}}')],
    slackPick(0),
  ),
  template(
    'library-updated',
    'library',
    'Library Updated',
    'When a main component changes and the library has been quiet for 2 minutes, post to Slack.',
    { kind: COMPONENT_CHANGED_EVENT },
    [toSlack('{{component.name}} changed in {{item.name}}: {{item.url}}')],
    slackPick(0),
  ),
  template(
    'snapshot-friday',
    'safe',
    'Snapshot Every Friday',
    'Every Friday at 5 pm, take a snapshot of the whole design named for the week.',
    { kind: 'scheduled', every: 'week', days: [5], at: '17:00' },
    [{ kind: 'take_snapshot', name: 'Week of {{now.date}}' }],
    [],
  ),
  template(
    'weekly-summary',
    'loop',
    'Weekly Summary by Email',
    'Every Friday at 4 pm, summarise the design with AI and email the owner the summary.',
    { kind: 'scheduled', every: 'week', days: [5], at: '16:00' },
    [
      { kind: 'ai', task: 'summarise' },
      toOwner('This week in {{item.name}}', '{{summary}}\n\n{{item.url}}'),
    ],
    [],
  ),
  template(
    'agent-edits',
    'library',
    'Tell Me When an Agent Edits',
    'When an agent changes the canvas, its pages or a component through the MCP server, the CLI or the API, email the owner.',
    { kind: AGENT_CHANGED_EVENT },
    [
      toOwner(
        '{{person}} changed {{item.name}}',
        '{{person}} made changes to {{item.name}}. Have a look: {{item.url}}',
      ),
    ],
    [],
  ),
  template(
    'still-current',
    'safe',
    'Is This Still Current?',
    'When nothing has changed for 90 days, ask the owner to check the design is still current.',
    { kind: 'not_edited', days: 90, at: '09:00' },
    [
      toOwner(
        'Is {{item.name}} still current?',
        'Nobody has changed {{item.name}} for 90 days. Have a look: {{item.url}}',
      ),
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
    slackPick(0),
  ),
];
