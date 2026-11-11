// Automations: what a rule names that the plan lacks (docs/specs/026-plan/automations.md "Conditions", "Copies,
// exports and deletes"; blueprint automations.md "Files"). A card type, column, field, person, saved filter or Form tab
// gone since the rule was written (or never in a copy): the Rules list marks the rule Needs Attention with these
// lines. Each thing is said once, in the order the rule names it. The plan's webhooks live in the index, not the plan:
// a caller that has them (the builder) passes their ids, and one an outgoing action names that is gone needs
// attention too. Pure.

import type {
  AutomationAction,
  AutomationCondition,
  AutomationOutgoing,
  AutomationRelated,
  AutomationRuleBody,
} from './types';
import { stepActions } from './validate';
import { personOf, planHasField, type AutomationOutline } from './outline';

type Need = {
  kind: 'column' | 'type' | 'field' | 'person' | 'filter' | 'form' | 'webhook';
  id: string;
};

const WORDS: Readonly<Record<Need['kind'], string>> = {
  column: 'Column',
  type: 'Card type',
  field: 'Field',
  person: 'Person',
  filter: 'Saved filter',
  form: 'Form tab',
  webhook: 'Webhook',
};

function conditionNames(c: AutomationCondition): Need[] {
  switch (c.kind) {
    case 'type':
      return c.types.map((id) => ({ kind: 'type', id }));
    case 'column':
      return c.statuses.map((id) => ({ kind: 'column', id }));
    case 'field':
      return [{ kind: 'field', id: c.field }];
    case 'who':
      return c.who.flatMap((w): Need[] =>
        'person' in w ? [{ kind: 'person', id: w.person }] : [],
      );
    case 'saved_filter':
      return [{ kind: 'filter', id: `${c.tab}/${c.filter}` }];
  }
}

function actionNames(a: AutomationAction | AutomationOutgoing): Need[] {
  switch (a.kind) {
    case 'move':
      return [{ kind: 'column', id: a.status }];
    case 'set_field':
      return [
        { kind: 'field', id: a.field },
        ...('from' in a.value ? [{ kind: 'field' as const, id: a.value.from }] : []),
      ];
    case 'clear_field':
      return [{ kind: 'field', id: a.field }];
    case 'assign':
      if ('rotate' in a.to) return a.to.rotate.map((id) => ({ kind: 'person', id }));
      return 'person' in a.to ? [{ kind: 'person', id: a.to.person }] : [];
    case 'notify':
      return [{ kind: 'webhook', id: a.webhook }];
    case 'create_card':
      return [
        { kind: 'type', id: a.type },
        ...(a.status ? [{ kind: 'column' as const, id: a.status }] : []),
        ...(a.linkField ? [{ kind: 'field' as const, id: a.linkField }] : []),
      ];
    case 'email':
      return 'person' in a.to ? [{ kind: 'person', id: a.to.person }] : [];
    default:
      return [];
  }
}

function relatedNames(r: AutomationRelated): Need[] {
  if (r.kind === 'saved_filter') return [{ kind: 'filter', id: `${r.tab}/${r.filter}` }];
  return r.kind === 'linked' && r.field ? [{ kind: 'field', id: r.field }] : [];
}

function namesOf(rule: AutomationRuleBody): Need[] {
  const t = rule.trigger;
  const out: Need[] = [];
  if (t.kind === 'card_created' && t.status) out.push({ kind: 'column', id: t.status });
  if (t.kind === 'form_response' && t.formTab) out.push({ kind: 'form', id: t.formTab });
  if (t.kind === 'card_moved')
    for (const id of [...(t.from ?? []), ...(t.to ?? [])]) out.push({ kind: 'column', id });
  if (t.kind === 'field_changed') for (const id of t.fields) out.push({ kind: 'field', id });
  for (const c of rule.conditions) out.push(...conditionNames(c));
  for (const s of rule.steps) {
    if (s.kind === 'for') out.push(...relatedNames(s.related));
    if (s.kind === 'if' || s.kind === 'for')
      for (const c of s.conditions) out.push(...conditionNames(c));
    for (const a of stepActions(s)) out.push(...actionNames(a));
  }
  return out;
}

function present(need: Need, o: AutomationOutline, webhooks?: ReadonlySet<string>): boolean {
  switch (need.kind) {
    case 'webhook':
      return !webhooks || webhooks.has(need.id);
    case 'column':
      return o.statuses.some((s) => s.status === need.id);
    case 'type':
      return o.types.some((t) => t.id === need.id);
    case 'field':
      return planHasField(o, need.id);
    case 'person':
      return personOf(o, need.id) !== undefined;
    case 'filter':
      return o.savedFilters.some((s) => `${s.tab}/${s.filter.id}` === need.id);
    case 'form':
      return o.formTabs.includes(need.id);
  }
}

// What the rule names that the plan lacks, a line each ("Column done is gone"). `webhooks`: the ids of the plan's
// webhooks, when the caller has them (absent, outgoing actions are not checked).
export function ruleNeeds(
  rule: AutomationRuleBody,
  outline: AutomationOutline,
  webhooks?: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const need of namesOf(rule)) {
    const key = `${need.kind}:${need.id}`;
    if (seen.has(key) || present(need, outline, webhooks)) continue;
    seen.add(key);
    out.push(`${WORDS[need.kind]} ${need.id} is gone`);
  }
  return out;
}
