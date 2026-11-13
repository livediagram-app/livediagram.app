import { describe, expect, it } from 'vitest';
import type { ItemTypeDef } from '../item-types';
import type { StatusPhase } from '../plan-views';
import {
  AUTOMATION_PICK_WORDS,
  AUTOMATION_TEMPLATE_CATEGORIES,
  AUTOMATION_TEMPLATE_CATEGORY_NAMES,
  AUTOMATION_TEMPLATE_IDS,
  AUTOMATION_TEMPLATES,
  automationTemplate,
  picksLeft,
  type AutomationTemplatePlan,
} from './templates';
import type { AutomationRuleBody, AutomationStep } from './types';
import { readRuleBody } from './validate';
import { namedRuleBody } from './named';

// docs/specs/026-plan/automations.md "The Automations screen": Templates.
const TASK: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'item',
  color: '#2563eb',
  fields: ['title', 'status', 'assignee', 'labels', 'due', 'f-done', 'f-other'],
  custom: [
    { id: 'f-other', label: 'Kick-off', kind: 'date' },
    { id: 'f-done', label: 'Completed On', kind: 'date' },
    // Not on the type's fields: never picked.
    { id: 'f-gone', label: 'Finished', kind: 'date' },
  ],
  statuses: ['todo', 'doing', 'review', 'done'],
};
const BUG: ItemTypeDef = { ...TASK, id: 'bug', label: ' Bugs ', custom: [], fields: ['title'] };

// A type with no custom fields at all.
const { custom: _none, ...PLAIN } = TASK;

const phases = (entries: [string, StatusPhase][]) => new Map(entries);

const FULL: AutomationTemplatePlan = {
  statuses: [
    { status: 'todo', name: 'To Do' },
    { status: 'review', name: 'Review' },
    { status: 'doing', name: 'In Progress' },
    { status: 'done', name: 'Done' },
    { status: 'shipped', name: 'Shipped' },
  ],
  phases: phases([
    ['todo', 'todo'],
    ['review', 'doing'],
    ['doing', 'doing'],
    ['done', 'done'],
    ['shipped', 'done'],
  ]),
  types: [TASK, BUG],
  timeZone: 'Europe/London',
};

// A plan with nothing to fill by: one column, a type with no date field.
const BARE: AutomationTemplatePlan = {
  statuses: [{ status: 'todo', name: 'To Do' }],
  phases: phases([['todo', 'todo']]),
  types: [{ ...PLAIN, fields: ['title'] }],
  timeZone: 'UTC',
};

const build = (id: string, plan: AutomationTemplatePlan) => automationTemplate(id)!.build(plan);

describe('the templates', () => {
  it('are the spec’s, in its order, each with a category and a fixed id', () => {
    expect(AUTOMATION_TEMPLATES.map((t) => t.name)).toEqual([
      'Stamp the Finish Date',
      'Assign on Start',
      'Overdue Nudge',
      'Share Out Form Responses',
      'Post Shipped Work to Slack',
      'Triage New Bugs',
      'Unblock the Next Card',
      'Due Soon Reminder',
      'Clean Up Done',
      'Escalate Urgent Work',
      'Reopen on New Comment',
      'Route Reviews',
      'Give It a Due Date',
      'Flag Blocked Cards',
      'Verify the Fix',
      'Back to the Backlog',
      'Close the Parent',
      'Tell Them It’s Unblocked',
      'Nudge Stuck Cards',
      'Done When Feedback Is Resolved',
      'Sort Incoming Cards',
      'Summarise Form Requests',
      'Review When a Pull Request Opens',
      'Done When the Pull Request Merges',
      'Flag Failing Checks',
      'Tell Them the Checks Pass',
      'Back to In Progress When Closed',
      'Post Merged Work to Slack',
    ]);
    expect(AUTOMATION_TEMPLATES.map((t) => t.id)).toEqual([...AUTOMATION_TEMPLATE_IDS]);
    for (const t of AUTOMATION_TEMPLATES) {
      expect(AUTOMATION_TEMPLATE_CATEGORIES).toContain(t.category);
      expect(t.description.endsWith('.')).toBe(true);
    }
    expect(
      AUTOMATION_TEMPLATE_CATEGORIES.map((c) => AUTOMATION_TEMPLATE_CATEGORY_NAMES[c]),
    ).toEqual(['Status', 'Assigning', 'Due Dates', 'Forms', 'Telling People', 'AI', 'GitHub']);
    expect(automationTemplate('nope')).toBeUndefined();
  });

  it('build rules named after themselves, off the chain, in the plan’s time zone', () => {
    for (const t of AUTOMATION_TEMPLATES) {
      const { body } = t.build(FULL);
      expect(body.name).toBe(t.name);
      expect(body.chain).toBe(false);
      expect(body.timeZone).toBe('Europe/London');
    }
  });

  it('Stamp the Finish Date fills the done columns and a field named like Completed On', () => {
    const { body, picks } = build('stamp-finish', FULL);
    expect(body.trigger).toEqual({ kind: 'card_moved', to: ['done', 'shipped'] });
    expect(body.steps).toEqual([
      { kind: 'set_field', field: 'f-done', value: { date: { today: 0 } } },
      { kind: 'unflag' },
    ]);
    expect(picks).toEqual([]);
    const bare = build('stamp-finish', BARE);
    expect(bare.body.trigger).toEqual({ kind: 'card_moved', to: [] });
    expect(bare.picks).toEqual([
      { path: 'trigger', pick: 'column' },
      { path: 'steps.0', pick: 'field' },
    ]);
  });

  it('Assign on Start picks the column called In Progress, else the first in progress', () => {
    const { body, picks } = build('assign-on-start', FULL);
    expect(body.trigger).toEqual({ kind: 'card_moved', to: ['doing'] });
    expect(body.conditions).toEqual([{ kind: 'field', field: 'assignee', op: 'empty' }]);
    expect(body.steps).toEqual([{ kind: 'assign', to: { trigger: true } }]);
    expect(picks).toEqual([]);
    const unnamed = build('assign-on-start', {
      ...FULL,
      statuses: FULL.statuses.filter((s) => s.status !== 'doing'),
    });
    expect(unnamed.body.trigger).toEqual({ kind: 'card_moved', to: ['review'] });
    expect(build('assign-on-start', BARE).picks).toEqual([{ path: 'trigger', pick: 'column' }]);
  });

  it('Overdue Nudge runs every weekday at 9:00 on cards past due and not done', () => {
    const { body, picks } = build('overdue-nudge', FULL);
    expect(body.trigger).toEqual({ kind: 'scheduled', every: 'weekday', at: '09:00' });
    expect(body.conditions).toEqual([
      { kind: 'field', field: 'due', op: 'before', value: { today: 0 } },
      { kind: 'column', not: true, statuses: ['done', 'shipped'] },
    ]);
    expect(body.steps.map((s) => s.kind)).toEqual(['flag', 'email']);
    expect(picks).toEqual([]);
    expect(build('overdue-nudge', BARE).body.conditions).toHaveLength(1);
  });

  it('leaves the people in turn, a label and a webhook to pick', () => {
    expect(build('form-responses', FULL).picks).toEqual([{ path: 'steps.0', pick: 'people' }]);
    expect(build('shipped-to-slack', FULL).picks).toEqual([
      { path: 'conditions.0', pick: 'label' },
      { path: 'steps.0', pick: 'webhook' },
    ]);
    expect(build('shipped-to-slack', BARE).picks[0]).toEqual({ path: 'trigger', pick: 'column' });
    expect(build('triage-bugs', FULL).body.conditions).toEqual([{ kind: 'type', types: ['bug'] }]);
    expect(build('triage-bugs', FULL).picks).toEqual([{ path: 'steps.1', pick: 'people' }]);
    expect(build('triage-bugs', BARE).picks).toEqual([
      { path: 'conditions.0', pick: 'type' },
      { path: 'steps.1', pick: 'people' },
    ]);
  });

  it('Unblock the Next Card comments on each card it blocks, naming the triggering card', () => {
    const { body } = build('unblock-next', FULL);
    const branch = body.steps[0] as AutomationStep & { kind: 'for' };
    expect(branch.related).toEqual({ kind: 'blocking' });
    expect(branch.then[0]).toMatchObject({ kind: 'comment' });
    expect(JSON.stringify(branch.then)).toContain('{{trigger.title}}');
    expect(build('due-soon', FULL).body.trigger).toEqual({ kind: 'due_in', days: 2, at: '09:00' });
  });

  it('build rules the api takes once their picks are filled', () => {
    const fill = (body: AutomationRuleBody): AutomationRuleBody =>
      JSON.parse(
        JSON.stringify(body)
          .replace('"rotate":[]', '"rotate":["p1","p2"]')
          .replace('"webhook":""', '"webhook":"w1"')
          .replace('"op":"contains","value":""', '"op":"contains","value":"launch"'),
      ) as AutomationRuleBody;
    for (const t of AUTOMATION_TEMPLATES) {
      const got = readRuleBody(fill(t.build(FULL).body));
      expect('body' in got ? null : got).toBeNull();
    }
  });
});

// docs/specs/026-plan/automations.md "GitHub triggers": Templates.
describe('the GitHub templates', () => {
  const GITHUB = [
    'review-on-open',
    'done-on-merge',
    'flag-failing-checks',
    'tell-checks-pass',
    'back-on-close',
    'merged-to-slack',
  ];

  it('are the GitHub category’s, each on a GitHub trigger with nobody behind it', () => {
    expect(AUTOMATION_TEMPLATES.filter((t) => t.category === 'github').map((t) => t.id)).toEqual(
      GITHUB,
    );
    for (const id of GITHUB) {
      const { body } = build(id, FULL);
      expect(body.trigger.kind).toMatch(/^pull_request_/);
      expect(JSON.stringify(body)).not.toContain('"trigger":true');
      expect(body.conditions.some((c) => c.kind === 'who')).toBe(false);
    }
  });

  it('Review When a Pull Request Opens moves to the column named like Review, else leaves it to pick', () => {
    const { body, picks } = build('review-on-open', FULL);
    expect(body.trigger).toEqual({ kind: 'pull_request_opened' });
    expect(body.steps).toEqual([{ kind: 'move', status: 'review' }]);
    expect(picks).toEqual([]);
    const bare = build('review-on-open', BARE);
    expect(bare.body.steps).toEqual([{ kind: 'move', status: '' }]);
    expect(bare.picks).toEqual([{ path: 'steps.0', pick: 'column' }]);
    expect(picksLeft(bare.body, bare.picks)).toEqual(bare.picks);
  });

  it('Done When the Pull Request Merges moves to the first done column and stamps Completed On', () => {
    const { body, picks } = build('done-on-merge', FULL);
    expect(body.trigger).toEqual({ kind: 'pull_request_merged' });
    expect(body.steps).toEqual([
      { kind: 'move', status: 'done' },
      { kind: 'set_field', field: 'f-done', value: { date: { today: 0 } } },
    ]);
    expect(picks).toEqual([]);
    expect(build('done-on-merge', BARE).picks).toEqual([
      { path: 'steps.0', pick: 'column' },
      { path: 'steps.1', pick: 'field' },
    ]);
  });

  it('Flag Failing Checks and Tell Them the Checks Pass hear each result, with nothing to pick', () => {
    const failing = build('flag-failing-checks', BARE);
    expect(failing.body.trigger).toEqual({ kind: 'pull_request_checks', result: 'failing' });
    expect(failing.body.steps.map((s) => s.kind)).toEqual(['flag', 'comment']);
    expect(failing.picks).toEqual([]);
    const passing = build('tell-checks-pass', BARE);
    expect(passing.body.trigger).toEqual({ kind: 'pull_request_checks', result: 'passing' });
    expect(passing.body.steps).toEqual([
      { kind: 'unflag' },
      { kind: 'mention', to: { assignee: true }, text: expect.stringContaining('checks pass') },
    ]);
    expect(passing.picks).toEqual([]);
  });

  it('Back to In Progress When Closed spares done cards, and leaves the column to pick on a bare plan', () => {
    const { body, picks } = build('back-on-close', FULL);
    expect(body.trigger).toEqual({ kind: 'pull_request_closed' });
    expect(body.conditions).toEqual([{ kind: 'column', not: true, statuses: ['done', 'shipped'] }]);
    expect(body.steps.map((s) => s.kind)).toEqual(['move', 'comment']);
    expect(body.steps[0]).toEqual({ kind: 'move', status: 'doing' });
    expect(picks).toEqual([]);
    const bare = build('back-on-close', BARE);
    expect(bare.body.conditions).toEqual([]);
    expect(bare.picks).toEqual([{ path: 'steps.0', pick: 'column' }]);
  });

  it('Post Merged Work to Slack leaves the webhook to pick', () => {
    const { body, picks } = build('merged-to-slack', FULL);
    expect(body.trigger).toEqual({ kind: 'pull_request_merged' });
    expect(body.steps).toEqual([
      { kind: 'notify', via: 'slack', webhook: '', text: 'Merged: {{card.title}} {{card.url}}' },
    ]);
    expect(picks).toEqual([{ path: 'steps.0', pick: 'webhook' }]);
  });
});

describe('picksLeft', () => {
  it('drops each pick as its slot is filled', () => {
    const slack = build('shipped-to-slack', BARE);
    expect(picksLeft(slack.body, slack.picks)).toHaveLength(3);
    const filled: AutomationRuleBody = {
      ...slack.body,
      trigger: { kind: 'card_moved', to: ['todo'] },
      conditions: [{ kind: 'field', field: 'labels', op: 'contains', value: 'launch' }],
      steps: [{ kind: 'notify', via: 'slack', webhook: 'w1', text: 'x' }],
    };
    expect(picksLeft(filled, slack.picks)).toEqual([]);
    const people = build('triage-bugs', BARE);
    const picked: AutomationRuleBody = {
      ...people.body,
      conditions: [{ kind: 'type', types: ['task'] }],
      steps: [people.body.steps[0]!, { kind: 'assign', to: { rotate: ['a', 'b'] } }],
    };
    expect(picksLeft(picked, people.picks)).toEqual([]);
    const field = build('stamp-finish', BARE);
    expect(picksLeft(field.body, field.picks).map((p) => p.pick)).toEqual(['column', 'field']);
  });

  it('forgets a pick whose step is gone or changed kind', () => {
    const { body, picks } = build('form-responses', FULL);
    expect(picksLeft({ ...body, steps: [] }, picks)).toEqual([]);
    expect(picksLeft({ ...body, steps: [{ kind: 'flag' }] }, picks)).toEqual([]);
  });

  it('reads a label in a condition or a step, a field in a condition, and a branch’s actions', () => {
    const body: AutomationRuleBody = {
      ...build('unblock-next', FULL).body,
      conditions: [
        { kind: 'field', field: '', op: 'not_empty' },
        { kind: 'field', field: 'labels', op: 'contains' },
      ],
      steps: [
        {
          kind: 'for',
          related: { kind: 'children' },
          conditions: [],
          then: [
            { kind: 'add_label', label: '' },
            { kind: 'remove_label', label: '' },
          ],
        },
        { kind: 'flag' },
      ],
    };
    const picks = [
      { path: 'conditions.0', pick: 'field' as const },
      { path: 'conditions.1', pick: 'label' as const },
      { path: 'steps.0.then.0', pick: 'label' as const },
      { path: 'steps.0.then.1', pick: 'label' as const },
      { path: 'steps.0.else.0', pick: 'label' as const },
      { path: 'steps.1.then.0', pick: 'label' as const },
      { path: 'steps.1', pick: 'label' as const },
    ];
    expect(picksLeft(body, picks).map((p) => p.path)).toEqual([
      'conditions.0',
      'conditions.1',
      'steps.0.then.0',
      'steps.0.then.1',
    ]);
  });

  it('words each pick as its step says it', () => {
    expect(AUTOMATION_PICK_WORDS.field).toBe('Pick a field');
    expect(AUTOMATION_PICK_WORDS.label).toBe('Pick a label');
    expect(AUTOMATION_PICK_WORDS.people).toBe('Pick people');
    expect(AUTOMATION_PICK_WORDS.webhook).toBe('Pick a webhook');
  });
});

// docs/specs/026-plan/automations.md "Agents and the CLI": list_rules answers a rule by id and change_rules takes it
// back unchanged, so every kind a template writes comes through namedRuleBody as it went in.
describe('a template rule through the agents’ naming', () => {
  it.each(AUTOMATION_TEMPLATES.map((t) => [t.id, t] as const))('%s round-trips', (_id, t) => {
    const { body } = t.build(FULL);
    const names = { statuses: FULL.statuses, types: FULL.types, people: [], tabs: [] };
    expect(namedRuleBody(body, names)).toEqual(body);
  });
});
