// A rule body as an agent or a drafted rule writes it, named as the board shows things
// (docs/specs/026-plan/automations.md "Agents and the CLI", "Describe a Rule"): a column by name, a card type, a field,
// a person or a tab by name, each put back to the id the api stores. An id is kept, and so is a name the plan lacks
// (the rule saves and needs attention). Pure; readRuleBody is the one check of what reads.
import { BUILT_IN_FIELD_NAMES } from '../built-in-field-labels';
import type { ItemFieldId, ItemTypeDef } from '../item-types';
import { statusKey } from '../status-names';
import { isBuiltInFieldId } from '../type-catalogue';
import { fieldOfName } from './outline';

/** What a rule may name, by id and by the name a board shows. */
export interface RuleNames {
  statuses: readonly { status: string; name: string }[];
  types: readonly ItemTypeDef[];
  people: readonly { id: string; name: string }[];
  tabs: readonly { id: string; name: string }[];
}

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
function fieldNamer(names: RuleNames): Namer {
  const types = names.types;
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

function namersOf(names: RuleNames): Namers {
  return {
    status: namer(
      names.statuses,
      (s) => s.status,
      (s) => s.name,
    ),
    type: namer(
      names.types,
      (t) => t.id,
      (t) => t.label,
    ),
    field: fieldNamer(names),
    person: namer(
      names.people,
      (p) => p.id,
      (p) => p.name,
    ),
    tab: namer(
      names.tabs,
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
  if (s['kind'] === 'set_type') name(s, 'type', n.type);
  // A Card field to link through, a field to set or clear, or an AI summary's text field.
  if (['set_field', 'clear_field', 'link_card', 'ai'].includes(s['kind'] as string))
    name(s, 'field', n.field);
  if (s['kind'] === 'set_field' && isObject(s['value'])) name(s['value'], 'from', n.field);
  if (s['kind'] === 'assign' || s['kind'] === 'email' || s['kind'] === 'mention')
    namePeople(s['to'], n);
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
export function namedRuleBody<T>(body: T, names: RuleNames): T {
  return ruleWithRefs(body, namersOf(names));
}

const same: Namer = (ref) => ref;

/** What a rule refers to, by kind: a column (status), a card type, a field, a person or a tab. */
export type RuleRefKind = keyof Namers;

/** `body` with every ref of a kind put through its map (a kind the maps lack kept as it is): the one walk under
 *  namedRuleBody's naming, a copy's new tab ids and Describe a Plan's renames. A copy, the input untouched. */
export function ruleWithRefs<T>(
  body: T,
  maps: Partial<Record<RuleRefKind, (ref: string) => string>>,
): T {
  if (!isObject(body)) return body;
  const out = structuredClone(body) as Json;
  const n: Namers = {
    status: maps.status ?? same,
    type: maps.type ?? same,
    field: maps.field ?? same,
    person: maps.person ?? same,
    tab: maps.tab ?? same,
  };
  if (isObject(out['trigger'])) nameTrigger(out['trigger'], n);
  nameAll(out['conditions'], (c) => nameCondition(c, n));
  nameAll(out['steps'], (s) => nameStep(s, n));
  return out as T;
}

/** `body` with the tabs it names (a Form Response's Form tab, a saved filter's board tab) put through `tabIds`, as a
 *  plan's copy or file gives its tabs new ids; a tab the map lacks is kept. A copy, the input untouched. */
export function ruleWithTabIds<T>(body: T, tabIds: ReadonlyMap<string, string>): T {
  return ruleWithRefs(body, { tab: (ref) => tabIds.get(ref) ?? ref });
}
