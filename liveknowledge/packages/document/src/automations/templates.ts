// liveknowledge's ready-made rules (docs/specs/013-workspace/automations.md "Templates"; blueprint automations.md
// "Editor"): the Templates gallery of the Automations screen, by category. Each builds a rule over the open
// knowledgebase, leaving empty what is the person's to pick (a connection), which the screen marks until it is
// picked. Pure: a template's id is its telemetry type (`UI·Opened·AutomationTemplate.<id>`), so each
// stays short.

import type { AutomationTemplatePickAt } from '@liveworkspace/automations';
import type { ItemPick, ItemRuleBody, ItemTemplate } from '@liveworkspace/automations/item';
import {
  CLEAR_VERIFICATION_STEP,
  EMAIL_OWNER_STEP,
  NAME_VERSION_STEP,
  SET_OWNER_STEP,
} from './actions';
import {
  AGENT_CHANGED_EVENT,
  PAGES_DISAGREE_EVENT,
  PAGE_VERIFIED_EVENT,
  QUESTION_UNANSWERED_EVENT,
  REVIEW_DUE_EVENT,
  SUGGESTION_ADDED_EVENT,
  VERSION_RESTORED_EVENT,
} from './triggers';

/** The gallery's sections, in order. */
export const TEMPLATE_CATEGORIES = [
  { id: 'trust', name: 'Keep Pages Trusted' },
  { id: 'ai', name: 'AI Knowledge' },
  { id: 'loop', name: 'Stay in the Loop' },
  { id: 'safe', name: 'Keep It Safe' },
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]['id'];

type Part = ItemRuleBody['trigger'];

// A rule of one trigger, these conditions and these steps, in the person's time zone.
const rule = (
  name: string,
  trigger: Part,
  conditions: Part[],
  steps: Part[],
  timeZone: string,
): ItemRuleBody => ({
  name,
  trigger,
  conditions,
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

// An email to the run's page's owner.
const toPageOwner = (subject: string, body: string): Part => ({
  kind: EMAIL_OWNER_STEP,
  subject,
  body,
});

type Template = ItemTemplate<string, TemplateCategory>;

const template = (
  id: string,
  category: TemplateCategory,
  name: string,
  description: string,
  trigger: Part,
  steps: Part[],
  picks: Picks,
  conditions: Part[] = [],
): Template => ({
  id,
  name,
  description,
  category,
  // A fresh body each opening: the builder edits what it is handed.
  build: ({ timeZone }) => ({
    body: rule(
      name,
      structuredClone(trigger),
      structuredClone(conditions),
      structuredClone(steps),
      timeZone,
    ),
    picks: picks.map((p) => ({ ...p })),
  }),
});

/** Every template, in the gallery's order within each category. */
export const DOCUMENT_TEMPLATES: readonly Template[] = [
  template(
    'review-slack',
    'trust',
    'Review Due to Slack',
    'When a verified page comes due for review, post it to Slack with its owner, so it does not go stale unseen.',
    { kind: REVIEW_DUE_EVENT },
    [toSlack('{{tab.name}} is due for review ({{page.owner}} owns it): {{tab.url}}')],
    SLACK_PICK,
  ),
  // A step in another app: the plan and its board are the person's to pick.
  template(
    'review-card',
    'trust',
    'Review Due, Add a Card for the Owner',
    'When a verified page comes due for review, add a card to a plan for its owner, due in a week and linked back.',
    { kind: REVIEW_DUE_EVENT },
    [
      {
        kind: 'plan_card',
        target: { app: 'liveplanner', item: '', title: '' },
        board: '',
        column: '',
        title: 'Review {{tab.name}}',
        description: '{{tab.name}} in {{item.name}} is due for review: {{tab.url}}',
        assignee: '{{page.owner}}',
        dueDays: 7,
        linkBack: true,
        skipIfOpen: true,
      },
    ],
    [{ path: 'steps.0', pick: 'target' }],
  ),
  template(
    'agent-check',
    'trust',
    'Ask the Owner to Check an Agent’s Edit',
    'When an agent writes a page, email the page’s owner to read it and verify it again.',
    { kind: AGENT_CHANGED_EVENT },
    [
      toPageOwner(
        '{{person}} changed {{tab.name}}',
        '{{person}} changed {{tab.name}} in {{item.name}}. Read it and verify it if it is still right: {{tab.url}}',
      ),
    ],
    [],
  ),
  template(
    'agent-owner',
    'trust',
    'Agents’ New Pages Get an Owner',
    'When an agent adds a page, make the person whose agent it is the page’s owner, so someone answers for it.',
    { kind: 'tab_added' },
    [{ kind: SET_OWNER_STEP, tab: 'run', to: { trigger: true } }],
    [],
    // An agent's pages alone: a page a person adds is theirs already.
    [{ kind: 'who', who: [{ role: 'agent' }] }],
  ),
  template(
    'restored-unverify',
    'trust',
    'A Restored Page Needs Verifying Again',
    'When someone restores a page to an earlier version, clear its verification: what was verified is no longer what it says.',
    { kind: VERSION_RESTORED_EVENT },
    [{ kind: CLEAR_VERIFICATION_STEP, tab: 'run' }],
    [],
  ),
  template(
    'verified-version',
    'trust',
    'Name a Version When Verified',
    'When someone verifies a page, name the version, so Version History shows what was verified and when.',
    { kind: PAGE_VERIFIED_EVENT },
    [{ kind: NAME_VERSION_STEP, tab: 'run', name: 'Verified {{now.date}}' }],
    [],
  ),
  template(
    'questions-slack',
    'ai',
    'Unanswered Questions to Slack',
    'When someone or an agent asks what no page answers, post the question to Slack, so someone writes the page.',
    { kind: QUESTION_UNANSWERED_EVENT },
    [
      toSlack(
        'Nobody’s pages answer “{{question}}”. Draft a page for it in AI Knowledge: {{item.url}}',
      ),
    ],
    SLACK_PICK,
  ),
  template(
    'disagree-slack',
    'ai',
    'Pages That Disagree to Slack',
    'When two pages are found stating opposite facts, post both to Slack, so their owners settle it.',
    { kind: PAGES_DISAGREE_EVENT },
    [toSlack('{{tab.name}} and {{other.name}} disagree: {{question}} {{tab.url}}')],
    SLACK_PICK,
  ),
  template(
    'suggestion-owner',
    'ai',
    'Tell the Owner About a Suggested Edit',
    'When an agent suggests an edit to a page, email the page’s owner to accept or dismiss it.',
    { kind: SUGGESTION_ADDED_EVENT },
    [
      toPageOwner(
        '{{person}} suggested an edit to {{tab.name}}',
        '{{person}} suggested an edit to {{tab.name}}: {{suggestion.reason}}\n\nAccept or dismiss it in AI Knowledge: {{item.url}}',
      ),
    ],
    [],
  ),
  template(
    'verified-slack',
    'loop',
    'Announce Verified Pages',
    'When someone verifies a page, post it to Slack, so the team knows it can be trusted.',
    { kind: PAGE_VERIFIED_EVENT },
    [toSlack('{{person}} verified {{tab.name}}: {{tab.url}}')],
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
    'access-slack',
    'loop',
    'Access Requests to Slack',
    'When someone asks for access, post to Slack so an Editor can let them in.',
    { kind: 'access_requested' },
    [toSlack('{{person}} asked for access to {{item.name}}: {{item.url}}')],
    SLACK_PICK,
  ),
  template(
    'weekly-summary',
    'loop',
    'Weekly Summary by Email',
    'Every Friday at 4 pm, summarise the knowledgebase with AI and email the owner the summary.',
    { kind: 'scheduled', every: 'week', days: [5], at: '16:00' },
    [
      { kind: 'ai', task: 'summarise' },
      toOwner('This week in {{item.name}}', '{{summary}}\n\n{{item.url}}'),
    ],
    [],
  ),
  template(
    'snapshot-monthly',
    'safe',
    'Snapshot Every Month',
    'On the first of every month at 9 am, take a snapshot of the whole knowledgebase named for the day.',
    { kind: 'scheduled', every: 'month', dayOfMonth: 1, at: '09:00' },
    [{ kind: 'take_snapshot', name: '{{now.date}}' }],
    [],
  ),
];
