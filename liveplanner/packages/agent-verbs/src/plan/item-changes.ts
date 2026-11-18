// Adding, changing, moving and deleting items by name (docs/specs/026-plan/plan-agents.md "Naming things as people
// do"): each change resolved against the plan (column names, card types, custom fields, people, item numbers) and
// written through the item store's routes, in order, each seeing the ones before it. A refusal stops the batch and
// says what was applied before it. Shared by the MCP's change_items and the CLI's item verbs.
import { ApiError, type ApiClient } from '@liveworkspace/api-client';
import type { ItemResponse } from '@liveplanner/api-schema';
import {
  assignedPeople,
  boardShowsType,
  cardTemplateFields,
  markdownFields,
  isRichFieldKey,
  richFieldOf,
  isItemPerson,
  itemStatus,
  itemSummary,
  cardRefOrKey,
  cardRefTitle,
  itemTitle,
  assistantPersonOf,
  itemAssistantOf,
  resolveFields,
  calculatedWritten,
  isFormulaField,
  isLookupField,
  resolveItem,
  resolveStatus,
  resolveType,
  templateOf,
  fieldKeyOf,
  missingRequiredFields,
  requiredCleared,
  requiredFieldsMessage,
  typeIn,
  blockingCycleOf,
  blockingIndexOf,
  blockingLoopMessage,
  doneStatusesOf,
  followingShifts,
  withTypeChangeFields,
  type BlockingChange,
  type CardTemplate,
  type Item,
  type ItemFields,
  type ItemTypeDef,
} from '@liveplanner/items';
import { apiRefusalOf, fieldNamer } from './api-refusal';
import {
  addedPictureIds,
  checkPictureGrants,
  isPictureKey,
  pictureValue,
  picturesText,
  splitPictureFields,
  type GrantedPictures,
  type PictureEdit,
} from './card-pictures';
import { itemsPath } from '../verbs/shared';
import type { PlanState } from './plan-state';
import { assistantOnce } from './assistant-caller';
import { handBackRefusal, isMe } from './hand-back';

export type ItemChange =
  | {
      op: 'add';
      // Optional with a template, which gives one (else its type's new-card title).
      title?: string;
      type?: string;
      status?: string;
      fields?: Readonly<Record<string, unknown>>;
      // A card template of its type, by name or id (docs/specs/026-plan/plan-agents.md "Card templates").
      template?: string;
    }
  | {
      op: 'set';
      item: string;
      fields?: Readonly<Record<string, unknown>>;
      clear?: readonly string[];
      type?: string;
      // Then move the cards that follow it that its new dates leave clashing (docs/specs/026-plan/plan-views.md
      // "Moving the cards that follow").
      moveFollowing?: boolean;
    }
  | { op: 'move'; item: string; status: string; before?: string }
  | { op: 'delete'; item: string }
  // Hands a card the calling assistant holds back to its person (plan-agents.md "Cards handed to an assistant").
  | { op: 'hand_back'; item: string };

interface ItemChangesResult {
  applied: string[];
  // The items as they stand after the changes, for a caller that answers them.
  touched: Item[];
  refusal?: { code: string; message: string };
}

class Stop extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// A required custom field left empty (docs/specs/026-plan/item-types.md "Required fields"), stopped before the api
// sees it so the refusal names the type and every field.
function requiredStop(type: ItemTypeDef, missing: readonly { label: string }[]): Stop {
  return new Stop(
    'field_required',
    `${requiredFieldsMessage(type, missing)}: give ${missing.length === 1 ? 'it' : 'them'} in fields, by name. ` +
      'list_items marks each required field (required: true).',
  );
}

// A Blocked By loop (docs/specs/026-plan/item-types.md "Blocked By"), stopped before the api sees it so the refusal
// names the chain it would close.
function loopStop(
  items: readonly Item[],
  types: readonly ItemTypeDef[],
  change: BlockingChange,
): void {
  const loop = blockingCycleOf(items, types, [change]);
  if (loop) throw new Stop('blocks_cycle', blockingLoopMessage(loop.chain, types));
}

function must<T extends object>(
  named: ({ ok: true } & T) | { ok: false; code: string; message: string },
): T {
  if (!named.ok) throw new Stop(named.code, named.message);
  return named;
}

// Where a card shows, as its line says it: "in In Progress", "(on no board)", or a warning when the boards with its
// column all leave its card type out, so a write never reads as done when no board shows the card.
function placeOf(item: Item, state: PlanState): string {
  const status = itemStatus(item);
  if (!status) return ' (on no board)';
  const column = state.plan.statuses.find((s) => s.status === status)?.name;
  if (!column) return ' (on no board)';
  const boards = state.plan.boards.filter(
    (b) => b.kind === 'board' && b.columns.some((c) => c.status === status),
  );
  const shown = boards.some((b) =>
    boardShowsType({ addTypes: b.types ?? undefined }, item.type, state.plan.types),
  );
  if (shown) return ` in ${column}`;
  const type = state.plan.types.find((t) => t.id === item.type)?.label ?? item.type;
  return (
    ` in ${column}, but no board with that column takes ${type} cards, so none shows it: ` +
    `add ${type} to ${boards.map((b) => `"${b.title}"`).join(' or ')} with change_board`
  );
}

// "#3 [task] Fix login in In Progress", then what a set changed and any note.
function line(prefix: string, item: Item, state: PlanState, notes: readonly string[] = []): string {
  return `${prefix} ${itemSummary(item, state.plan.types)}${placeOf(item, state)}${notes.map((n) => `; ${n}`).join('')}`;
}

// A note for an assignee given by a name nobody on the project has: a name only, not linked to an account.
function personNote(fields: Readonly<Record<string, unknown>>, items: readonly Item[]): string[] {
  const p = fields['assignee'];
  if (!isItemPerson(p) || !p.id.startsWith('n-')) return [];
  if (assignedPeople(items).some((x) => x.id === p.id)) return [];
  return [`${p.name} is a new name on this plan, not linked to anyone's account`];
}

// The card a value names, by id.
const byIdIn = (items: readonly Item[], v: unknown): Item | undefined =>
  items.find((i) => i.id === v);

// The most of a value a set line repeats.
const SET_VALUE_MAX = 40;

// A value as a set line reads it back: what was stored, so a value that landed other than meant shows ("Rating =
// ★"). A card link by its number, a person by name, a list by its length.
function storedText(value: unknown, items: readonly Item[], types: readonly ItemTypeDef[]): string {
  const refOf = (i: Item) => cardRefOrKey(i, types);
  if (isItemPerson(value)) return value.name;
  // A field that holds several (docs/specs/026-plan/item-types.md "Holds Several"): its people or cards, named.
  if (Array.isArray(value) && value.length > 0 && value.every(isItemPerson))
    return cut(value.map((p) => p.name).join(', '));
  if (Array.isArray(value) && value.length > 0 && value.every((v) => byIdIn(items, v)))
    return cut(value.map((v) => refOf(byIdIn(items, v)!)).join(', '));
  if (Array.isArray(value)) return `${value.length} entr${value.length === 1 ? 'y' : 'ies'}`;
  if (typeof value === 'string') {
    const linked = items.find((i) => i.id === value);
    if (linked) return refOf(linked);
    return JSON.stringify(cut(value.split('\n')[0]!));
  }
  // A number or flag as written; anything else as its JSON, cut.
  return cut(String(JSON.stringify(value)));
}

// A template's values a new card starts from, less those the change gives itself (and the formatting of a text it
// gives, so a description written over the template's never keeps the template's runs).
function startValues(
  type: ItemTypeDef,
  template: CardTemplate,
  given: Readonly<Record<string, unknown>>,
): ItemFields {
  const start = { ...cardTemplateFields(type, template) };
  for (const key of Object.keys(given)) {
    delete start[key];
    if (!isRichFieldKey(key)) delete start[richFieldOf(key)];
  }
  return start;
}

const cut = (text: string) =>
  text.length > SET_VALUE_MAX ? `${text.slice(0, SET_VALUE_MAX - 1)}…` : text;

function setNote(
  written: Readonly<Record<string, unknown>>,
  cleared: readonly string[],
  type: ItemTypeDef,
  items: readonly Item[],
  types: readonly ItemTypeDef[],
): string[] {
  const name = (key: string) => type.custom?.find((f) => f.id === key)?.label ?? key;
  // Formatting reads back as the field it belongs to.
  const set = Object.fromEntries(Object.entries(written).filter(([k]) => !isRichFieldKey(k)));
  const clear = cleared.filter((k) => !isRichFieldKey(k));
  const parts = [
    ...(Object.keys(set).length
      ? [
          `set ${Object.entries(set)
            .map(
              ([k, v]) =>
                `${name(k)} = ${isPictureKey(k, type) ? picturesText(v) : storedText(v, items, types)}`,
            )
            .join(', ')}`,
        ]
      : []),
    ...(clear.length ? [`cleared ${clear.map(name).join(', ')}`] : []),
  ];
  return parts.length ? [parts.join('; ')] : [];
}

export async function applyItemChanges(
  api: ApiClient,
  projectId: string,
  changes: readonly ItemChange[],
  state: PlanState,
): Promise<ItemChangesResult> {
  const base = itemsPath(projectId);
  const types = state.plan.types;
  let items = [...state.items];
  const applied: string[] = [];
  const touched = new Map<string, Item>();
  const keep = (item: Item) => {
    items = [...items.filter((i) => i.id !== item.id), item];
    touched.set(item.id, item);
  };
  const naming = () => ({ statuses: state.plan.statuses, items });
  // The card type of the change being made, so an api refusal names its field as that card shows it.
  let writing: ItemTypeDef | undefined;
  const post = (path: string, body: unknown) =>
    api.json<ItemResponse>(path, { method: 'POST', body: JSON.stringify(body) });
  // A Calculated field is worked out, never given (docs/specs/026-plan/item-types.md "Calculated fields"): refused
  // before the write, by name. A field that holds several given [], null or "" comes back in `clear`
  // (docs/specs/026-plan/plan-agents.md "Clearing a field").
  const fieldsFor = (input: Readonly<Record<string, unknown>>, type: ItemTypeDef) => {
    const { fields, clear = [] } = must(resolveFields(input, type, naming()));
    const calculated = calculatedWritten([type], { type: type.id, fields: fields as ItemFields });
    if (calculated) {
      // calculatedWritten names only a field the type has.
      const field = type.custom!.find((f) => f.id === calculated)!;
      const from = isFormulaField(field)
        ? 'by its formula'
        : isLookupField(field)
          ? 'from the card it links to'
          : 'from the cards linking here';
      throw new Stop(
        'field_calculated',
        `${field.label} is calculated: it can't be set. list_items lists its value, worked out ${from}.`,
      );
    }
    return { fields, clear };
  };
  // Pictures (docs/specs/015-api/mcp-server.md §4.5b): the ids each change adds, checked against the plan's grants,
  // then the field's new value from the card as read. `granted` keeps every answer for the call.
  const granted: GrantedPictures = new Map();
  const placePictures = async (
    pictures: ReadonlyMap<string, PictureEdit>,
    type: ItemTypeDef,
    had: Readonly<Record<string, unknown>>,
  ) => {
    const set: Record<string, unknown> = {};
    const clear: string[] = [];
    if (pictures.size === 0) return { set, clear };
    must(await checkPictureGrants(api, projectId, addedPictureIds(pictures), granted));
    for (const [key, edit] of pictures) {
      const { value } = must(pictureValue(key, type, edit, had, granted));
      if (value === undefined) clear.push(key);
      else set[key] = value;
    }
    return { set, clear };
  };
  // The cards that follow `moved` that its dates leave clashing, each moved just after its open blockers, in the walk's
  // order, a line each; written through the item route, so the api's edit rights apply to every one.
  const moveFollowing = async (moved: Item) => {
    const isDone = doneStatusesOf(state.plan.boards);
    const index = blockingIndexOf(items, types, isDone);
    const shifts = followingShifts(index, (i) => isDone(itemStatus(i)), [moved.id]);
    const after = cardRefTitle(moved, itemTitle(moved), types);
    for (const s of shifts) {
      writing = typeIn(types, s.item.type);
      const { item } = await post(`${base}/${encodeURIComponent(s.item.id)}`, { set: s.set });
      keep(item);
      applied.push(
        line('~', item, state, [
          `moved ${s.days} ${s.days === 1 ? 'day' : 'days'} later, after ${after}`,
        ]),
      );
    }
  };
  // The card type a change writes, when it can be read before any change is made.
  const typeBefore = (c: Extract<ItemChange, { op: 'add' | 'set' }>): ItemTypeDef | null => {
    if (c.op === 'add') {
      const t = resolveType(c.type ?? 'task', types);
      return t.ok ? t.type : null;
    }
    if (c.type) {
      const t = resolveType(c.type, types);
      return t.ok ? t.type : null;
    }
    const target = resolveItem(c.item, items);
    return target.ok ? typeIn(types, target.item.type) : null;
  };
  // The calling assistant, read only when a change hands a card to "me" or back (plan-agents.md "Cards handed to an
  // assistant").
  const caller = assistantOnce(api, () => items);
  const me = async () => {
    const read = await caller();
    if (!read.ok) throw new Stop(read.code, read.message);
    return read.assistant;
  };
  // A change's fields with an Assignee of "me" made the calling assistant.
  const withMe = async (
    fields: Readonly<Record<string, unknown>> | undefined,
    type: ItemTypeDef,
  ): Promise<Readonly<Record<string, unknown>> | undefined> => {
    if (!fields) return fields;
    const key = Object.keys(fields).find(
      (k) =>
        isMe(fields[k]) && fieldKeyOf(k, type).ok && must(fieldKeyOf(k, type)).key === 'assignee',
    );
    return key === undefined ? fields : { ...fields, [key]: await me() };
  };
  try {
    // Every picture the call adds is checked in one request before any card is written; a change whose card is made
    // earlier in the call is checked when it comes.
    const early: string[] = [];
    for (const c of changes) {
      if (c.op !== 'add' && c.op !== 'set') continue;
      const type = c.fields ? typeBefore(c) : null;
      const split = type ? splitPictureFields(c.fields, type) : null;
      if (split?.ok) early.push(...addedPictureIds(split.pictures));
    }
    if (early.length) must(await checkPictureGrants(api, projectId, early, granted));
    for (const c of changes) {
      if (c.op === 'add') {
        const type = must(resolveType(c.type ?? 'task', types)).type;
        writing = type;
        const template = c.template ? must(templateOf(type, c.template, types)).template : null;
        if (!c.title && !template)
          throw new Stop(
            'value_invalid',
            'A new card needs a title, or a template to take one from.',
          );
        const pictures = must(splitPictureFields(await withMe(c.fields, type), type));
        // A new card has nothing to clear: an empty value leaves the field unset.
        const given = {
          ...markdownFields(fieldsFor(pictures.rest, type).fields, type).set,
          ...(await placePictures(pictures.pictures, type, {})).set,
        };
        // The template's values under the change's own, field by field (plan-agents.md "Card templates").
        const fields = template ? { ...startValues(type, template, given), ...given } : given;
        const title =
          c.title ??
          (typeof fields['title'] === 'string' && fields['title']
            ? fields['title']
            : type.newTitle);
        const status = c.status
          ? must(resolveStatus(c.status, state.plan.statuses)).status
          : undefined;
        const missing = missingRequiredFields(type, fields as ItemFields);
        if (missing.length) throw requiredStop(type, missing);
        loopStop(items, types, {
          next: { id: '', type: type.id, fields: { ...fields, title } },
        });
        const { item } = await post(base, {
          type: type.id,
          fields: { ...fields, title },
          ...(status ? { place: { status } } : {}),
        });
        const notes = personNote(fields, items);
        keep(item);
        applied.push(line('+', item, state, notes));
      } else if (c.op === 'set') {
        const target = must(resolveItem(c.item, items)).item;
        const type = c.type ? must(resolveType(c.type, types)).type : typeIn(types, target.type);
        writing = type;
        const pictures = must(splitPictureFields(await withMe(c.fields, type), type));
        const placed = await placePictures(pictures.pictures, type, target.fields);
        const given = fieldsFor(pictures.rest, type);
        given.clear = [...given.clear, ...placed.clear];
        const described = markdownFields({ ...given.fields, ...placed.set }, type, target.fields);
        let set = described.set;
        // A value a removed field left on the card is cleared by its key, though the type no longer has it.
        const named = [
          ...new Set([
            ...(c.clear ?? []).map((k) =>
              k in target.fields && !fieldKeyOf(k, type).ok ? k : must(fieldKeyOf(k, type)).key,
            ),
            ...given.clear,
          ]),
        ];
        // Clearing the description, or a Long Text field, clears its formatting with it.
        const clear = [
          ...named,
          ...described.clear,
          ...named.map(richFieldOf).filter((k) => isRichFieldKey(k) && k in target.fields),
        ];
        // A new type takes the card's custom fields mapped by name, never over a field this change gives
        // (docs/specs/026-plan/item-types.md "Changing a card's type").
        if (c.type)
          set = withTypeChangeFields(
            target,
            { set: set as ItemFields, clear, type: type.id },
            types,
          ).set!;
        const after: Record<string, (typeof target.fields)[string]> = {
          ...target.fields,
          ...(set as typeof target.fields),
        };
        for (const k of clear) delete after[k];
        const emptied = requiredCleared(type, target.fields, after);
        if (emptied)
          throw new Stop(
            'field_required',
            `${emptied.label} is required on ${type.label} cards: it can be changed, not emptied.`,
          );
        loopStop(items, types, {
          before: target,
          next: { ...target, type: type.id, fields: after },
        });
        const { item } = await post(`${base}/${encodeURIComponent(target.id)}`, {
          ...(Object.keys(set).length ? { set } : {}),
          ...(clear.length ? { clear } : {}),
          ...(c.type ? { type: type.id } : {}),
        });
        const notes = [...setNote(set, clear, type, items, types), ...personNote(set, items)];
        keep(item);
        applied.push(line('~', item, state, notes));
        if (c.moveFollowing) await moveFollowing(item);
      } else if (c.op === 'move') {
        const target = must(resolveItem(c.item, items)).item;
        const status = must(resolveStatus(c.status, state.plan.statuses)).status;
        const before = c.before ? must(resolveItem(c.before, items)).item.id : null;
        const { item } = await post(`${base}/${encodeURIComponent(target.id)}/move`, {
          status,
          before,
        });
        keep(item);
        applied.push(line('→', item, state));
      } else if (c.op === 'hand_back') {
        const target = must(resolveItem(c.item, items)).item;
        writing = typeIn(types, target.type);
        const mine = await me();
        const held = itemAssistantOf(target);
        if (held?.id !== mine.id) {
          const refused = handBackRefusal(target, mine);
          throw new Stop(refused.code, refused.message);
        }
        const person = assistantPersonOf(held);
        const { item } = await post(`${base}/${encodeURIComponent(target.id)}`, {
          set: { assignee: person },
        });
        keep(item);
        applied.push(line('~', item, state, [`handed back to ${person.name}`]));
      } else {
        const target = must(resolveItem(c.item, items)).item;
        const res = await api.fetch(`${base}/${encodeURIComponent(target.id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new ApiError(res.status, await res.text());
        items = items.filter((i) => i.id !== target.id);
        touched.delete(target.id);
        applied.push(`- ${itemSummary(target, types)}`);
      }
    }
  } catch (err) {
    const refusal =
      err instanceof Stop
        ? { code: err.code, message: err.message }
        : apiRefusalOf(
            err,
            fieldNamer(types, () => writing),
          );
    // An api failure after some changes landed still says which: a retry of the whole batch would
    // otherwise make them twice. Before any landed, it is thrown as ever.
    if (!refusal && applied.length === 0) throw err;
    return {
      applied,
      touched: [...touched.values()],
      refusal: refusal ?? {
        code: 'api_error',
        message: 'The api failed part way; the changes after these were not made.',
      },
    };
  }
  return { applied, touched: [...touched.values()] };
}
