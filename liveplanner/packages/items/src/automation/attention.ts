// Automations: what a rule names that the plan lacks (docs/specs/026-plan/automations.md "Conditions", "Copies,
// exports and deletes"; blueprint automations.md "Files"). A card type, column, field, person, saved filter, Form tab
// or Link Cards' chosen card gone since the rule was written (or never in a copy): the Rules list marks the rule Needs Attention with these
// lines. Each thing is said once, in the order the rule names it. The plan's webhooks live in the index, not the plan:
// a caller that has them (the builder) passes their ids, and one an outgoing action names that is gone needs
// attention too. So does a GitHub-triggered rule on a plan not connected to GitHub, or one naming repositories none of
// which the plan's connection still hears, when the caller knows the connection. Pure.

import type {
  AutomationAction,
  AutomationAi,
  AutomationCondition,
  AutomationGone,
  AutomationOutgoing,
  AutomationRelated,
  AutomationRuleBody,
} from './types';
import { isGithubTrigger } from './types';
import { stepActions } from './validate';
import { fieldKind, goneLine, personNamed } from './set-value';
import {
  fieldDefOf,
  personOf,
  planHasField,
  unheardFields,
  type AutomationOutline,
} from './outline';

type Need = {
  kind: 'column' | 'type' | 'field' | 'person' | 'filter' | 'form' | 'webhook' | 'card';
  id: string;
};

// One thing a rule needs, as data: something it names that is gone (by kind and stored id), or a field Field Changed
// can never hear (by the plan's name). The editor words these without ids; ruleNeeds words them for agents.
// `github`: a GitHub-triggered rule on a plan not connected to GitHub, which hears nothing until it connects.
// `repositories`: a GitHub trigger whose named repositories have all left the connection (as the rule names them).
export type AutomationNeed =
  | Need
  | { kind: 'unheard'; name: string }
  | { kind: 'github' }
  | { kind: 'repositories'; names: string[] };

// What the kinds a run never fails on read as (the rest read as a failed step's line does, goneLine).
const WORDS: Readonly<Record<Exclude<Need['kind'], AutomationGone['kind']>, string>> = {
  form: 'Form tab',
  webhook: 'Webhook',
  card: 'Card',
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

// The person a Set Field on a Person field (the Assignee too) picked: one its text names by id or name is there, any
// other picked text is someone gone (by that text); a value filled in names whoever the card holds.
function setPersonNames(
  a: Extract<AutomationAction, { kind: 'set_field' }>,
  o: AutomationOutline,
): Need[] {
  if (!('text' in a.value) || fieldKind(a.field, fieldDefOf(o, a.field)) !== 'person') return [];
  const text = a.value.text.trim();
  if (!text || text.includes('{{')) return [];
  return [{ kind: 'person', id: personNamed(o.people, text)?.id ?? text }];
}

function actionNames(
  a: AutomationAction | AutomationOutgoing | AutomationAi,
  o: AutomationOutline,
): Need[] {
  switch (a.kind) {
    case 'ai':
      return a.task === 'summarise' && a.field ? [{ kind: 'field', id: a.field }] : [];
    case 'move':
      return [{ kind: 'column', id: a.status }];
    case 'set_field':
      return [
        { kind: 'field', id: a.field },
        ...('from' in a.value ? [{ kind: 'field' as const, id: a.value.from }] : []),
        ...setPersonNames(a, o),
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
    case 'mention':
      return 'person' in a.to ? [{ kind: 'person', id: a.to.person }] : [];
    case 'set_type':
      return [{ kind: 'type', id: a.type }];
    case 'copy_card':
      return a.status ? [{ kind: 'column', id: a.status }] : [];
    case 'link_card':
      return [
        { kind: 'field', id: a.field },
        ...('card' in a.to ? [{ kind: 'card' as const, id: a.to.card }] : []),
      ];
    default:
      return [];
  }
}

function relatedNames(r: AutomationRelated): Need[] {
  if (r.kind === 'saved_filter') return [{ kind: 'filter', id: `${r.tab}/${r.filter}` }];
  return r.kind === 'linked' && r.field ? [{ kind: 'field', id: r.field }] : [];
}

function namesOf(rule: AutomationRuleBody, o: AutomationOutline): Need[] {
  const t = rule.trigger;
  const out: Need[] = [];
  if (t.kind === 'card_created' && t.status) out.push({ kind: 'column', id: t.status });
  if (t.kind === 'form_response' && t.formTab) out.push({ kind: 'form', id: t.formTab });
  if (t.kind === 'card_moved') {
    for (const id of t.types ?? []) out.push({ kind: 'type', id });
    for (const id of [...(t.from ?? []), ...(t.to ?? [])]) out.push({ kind: 'column', id });
  }
  if (t.kind === 'field_changed') for (const id of t.fields) out.push({ kind: 'field', id });
  if (t.kind === 'column_limit') out.push({ kind: 'column', id: t.status });
  if (t.kind === 'stuck') for (const id of t.statuses ?? []) out.push({ kind: 'column', id });
  if (t.kind === 'mentioned') for (const id of t.people ?? []) out.push({ kind: 'person', id });
  for (const c of rule.conditions) out.push(...conditionNames(c));
  for (const s of rule.steps) {
    if (s.kind === 'for') out.push(...relatedNames(s.related));
    if (s.kind === 'if' || s.kind === 'for')
      for (const c of s.conditions) out.push(...conditionNames(c));
    for (const a of stepActions(s)) out.push(...actionNames(a, o));
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
    case 'card':
      return !o.cards || o.cards.has(need.id);
  }
}

// A GitHub trigger's named repositories when none of them is among `heard` (any case), else none.
function goneRepositories(rule: AutomationRuleBody, heard: readonly string[]): string[] {
  const t = rule.trigger;
  const named = isGithubTrigger(t) ? (t.repositories ?? []) : [];
  if (named.length === 0) return [];
  const keys = new Set(heard.map((h) => h.toLowerCase()));
  return named.some((n) => keys.has(n.toLowerCase())) ? [] : [...named];
}

// What the rule names that the plan lacks, in the order it names them, each once. `webhooks`: the ids of the plan's
// webhooks, when the caller has them (absent, outgoing actions are not checked). `github`: the plan's connection,
// when the caller knows it: `false` for none, else the names of the repositories it hears (absent, a GitHub trigger
// is not checked).
export function ruleNeedItems(
  rule: AutomationRuleBody,
  outline: AutomationOutline,
  webhooks?: ReadonlySet<string>,
  github?: readonly string[] | false,
): AutomationNeed[] {
  const seen = new Set<string>();
  const out: AutomationNeed[] = [];
  if (github === false && isGithubTrigger(rule.trigger)) out.push({ kind: 'github' });
  if (github) {
    const names = goneRepositories(rule, github);
    if (names.length) out.push({ kind: 'repositories', names });
  }
  for (const need of namesOf(rule, outline)) {
    const key = `${need.kind}:${need.id}`;
    if (seen.has(key) || present(need, outline, webhooks)) continue;
    seen.add(key);
    out.push(need);
  }
  // A field Field Changed can never hear (a rule saved before it became one, a field made Time Spent since).
  if (rule.trigger.kind === 'field_changed')
    for (const f of unheardFields(outline.types, rule.trigger.fields))
      out.push({ kind: 'unheard', name: f.name });
  return out;
}

/** A need as agents read it, by its stored id: "Column done is gone", "Field Changed never hears Time Spent". */
export const needLine = (need: AutomationNeed): string =>
  need.kind === 'github'
    ? 'GitHub is not connected'
    : need.kind === 'repositories'
      ? need.names.length === 1
        ? `Repository ${need.names[0]!} is not heard`
        : `Repositories ${need.names.join(', ')} are not heard`
      : need.kind === 'unheard'
        ? `Field Changed never hears ${need.name}`
        : need.kind === 'form' || need.kind === 'webhook' || need.kind === 'card'
          ? `${WORDS[need.kind]} ${need.id} is gone`
          : goneLine({ kind: need.kind, id: need.id });

// What the rule names that the plan lacks, a line each ("Column done is gone"), for agents.
export function ruleNeeds(
  rule: AutomationRuleBody,
  outline: AutomationOutline,
  webhooks?: ReadonlySet<string>,
): string[] {
  return ruleNeedItems(rule, outline, webhooks).map(needLine);
}
