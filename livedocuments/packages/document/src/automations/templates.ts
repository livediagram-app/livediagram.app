// livedocuments' ready-made rules (docs/specs/013-workspace/automations.md "Templates"; blueprint automations.md
// "Editor"): the Templates gallery of the Automations screen, by category. Each builds a rule over the open
// document, leaving empty what is the person's to pick (a tab, a connection, a version), which the screen marks
// until it is picked. Pure: a template's id is its telemetry type (`UI·Opened·AutomationTemplate.<id>`), so each
// stays short.

import type { AutomationTemplatePickAt } from '@liveworkspace/automations';
import type { ItemPick, ItemRuleBody, ItemTemplate } from '@liveworkspace/automations/item';
import { NAME_VERSION_STEP, RESTORE_VERSION_STEP } from './actions';
import { AGENT_CHANGED_EVENT, VERSION_NAMED_EVENT } from './triggers';

/** The gallery's sections, in order. */
export const TEMPLATE_CATEGORIES = [
  { id: 'safe', name: 'Keep It Safe' },
  { id: 'loop', name: 'Stay in the Loop' },
  { id: 'versions', name: 'Versions and Reviews' },
  { id: 'agents', name: 'Agents and Tools' },
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
const SLACK_PICK: Picks = [{ path: 'steps.0', pick: 'connection' }];
// A tab to pick. Restore a Version's version is this app's own reference (VERSION_REF): the step's panel asks for it
// once the tab is picked, and the api refuses the rule until it is, so it is no pick of the gallery's.
const TAB_PICK: Picks = [{ path: 'steps.0', pick: 'tab' }];

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
    'version-friday',
    'safe',
    'Name a Version Every Friday',
    'Every Friday at 5 pm, name the version of a tab for the week, so Version History keeps it.',
    { kind: 'scheduled', every: 'week', days: [5], at: '17:00' },
    [{ kind: NAME_VERSION_STEP, tab: '', name: 'Week of {{now.date}}' }],
    TAB_PICK,
  ),
  template(
    'email-on-change',
    'loop',
    'Tell Me When This Changes',
    'When someone has been editing and then stops for half an hour, email the owner.',
    { kind: 'edited', minutes: 30 },
    [
      toOwner(
        '{{item.name}} changed',
        '{{person}} has been changing {{tab.name}}. Have a look: {{tab.url}}',
      ),
    ],
    [],
  ),
  template(
    'still-right',
    'loop',
    'Time for a Review',
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
    'comments-slack',
    'loop',
    'Comments to Slack',
    'When someone comments, post what they said to Slack.',
    { kind: 'comment_added' },
    [toSlack('{{person}}: {{comment}}')],
    SLACK_PICK,
  ),
  template(
    'signed-off',
    'versions',
    'Signed Off',
    'When the last open thread on a tab is resolved, name the version as reviewed and email the owner.',
    { kind: 'threads_resolved' },
    [
      { kind: NAME_VERSION_STEP, tab: 'run', name: 'Reviewed {{now.date}}' },
      toOwner(
        '{{tab.name}} is signed off',
        'Every thread on {{tab.name}} is resolved, and the version is named in Version History: {{tab.url}}',
      ),
    ],
    [],
  ),
  template(
    'weekly-summary',
    'loop',
    'Weekly Summary by Email',
    'Every Friday at 4 pm, summarise the document with AI and email the owner the summary.',
    { kind: 'scheduled', every: 'week', days: [5], at: '16:00' },
    [
      { kind: 'ai', task: 'summarise' },
      toOwner('This week in {{item.name}}', '{{summary}}\n\n{{item.url}}'),
    ],
    [],
  ),
  template(
    'announce-version',
    'versions',
    'Announce a New Version',
    'When someone names a version, post to Slack that it is ready.',
    { kind: VERSION_NAMED_EVENT },
    [toSlack('{{version.name}} of {{item.name}} is ready: {{tab.url}}')],
    SLACK_PICK,
  ),
  template(
    'agent-writes',
    'agents',
    'Tell Me When an Agent Writes',
    'When an agent changes pages or writes an article through the MCP server, the CLI or the API, email the owner.',
    { kind: AGENT_CHANGED_EVENT },
    [toOwner('{{person}} changed {{item.name}}', '{{person}} changed {{tab.name}}: {{tab.url}}')],
    [],
  ),
  template(
    'snapshot-monthly',
    'safe',
    'Snapshot Every Month',
    'On the first of every month at 9 am, take a snapshot of the whole document named for the day.',
    { kind: 'scheduled', every: 'month', dayOfMonth: 1, at: '09:00' },
    [{ kind: 'take_snapshot', name: '{{now.date}}' }],
    [],
  ),
  template(
    'reset-letter',
    'safe',
    'Reset a Form Letter Each Night',
    'Every night at midnight, put a tab back to one of its named versions: a form letter that starts clean each day.',
    { kind: 'scheduled', every: 'day', at: '00:00' },
    [{ kind: RESTORE_VERSION_STEP, tab: '', version: '' }],
    TAB_PICK,
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
];
