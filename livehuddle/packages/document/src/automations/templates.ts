// livehuddle's ready-made rules (docs/specs/013-workspace/automations.md "Templates"; blueprint automations.md
// "Editor"): the Templates gallery of the Automations screen, by category. Each builds a rule over the open Space,
// leaving empty what is the person's to pick (a snapshot, a connection), which the screen marks until it is picked.
// Pure: a template's id is its telemetry type (`UI·Opened·AutomationTemplate.<id>`), so each stays short.

import type { AutomationTemplatePickAt } from '@liveworkspace/automations';
import type { ItemPick, ItemRuleBody, ItemTemplate } from '@liveworkspace/automations/item';
import { CLEAR_SUGGESTIONS_STEP } from './actions';
import { EVERYONE_LEFT_TRIGGER, SOMEONE_ARRIVED_EVENT, SUGGESTION_DROPPED_EVENT } from './triggers';

/** The gallery's sections, in order. */
export const TEMPLATE_CATEGORIES = [
  { id: 'safe', name: 'Keep It Safe' },
  { id: 'rooms', name: 'Rooms and Meetings' },
  { id: 'suggestions', name: 'The Suggestion Box' },
  { id: 'loop', name: 'Stay in the Loop' },
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

// The whole Space back to a snapshot the person picks.
const REVERT: Part = { kind: 'revert_snapshot', snapshot: '' };

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

/** Every template, in the gallery's order within each category. Reset Every Night leads: a workshop Space put back
 *  every night is the rule livehuddle is asked for most. */
export const SPACE_TEMPLATES: readonly Template[] = [
  template(
    'reset-nightly',
    'safe',
    'Reset Every Night',
    'Every night at midnight, put the whole Space back to a snapshot: a workshop Space that starts clean each day.',
    { kind: 'scheduled', every: 'day', at: '00:00' },
    [REVERT],
    SNAPSHOT_PICK,
  ),
  template(
    'tidy-up',
    'safe',
    'Tidy Up When Everyone Leaves',
    'Ten minutes after the last person leaves a room, put the Space back to a snapshot, chairs, whiteboard and all.',
    { kind: EVERYONE_LEFT_TRIGGER, minutes: 10 },
    [REVERT],
    SNAPSHOT_PICK,
  ),
  template(
    'office-open',
    'rooms',
    'The Office Is Open',
    'When the first person comes into an empty room, post to Slack that they are in.',
    { kind: SOMEONE_ARRIVED_EVENT, empty: true },
    [toSlack('{{person}} is in {{item.name}}')],
    SLACK_PICK,
  ),
  template(
    'standup-soon',
    'rooms',
    'Stand-Up in Fifteen',
    'Every weekday at 9:45 am, post to Slack that stand-up starts in 15 minutes, with the Space’s link.',
    { kind: 'scheduled', every: 'weekday', at: '09:45' },
    [toSlack('Stand-up in 15 minutes: {{item.url}}')],
    SLACK_PICK,
  ),
  template(
    'meeting-wrap',
    'rooms',
    'Meeting Wrap-Up',
    'Five minutes after everyone leaves a room, email the owner who came and how long they stayed.',
    { kind: EVERYONE_LEFT_TRIGGER, minutes: 5 },
    [
      toOwner(
        'Meeting in {{tab.name}}',
        '{{visit.count}} people met in {{tab.name}} for {{visit.minutes}} minutes: {{visit.people}}.\n\n{{tab.url}}',
      ),
    ],
    [],
  ),
  template(
    'suggestions-slack',
    'suggestions',
    'Suggestions to Slack',
    'When someone drops a note in the Suggestion Box, post what it says to Slack, with nobody’s name on it.',
    { kind: SUGGESTION_DROPPED_EVENT },
    [toSlack('A new suggestion in {{item.name}}: {{suggestion}}')],
    SLACK_PICK,
  ),
  template(
    'empty-box',
    'suggestions',
    'Empty the Suggestion Box Weekly',
    'Every Monday at 8 am, clear every note from the Suggestion Box, so the week starts with an empty box.',
    { kind: 'scheduled', every: 'week', days: [1], at: '08:00' },
    [{ kind: CLEAR_SUGGESTIONS_STEP }],
    [],
  ),
  template(
    'visitor-joined',
    'loop',
    'A Visitor Arrived',
    'When someone opens the Space through a share link for the first time, email the owner who it was.',
    { kind: 'joined' },
    [
      toOwner(
        '{{person}} joined {{item.name}}',
        '{{person}} opened {{item.name}} through a share link for the first time: {{item.url}}',
      ),
    ],
    [],
  ),
  template(
    'snapshot-friday',
    'safe',
    'Snapshot Every Friday',
    'Every Friday at 5 pm, take a snapshot of the whole Space named for the week.',
    { kind: 'scheduled', every: 'week', days: [5], at: '17:00' },
    [{ kind: 'take_snapshot', name: 'Week of {{now.date}}' }],
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
];
