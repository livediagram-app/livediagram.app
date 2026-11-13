// Automations: the Templates gallery's GitHub templates (docs/specs/026-plan/automations.md "The Automations screen":
// Templates; "GitHub triggers"): each on a linked pull request's trigger, by GitHub with nobody behind it, so none
// checks Who Did It or acts on whoever triggered it. Part of templates.ts. Pure.

import {
  doneStatuses,
  finishDateField,
  inProgressStatus,
  moveTo,
  reviewStatus,
  rule,
  type AutomationTemplate,
} from './template-kit';

export const GITHUB_TEMPLATES: readonly AutomationTemplate[] = [
  {
    id: 'review-on-open',
    name: 'Review When a Pull Request Opens',
    description: 'When a linked pull request opens, move its card to Review.',
    category: 'github',
    build(plan) {
      const move = moveTo(reviewStatus(plan), 'steps.0');
      return {
        body: rule(plan, this.name, { kind: 'pull_request_opened' }, [], [move.step]),
        picks: move.picks,
      };
    },
  },
  {
    id: 'done-on-merge',
    name: 'Done When the Pull Request Merges',
    description:
      'When a linked pull request merges, move its card to Done and set Completed On to today.',
    category: 'github',
    build(plan) {
      const move = moveTo(doneStatuses(plan)[0], 'steps.0');
      const field = finishDateField(plan);
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'pull_request_merged' },
          [],
          [move.step, { kind: 'set_field', field: field ?? '', value: { date: { today: 0 } } }],
        ),
        picks: field ? move.picks : [...move.picks, { path: 'steps.1', pick: 'field' }],
      };
    },
  },
  {
    id: 'flag-failing-checks',
    name: 'Flag Failing Checks',
    description: "When a linked pull request's checks fail, flag its card and say so in a comment.",
    category: 'github',
    build(plan) {
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'pull_request_checks', result: 'failing' },
          [],
          [
            { kind: 'flag' },
            {
              kind: 'comment',
              text: '{{card.assignee}}, the checks on this card’s pull request are failing.',
            },
          ],
        ),
        picks: [],
      };
    },
  },
  {
    id: 'tell-checks-pass',
    name: 'Tell Them the Checks Pass',
    description:
      "When a linked pull request's checks pass, clear the flag and mention the assignee.",
    category: 'github',
    build(plan) {
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'pull_request_checks', result: 'passing' },
          [],
          [
            { kind: 'unflag' },
            {
              kind: 'mention',
              to: { assignee: true },
              text: 'The checks pass on this card’s pull request, so it is ready for review.',
            },
          ],
        ),
        picks: [],
      };
    },
  },
  {
    id: 'back-on-close',
    name: 'Back to In Progress When Closed',
    description:
      'When a linked pull request closes without merging, move its card back to In Progress.',
    category: 'github',
    build(plan) {
      const done = doneStatuses(plan);
      const move = moveTo(inProgressStatus(plan), 'steps.0');
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'pull_request_closed' },
          done.length ? [{ kind: 'column', not: true, statuses: done }] : [],
          [
            move.step,
            { kind: 'comment', text: 'A pull request for this card closed without merging.' },
          ],
        ),
        picks: move.picks,
      };
    },
  },
  {
    id: 'merged-to-slack',
    name: 'Post Merged Work to Slack',
    description:
      "When a linked pull request merges, post its card's title and link to a Slack channel.",
    category: 'github',
    build(plan) {
      return {
        body: rule(
          plan,
          this.name,
          { kind: 'pull_request_merged' },
          [],
          [
            {
              kind: 'notify',
              via: 'slack',
              webhook: '',
              text: 'Merged: {{card.title}} {{card.url}}',
            },
          ],
        ),
        picks: [{ path: 'steps.0', pick: 'webhook' }],
      };
    },
  },
];
