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

// ---- The eight ----------------------------------------------------------------------------------------------------

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
      return p.kind === 'card_moved' && !p.to?.length;
    case 'type':
      return p.kind === 'type' && p.types.length === 0;
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
