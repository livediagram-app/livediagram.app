// Automations: the Templates gallery's ready-made rules (docs/specs/026-plan/automations.md "The Automations screen":
// Templates; blueprint automations.md "Phase 2"). Each template builds an AutomationRuleBody over the plan it opens
// in, filling by role what the plan has (its done columns, an In Progress column, a date field named like Completed
// On, a Bug type) and leaving empty what it lacks or leaves to the person (a label, the people in turn, a webhook).
// Each empty slot is a pick, named by the path the builder and the api use (`trigger`, `conditions.0`, `steps.1`,
// `steps.0.then.0`); `picksLeft` answers those still empty, so the builder marks them until they are filled. Pure.

import type { ItemTypeDef } from '../item-types';
import type { StatusPhase } from '../plan-views';
import type {
  AutomationAction,
  AutomationCondition,
  AutomationOutgoing,
  AutomationRuleBody,
  AutomationStep,
  AutomationTrigger,
} from './types';

// What a template reads of the plan: its columns in order with the phase the boards give each, and its card types.
export interface AutomationTemplatePlan {
  statuses: readonly { status: string; name: string }[];
  phases: ReadonlyMap<string, StatusPhase>;
  types: readonly ItemTypeDef[];
  // The IANA time zone the rule will be saved in.
  timeZone: string;
}

export const AUTOMATION_TEMPLATE_CATEGORIES = [
  'status',
  'assigning',
  'due_dates',
  'forms',
  'telling_people',
  'ai',
] as const;
export type AutomationTemplateCategory = (typeof AUTOMATION_TEMPLATE_CATEGORIES)[number];
export const AUTOMATION_TEMPLATE_CATEGORY_NAMES: Readonly<
  Record<AutomationTemplateCategory, string>
> = {
  status: 'Status',
  assigning: 'Assigning',
  due_dates: 'Due Dates',
  forms: 'Forms',
  telling_people: 'Telling People',
  ai: 'AI',
};

// What a person picks before the rule can be saved, and how its step says so.
export type AutomationPick = 'column' | 'type' | 'field' | 'label' | 'people' | 'webhook';
export const AUTOMATION_PICK_WORDS: Readonly<Record<AutomationPick, string>> = {
  column: 'Pick a column',
  type: 'Pick a card type',
  field: 'Pick a field',
  label: 'Pick a label',
  people: 'Pick people',
  webhook: 'Pick a webhook',
};

export interface AutomationTemplatePickAt {
  path: string;
  pick: AutomationPick;
}

export interface AutomationTemplateFill {
  body: AutomationRuleBody;
  picks: AutomationTemplatePickAt[];
}

// The fixed list (telemetry carries the id: `UI · Opened · AutomationTemplate`).
export const AUTOMATION_TEMPLATE_IDS = [
  'stamp-finish',
  'assign-on-start',
  'overdue-nudge',
  'form-responses',
  'shipped-to-slack',
  'triage-bugs',
  'unblock-next',
  'due-soon',
  'clean-up-done',
  'escalate-urgent',
  'reopen-on-comment',
  'route-reviews',
  'due-on-start',
  'flag-blocked',
  'verify-fix',
  'back-to-backlog',
  'close-parent',
  'tell-unblocked',
  'nudge-stuck',
  'done-when-resolved',
  'sort-incoming',
  'summarise-requests',
] as const;
export type AutomationTemplateId = (typeof AUTOMATION_TEMPLATE_IDS)[number];

export interface AutomationTemplate {
  id: AutomationTemplateId;
  name: string;
  // The tile's sentence (the spec's table).
  description: string;
  category: AutomationTemplateCategory;
  build: (plan: AutomationTemplatePlan) => AutomationTemplateFill;
}

// ---- Filling by role --------------------------------------------------------------------------------------------

const doneStatuses = (plan: AutomationTemplatePlan) =>
  plan.statuses.filter((s) => plan.phases.get(s.status) === 'done').map((s) => s.status);

// The plan's In Progress column: one called so, else the first a board puts in progress.
function inProgressStatus(plan: AutomationTemplatePlan): string | undefined {
  const doing = plan.statuses.filter((s) => plan.phases.get(s.status) === 'doing');
  return (doing.find((s) => /in progress/i.test(s.name)) ?? doing[0])?.status;
}

// A date field named like Completed On (Completed, Finished, Done On, Shipped), of any of the plan's types.
const FINISH_NAME = /complet|finish|done|shipped/i;
function finishDateField(plan: AutomationTemplatePlan): string | undefined {
  for (const t of plan.types)
    for (const f of t.custom ?? [])
      if (f.kind === 'date' && t.fields.includes(f.id) && FINISH_NAME.test(f.label)) return f.id;
  return undefined;
}

// The plan's Review column: one named like Review (Review, In Review, Code Review), wherever the boards put it.
const reviewStatus = (plan: AutomationTemplatePlan) =>
  plan.statuses.find((s) => /review/i.test(s.name))?.status;

const todoStatuses = (plan: AutomationTemplatePlan) =>
  plan.statuses.filter((s) => plan.phases.get(s.status) === 'todo').map((s) => s.status);
const doingStatuses = (plan: AutomationTemplatePlan) =>
  plan.statuses.filter((s) => plan.phases.get(s.status) === 'doing').map((s) => s.status);

const bugType = (plan: AutomationTemplatePlan) =>
  plan.types.find((t) => /^bugs?$/i.test(t.label.trim()))?.id;

function rule(
  plan: AutomationTemplatePlan,
  name: string,
  trigger: AutomationTrigger,
  conditions: AutomationCondition[],
  steps: AutomationStep[],
): AutomationRuleBody {
  return { name, trigger, conditions, steps, chain: false, timeZone: plan.timeZone };
}

// Card Moved to the plan's done columns: none, and the column is the person's to pick.
function movedToDone(plan: AutomationTemplatePlan): {
  trigger: AutomationTrigger;
  picks: AutomationTemplatePickAt[];
} {
  const to = doneStatuses(plan);
  return {
    trigger: { kind: 'card_moved', to },
    picks: to.length ? [] : [{ path: 'trigger', pick: 'column' }],
  };
}

const NINE = '09:00';
const MONDAY = 1;

// ---- The templates ----------------------------------------------------------------------------------------------------

export const AUTOMATION_TEMPLATES: readonly AutomationTemplate[] = [
  {
    id: 'stamp-finish',
    name: 'Stamp the Finish Date',
    description:
      'When a card moves to a done column, set Completed On to today and clear its flag.',
    category: 'status',
    build(plan) {
      const { trigger, picks } = movedToDone(plan);
      const field = finishDateField(plan);
      return {
        body: rule(
          plan,
          this.name,
          trigger,
          [],
          [
            { kind: 'set_field', field: field ?? '', value: { date: { today: 0 } } },
            { kind: 'unflag' },
          ],
        ),
        picks: field ? picks : [...picks, { path: 'steps.0', pick: 'field' }],
      };
    },
  },
  {
    id: 'assign-on-start',
    name: 'Assign on Start',
    description: 'When a card moves to In Progress with no assignee, assign whoever moved it.',
    category: 'assigning',
    build(plan) {
      const doing = inProgressStatus(plan);
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'card_moved', to: doing ? [doing] : [] },
          [{ kind: 'field', field: 'assignee', op: 'empty' }],
          [{ kind: 'assign', to: { trigger: true } }],
        ),
        picks: doing ? [] : [{ path: 'trigger', pick: 'column' }],
      };
    },
  },
  {
    id: 'overdue-nudge',
    name: 'Overdue Nudge',
    description: 'Every weekday at 9:00, flag overdue cards and email their assignee.',
    category: 'due_dates',
    build(plan) {
      const done = doneStatuses(plan);
      const conditions: AutomationCondition[] = [
        { kind: 'field', field: 'due', op: 'before', value: { today: 0 } },
      ];
      if (done.length) conditions.push({ kind: 'column', not: true, statuses: done });
      return {
        body: rule(plan, this.name, { kind: 'scheduled', every: 'weekday', at: NINE }, conditions, [
          { kind: 'flag' },
          {
            kind: 'email',
            to: { assignee: true },
            subject: '{{card.title}} is overdue',
            body: '{{card.title}} was due on {{card.due}}. Open it: {{card.url}}',
          },
        ]),
        picks: [],
      };
    },
  },
  {
    id: 'form-responses',
    name: 'Share Out Form Responses',
    description:
      'When a form response lands, assign people in turn and thank the sender in a comment.',
    category: 'forms',
    build(plan) {
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'form_response' },
          [],
          [
            { kind: 'assign', to: { rotate: [] } },
            {
              kind: 'comment',
              text: 'Thanks for sending this in. {{card.assignee}} has it now and will be in touch.',
            },
          ],
        ),
        picks: [{ path: 'steps.0', pick: 'people' }],
      };
    },
  },
  {
    id: 'shipped-to-slack',
    name: 'Post Shipped Work to Slack',
    description:
      'When a card with a chosen label moves to Done, post its title and link to a channel.',
    category: 'telling_people',
    build(plan) {
      const { trigger, picks } = movedToDone(plan);
      const post: AutomationOutgoing = {
        kind: 'notify',
        via: 'slack',
        webhook: '',
        text: 'Shipped: {{card.title}} {{card.url}}',
      };
      return {
        body: rule(
          plan,
          this.name,
          trigger,
          [{ kind: 'field', field: 'labels', op: 'contains', value: '' }],
          [post],
        ),
        picks: [
          ...picks,
          { path: 'conditions.0', pick: 'label' },
          { path: 'steps.0', pick: 'webhook' },
        ],
      };
    },
  },
  {
    id: 'triage-bugs',
    name: 'Triage New Bugs',
    description:
      'When a Bug card is added, label it triage and assign the people on triage in turn.',
    category: 'assigning',
    build(plan) {
      const bug = bugType(plan);
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'card_created' },
          [{ kind: 'type', types: bug ? [bug] : [] }],
          [
            { kind: 'add_label', label: 'triage' },
            { kind: 'assign', to: { rotate: [] } },
          ],
        ),
        picks: [
          ...(bug ? [] : [{ path: 'conditions.0', pick: 'type' as const }]),
          { path: 'steps.1', pick: 'people' },
        ],
      };
    },
  },
  {
    id: 'unblock-next',
    name: 'Unblock the Next Card',
    description: 'When a card is done, comment on every card it was blocking that it can start.',
    category: 'status',
    build(plan) {
      const { trigger, picks } = movedToDone(plan);
      return {
        body: rule(
          plan,
          this.name,
          trigger,
          [],
          [
            {
              kind: 'for',
              related: { kind: 'blocking' },
              conditions: [],
              then: [
                {
                  kind: 'comment',
                  text: '{{trigger.key}} {{trigger.title}} is done, so this card can start.',
                },
              ],
            },
          ],
        ),
        picks,
      };
    },
  },
  {
    id: 'due-soon',
    name: 'Due Soon Reminder',
    description: 'Two days before a card is due, email its assignee with a link to the card.',
    category: 'due_dates',
    build(plan) {
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'due_in', days: 2, at: NINE },
          [],
          [
            {
              kind: 'email',
              to: { assignee: true },
              subject: '{{card.title}} is due in 2 days',
              body: '{{card.title}} is due on {{card.due}}. Open it: {{card.url}}',
            },
          ],
        ),
        picks: [],
      };
    },
  },
  {
    id: 'clean-up-done',
    name: 'Clean Up Done',
    description: 'Every Monday at 9:00, archive cards that have been done for more than 14 days.',
    category: 'status',
    build(plan) {
      const done = doneStatuses(plan);
      const field = finishDateField(plan);
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'scheduled', every: 'week', days: [MONDAY], at: NINE },
          [
            { kind: 'column', statuses: done },
            { kind: 'field', field: field ?? '', op: 'before', value: { today: -14 } },
          ],
          [{ kind: 'archive' }],
        ),
        picks: [
          ...(done.length ? [] : [{ path: 'conditions.0', pick: 'column' as const }]),
          ...(field ? [] : [{ path: 'conditions.1', pick: 'field' as const }]),
        ],
      };
    },
  },
  {
    id: 'escalate-urgent',
    name: 'Escalate Urgent Work',
    description:
      "When a card's priority becomes Urgent, flag it, email its assignee and post to Slack.",
    category: 'telling_people',
    build(plan) {
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'field_changed', fields: ['priority'] },
          [{ kind: 'field', field: 'priority', op: 'is', value: 'urgent' }],
          [
            { kind: 'flag' },
            {
              kind: 'email',
              to: { assignee: true },
              subject: '{{card.title}} is now urgent',
              body: '{{person}} made {{card.title}} urgent. Open it: {{card.url}}',
            },
            {
              kind: 'notify',
              via: 'slack',
              webhook: '',
              text: 'Urgent: {{card.title}} ({{card.assignee}}) {{card.url}}',
            },
          ],
        ),
        picks: [{ path: 'steps.2', pick: 'webhook' }],
      };
    },
  },
  {
    id: 'reopen-on-comment',
    name: 'Reopen on New Comment',
    description: 'When someone comments on a done card, move it back to In Progress and flag it.',
    category: 'status',
    build(plan) {
      const done = doneStatuses(plan);
      const doing = inProgressStatus(plan);
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'comment_added' },
          [{ kind: 'column', statuses: done }],
          [{ kind: 'move', status: doing ?? '' }, { kind: 'flag' }],
        ),
        picks: [
          ...(done.length ? [] : [{ path: 'conditions.0', pick: 'column' as const }]),
          ...(doing ? [] : [{ path: 'steps.0', pick: 'column' as const }]),
        ],
      };
    },
  },
  {
    id: 'route-reviews',
    name: 'Route Reviews',
    description:
      'When a card moves to Review, assign reviewers in turn and say it is ready for them.',
    category: 'assigning',
    build(plan) {
      const review = reviewStatus(plan);
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'card_moved', to: review ? [review] : [] },
          [],
          [
            { kind: 'assign', to: { rotate: [] } },
            { kind: 'comment', text: '{{card.assignee}}, this is ready for your review.' },
          ],
        ),
        picks: [
          ...(review ? [] : [{ path: 'trigger', pick: 'column' as const }]),
          { path: 'steps.0', pick: 'people' },
        ],
      };
    },
  },
  {
    id: 'due-on-start',
    name: 'Give It a Due Date',
    description: 'When a card moves to In Progress with no due date, set it due a week from today.',
    category: 'due_dates',
    build(plan) {
      const doing = inProgressStatus(plan);
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'card_moved', to: doing ? [doing] : [] },
          [{ kind: 'field', field: 'due', op: 'empty' }],
          [{ kind: 'set_field', field: 'due', value: { date: { today: 7 } } }],
        ),
        picks: doing ? [] : [{ path: 'trigger', pick: 'column' }],
      };
    },
  },
  {
    id: 'flag-blocked',
    name: 'Flag Blocked Cards',
    description:
      'When a card gets the blocked label, flag it and ask in a comment what it waits on.',
    category: 'status',
    build(plan) {
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'field_changed', fields: ['labels'] },
          [{ kind: 'field', field: 'labels', op: 'contains', value: 'blocked' }],
          [
            { kind: 'flag' },
            {
              kind: 'comment',
              text: '{{card.assignee}}, this card is blocked. What is it waiting on?',
            },
          ],
        ),
        picks: [],
      };
    },
  },
  {
    id: 'verify-fix',
    name: 'Verify the Fix',
    description: 'When a Bug card is done, add a Verify Fix card to its first column to check it.',
    category: 'status',
    build(plan) {
      const { trigger, picks } = movedToDone(plan);
      const bug = bugType(plan);
      const first = todoStatuses(plan)[0];
      const create: AutomationAction = {
        kind: 'create_card',
        type: bug ?? '',
        title: 'Verify fix: {{card.title}}',
        copy: ['assignee', 'labels'],
      };
      if (first) create.status = first;
      return {
        body: rule(plan, this.name, trigger, [{ kind: 'type', types: bug ? [bug] : [] }], [create]),
        picks: [
          ...picks,
          ...(bug
            ? []
            : [
                { path: 'conditions.0', pick: 'type' as const },
                { path: 'steps.0', pick: 'type' as const },
              ]),
        ],
      };
    },
  },
  {
    id: 'back-to-backlog',
    name: 'Back to the Backlog',
    description: 'When a card moves back to a to-do column, unassign it and clear its due date.',
    category: 'assigning',
    build(plan) {
      const from = doingStatuses(plan);
      const to = todoStatuses(plan);
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'card_moved', from, to },
          [],
          [
            { kind: 'assign', to: { nobody: true } },
            { kind: 'clear_field', field: 'due' },
          ],
        ),
        picks: to.length ? [] : [{ path: 'trigger', pick: 'column' }],
      };
    },
  },
  {
    id: 'close-parent',
    name: 'Close the Parent',
    description: 'When the last of a card’s children is done, move the card to Done too.',
    category: 'status',
    build(plan) {
      const done = doneStatuses(plan)[0];
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'related_done', related: 'children' },
          [],
          [{ kind: 'move', status: done ?? '' }],
        ),
        picks: done ? [] : [{ path: 'steps.0', pick: 'column' }],
      };
    },
  },
  {
    id: 'tell-unblocked',
    name: 'Tell Them It’s Unblocked',
    description:
      'When the last card blocking a card is done, mention its assignee so they can start.',
    category: 'telling_people',
    build(plan) {
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'card_unblocked' },
          [],
          [
            {
              kind: 'mention',
              to: { assignee: true },
              text: 'Nothing is blocking this any more, so it is ready to start.',
            },
          ],
        ),
        picks: [],
      };
    },
  },
  {
    id: 'nudge-stuck',
    name: 'Nudge Stuck Cards',
    description: 'Each morning, flag cards that have not changed for 5 days and ask for an update.',
    category: 'telling_people',
    build(plan) {
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'stuck', days: 5, at: '09:00' },
          [],
          [
            { kind: 'flag' },
            {
              kind: 'mention',
              to: { assignee: true },
              text: 'No change for 5 days. How is it going?',
            },
          ],
        ),
        picks: [],
      };
    },
  },
  {
    id: 'done-when-resolved',
    name: 'Done When Feedback Is Resolved',
    description: 'When the last comment thread on a card in Review is resolved, move it to Done.',
    category: 'status',
    build(plan) {
      const review = reviewStatus(plan);
      const done = doneStatuses(plan)[0];
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'threads_resolved' },
          review ? [{ kind: 'column', statuses: [review] }] : [],
          [{ kind: 'move', status: done ?? '' }],
        ),
        picks: done ? [] : [{ path: 'steps.0', pick: 'column' }],
      };
    },
  },
  {
    id: 'sort-incoming',
    name: 'Sort Incoming Cards',
    description:
      'When a card is added, AI suggests its card type and sets its priority and labels.',
    category: 'ai',
    build(plan) {
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'card_created' },
          [],
          [
            { kind: 'ai', task: 'card_type', set: true },
            { kind: 'ai', task: 'triage', priority: true, labels: true },
          ],
        ),
        picks: [],
      };
    },
  },
  {
    id: 'summarise-requests',
    name: 'Summarise Form Requests',
    description:
      'When a form response lands, AI summarises it in a comment and sets its priority and labels.',
    category: 'ai',
    build(plan) {
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'form_response' },
          [],
          [
            { kind: 'ai', task: 'summarise' },
            { kind: 'ai', task: 'triage', priority: true, labels: true },
          ],
        ),
        picks: [],
      };
    },
  },
];

export const automationTemplate = (id: string): AutomationTemplate | undefined =>
  AUTOMATION_TEMPLATES.find((t) => t.id === id);

// ---- What is left to pick -----------------------------------------------------------------------------------------

function partAt(body: AutomationRuleBody, path: string): unknown {
  const [head, a, b, c] = path.split('.');
  if (head === 'trigger') return body.trigger;
  if (head === 'conditions') return body.conditions[Number(a)];
  const step = body.steps[Number(a)];
  if (b === undefined || !step) return step;
  if (step.kind === 'for' && b === 'then') return step.then[Number(c)];
  return undefined;
}

// Whether a pick's slot is still empty: a column, a type, a field, a label, the people in turn, a webhook.
function stillEmpty(part: unknown, pick: AutomationPick): boolean {
  if (part === undefined) return false;
  const p = part as AutomationTrigger | AutomationCondition | AutomationAction | AutomationOutgoing;
  switch (pick) {
    case 'column':
      return (
        (p.kind === 'card_moved' && !p.to?.length) ||
        (p.kind === 'column' && p.statuses.length === 0) ||
        (p.kind === 'move' && p.status === '')
      );
    case 'type':
      return (
        (p.kind === 'type' && p.types.length === 0) || (p.kind === 'create_card' && p.type === '')
      );
    case 'field':
      return (p.kind === 'set_field' || p.kind === 'field') && p.field === '';
    case 'label':
      return (
        (p.kind === 'field' && (p.value === '' || p.value === undefined)) ||
        ((p.kind === 'add_label' || p.kind === 'remove_label') && p.label === '')
      );
    case 'people':
      return p.kind === 'assign' && 'rotate' in p.to && p.to.rotate.length < 2;
    case 'webhook':
      return p.kind === 'notify' && p.webhook === '';
  }
}

/** The template's picks whose slot is still empty in `body` (a picked one, or a step deleted, drops out). */
export function picksLeft(
  body: AutomationRuleBody,
  picks: readonly AutomationTemplatePickAt[],
): AutomationTemplatePickAt[] {
  return picks.filter((p) => stillEmpty(partAt(body, p.path), p.pick));
}
