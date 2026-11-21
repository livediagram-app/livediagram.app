// What Insert a Value offers (docs/specs/026-plan/automations.md "Values"), grouped: This Card's fixed values, The
// Triggering Card's inside a For Related Cards branch, each of the card's fields by name, and in an Incoming Webhook
// rule Webhook Field…, which asks for a path rather than inserting at once, in a GitHub rule the pull request's, and
// in an Email Received rule the sender's (From Email), and in a Form Response rule each question's answer (Form
// Answers).
// Pure.

import {
  AUTOMATION_BRANCH_VALUE_LABELS,
  AUTOMATION_BRANCH_VALUE_NAMES,
  AUTOMATION_EMAIL_VALUE_LABELS,
  AUTOMATION_EMAIL_VALUE_NAMES,
  AUTOMATION_PULL_REQUEST_VALUE_LABELS,
  AUTOMATION_PULL_REQUEST_VALUE_NAMES,
  AUTOMATION_VALUE_LABELS,
  AUTOMATION_VALUE_NAMES,
} from '@liveplanner/items';
import {
  WEBHOOK_VALUE_GROUP,
  filterValueGroups,
  type ValueGroup,
  type ValueOption,
} from '@liveworkspace/automations-ui/value-groups';

export { filterValueGroups };
export type { ValueGroup, ValueOption };

const THIS_CARD: ValueGroup = {
  id: 'card',
  label: 'This Card',
  options: AUTOMATION_VALUE_NAMES.map((name) => ({
    kind: 'value',
    id: `value:${name}`,
    label: AUTOMATION_VALUE_LABELS[name],
    name,
  })),
};
// This Card without Who Did It: an Email Received or Incoming Webhook rule has nobody of the plan behind it (From Email
// and Webhook Field… say who sent it), so it is not offered there.
const THIS_CARD_PERSONLESS: ValueGroup = {
  ...THIS_CARD,
  options: THIS_CARD.options.filter((o) => o.kind !== 'value' || o.name !== 'person'),
};
const TRIGGERING_CARD: ValueGroup = {
  id: 'trigger',
  label: 'The Triggering Card',
  options: AUTOMATION_BRANCH_VALUE_NAMES.map((name) => ({
    kind: 'value',
    id: `value:${name}`,
    label: AUTOMATION_BRANCH_VALUE_LABELS[name],
    name,
  })),
};
const PULL_REQUEST: ValueGroup = {
  id: 'pull_request',
  label: 'Pull Request',
  options: AUTOMATION_PULL_REQUEST_VALUE_NAMES.map((name) => ({
    kind: 'value',
    id: `value:${name}`,
    label: AUTOMATION_PULL_REQUEST_VALUE_LABELS[name],
    name,
  })),
};
const EMAIL: ValueGroup = {
  id: 'email',
  label: 'Email',
  options: AUTOMATION_EMAIL_VALUE_NAMES.map((name) => ({
    kind: 'value',
    id: `value:${name}`,
    label: AUTOMATION_EMAIL_VALUE_LABELS[name],
    name,
  })),
};
/** The groups for a field: inside a branch or not, the card's fields, whether the rule is an Incoming Webhook's,
 *  whether a GitHub trigger's (the Pull Request group, after This Card) and whether an Email Received's (the Email
 *  group, after This Card). An Incoming Webhook or Email Received rule's This Card leaves out Who Did It. */
export function valueInsertGroups(
  branch: boolean,
  fields: readonly { id: string; name: string }[],
  incoming: boolean,
  github = false,
  email = false,
  // A Form Response rule's questions: a Form Answers group after This Card.
  formQuestions?: readonly string[],
): ValueGroup[] {
  const groups: ValueGroup[] = [incoming || email ? THIS_CARD_PERSONLESS : THIS_CARD];
  if (github) groups.push(PULL_REQUEST);
  if (email) groups.push(EMAIL);
  if (formQuestions?.length)
    groups.push({
      id: 'answers',
      label: 'Form Answers',
      options: formQuestions.map((q) => ({
        kind: 'value',
        id: `answer:${q}`,
        label: q,
        name: `answer.${q}`,
      })),
    });
  if (branch) groups.push(TRIGGERING_CARD);
  if (fields.length > 0)
    groups.push({
      id: 'fields',
      label: 'Card Fields',
      options: fields.map((f) => ({
        kind: 'value',
        id: `field:${f.id}`,
        label: f.name,
        name: `card.field.${f.name}`,
      })),
    });
  if (incoming) groups.push(WEBHOOK_VALUE_GROUP);
  return groups;
}
