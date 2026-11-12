// A rule body as an agent writes it, named as the board shows things (docs/specs/026-plan/automations.md "Agents and
// the CLI", "The rule body"): a column by name, a card type, a field, a person or a Form tab by name, each put back to
// the id the api stores. An id is kept, and so is a name the plan lacks (the rule saves and needs attention). Pure;
// the api's readRuleBody is the one check of what reads.
import {
  BUILT_IN_FIELD_NAMES,
  fieldOfName,
  isBuiltInFieldId,
  statusKey,
  type ItemFieldId,
} from '@liveplanner/items';
import type { RulesState } from './rule-state';

type Json = Record<string, unknown>;
type Namer = (ref: string) => string;

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// The first id `named` matches by id, else by name (case and spacing aside), else the ref as given.
function namer<T>(all: readonly T[], id: (t: T) => string, name: (t: T) => string): Namer {
  return (ref) => {
    if (all.some((t) => id(t) === ref)) return ref;
    const key = statusKey(ref);
    const found = all.find((t) => statusKey(name(t)) === key);
    return found ? id(found) : ref;
  };
}

// Every field of every card type, and the built-ins, by id and by the names a board shows.
function fieldNamer(state: RulesState): Namer {
  const types = state.plan.types;
  const known = (ref: string) =>
    ['title', 'status', 'flagged', 'archived'].includes(ref) ||
    isBuiltInFieldId(ref) ||
    types.some((t) => t.custom?.some((f) => f.id === ref));
  const builtIn = namer(
    Object.entries(BUILT_IN_FIELD_NAMES) as [ItemFieldId, string][],
    ([id]) => id,
    ([, name]) => name,
  );
  return (ref) => {
    if (known(ref)) return ref;
    for (const type of types) {
      const id = fieldOfName(type, ref);
      if (id) return id;
    }
    return builtIn(ref);
  };
}

type Namers = { status: Namer; type: Namer; field: Namer; person: Namer; tab: Namer };

function namersOf(state: RulesState): Namers {
  return {
    status: namer(
      state.plan.statuses,
      (s) => s.status,
      (s) => s.name,
    ),
    type: namer(
      state.plan.types,
      (t) => t.id,
      (t) => t.label,
    ),
    field: fieldNamer(state),
    person: namer(
      state.list.people ?? [],
      (p) => p.id,
      (p) => p.name,
    ),
    tab: namer(
      state.plan.tabs ?? [],
      (t) => t.id,
      (t) => t.name,
    ),
  };
}

// `o[key]` named, when it is a string, or each of a list of strings; anything else is left for the api to refuse.
function name(o: Json, key: string, by: Namer): void {
  const v = o[key];
  if (typeof v === 'string') o[key] = by(v);
  else if (Array.isArray(v)) o[key] = v.map((x: unknown) => (typeof x === 'string' ? by(x) : x));
}

function nameTrigger(t: Json, n: Namers): void {
  for (const key of ['status', 'from', 'to', 'statuses']) name(t, key, n.status);
  name(t, 'people', n.person);
  name(t, 'fields', n.field);
  name(t, 'formTab', n.tab);
}

function nameCondition(c: Json, n: Namers): void {
  if (c['kind'] === 'type') name(c, 'types', n.type);
  if (c['kind'] === 'column') name(c, 'statuses', n.status);
  if (c['kind'] === 'field') name(c, 'field', n.field);
  if (c['kind'] === 'saved_filter') name(c, 'tab', n.tab);
  if (c['kind'] === 'who' && Array.isArray(c['who']))
    for (const w of c['who']) if (isObject(w)) name(w, 'person', n.person);
}

// A person an assignee or a recipient names (`{ person }`, or people in turn).
function namePeople(to: unknown, n: Namers): void {
  if (!isObject(to)) return;
  name(to, 'person', n.person);
  name(to, 'rotate', n.person);
}

function nameStep(s: Json, n: Namers): void {
  name(s, 'status', n.status);
  if (s['kind'] === 'create_card') {
    name(s, 'type', n.type);
    name(s, 'linkField', n.field);
  }
  if (s['kind'] === 'set_field' || s['kind'] === 'clear_field') name(s, 'field', n.field);
  if (s['kind'] === 'set_field' && isObject(s['value'])) name(s['value'], 'from', n.field);
  if (s['kind'] === 'assign' || s['kind'] === 'email') namePeople(s['to'], n);
  if (s['kind'] === 'if' || s['kind'] === 'for') {
    nameAll(s['conditions'], (c) => nameCondition(c, n));
    nameAll(s['then'], (a) => nameStep(a, n));
    nameAll(s['else'], (a) => nameStep(a, n));
  }
  if (s['kind'] === 'for' && isObject(s['related'])) {
    name(s['related'], 'field', n.field);
    name(s['related'], 'tab', n.tab);
  }
}

function nameAll(list: unknown, each: (o: Json) => void): void {
  if (Array.isArray(list)) for (const o of list) if (isObject(o)) each(o);
}

/** `body` with what it names by name put back to the plan's ids; a copy, the input untouched. */
export function namedRuleBody<T>(body: T, state: RulesState): T {
  if (!isObject(body)) return body;
  const out = structuredClone(body) as Json;
  const n = namersOf(state);
  if (isObject(out['trigger'])) nameTrigger(out['trigger'], n);
  nameAll(out['conditions'], (c) => nameCondition(c, n));
  nameAll(out['steps'], (s) => nameStep(s, n));
  return out as T;
}
