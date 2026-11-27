// Plan AI's changes to a board (docs/specs/026-plan/plan-ai.md "On a board"): change_items's add, set, move and delete,
// each named as an agent names it (plan-agents.md "Naming things as people do") and resolved against the board and the
// cards as they are, then made through the editor's own card writes: the new cards as one write, the moves as one, the
// changes as one and the Trash as one, each one undo step. The first change that can't be made stops the rest and says
// why; the ones before it are made. Pure but for `actions`.
import {
  boardAddTypes,
  isTrashed,
  itemTitle,
  missingRequiredFields,
  requiredFieldsMessage,
  resolveFields,
  resolveItem,
  resolveStatus,
  resolveType,
  typeAllowsStatus,
  typeIn,
  validateFields,
  cardRefOrKey,
  type Item,
  type ItemCreate,
  type ItemFields,
  type ItemMoveOf,
  type ItemPatchOf,
  type ItemTypeDef,
  type PlanAiChange,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { forPeople, type PlanAiApplied, type PlanAiLine } from './plan-ai-lines';

export type BoardActions = {
  addItems?: ((creates: readonly ItemCreate[]) => Promise<boolean>) | undefined;
  moveItems?: ((moves: readonly ItemMoveOf[]) => void) | undefined;
  patchItems?: ((patches: readonly ItemPatchOf[]) => void) | undefined;
  trashItems: (itemIds: readonly string[]) => number;
};

class Stop extends Error {}

const must = <T extends { ok: boolean; message?: string }>(named: T): Extract<T, { ok: true }> => {
  if (!named.ok) throw new Stop(named.message ?? 'That couldn’t be read.');
  return named as Extract<T, { ok: true }>;
};

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

// A name the model gave, as text (a number names a card too).
const text = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';

const fieldsIn = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

// A value its field refused, named by the field's label where it has one.
const unfit = (type: ItemTypeDef, field: string | undefined): string => {
  const label = type.custom?.find((f) => f.id === field)?.label ?? field;
  return label ? `That value doesn’t fit the field “${label}”.` : 'A value doesn’t fit its field.';
};

/** Resolves `changes` against the board and its cards, then makes them through `actions`. */
export async function applyBoardChanges(input: {
  setup: PlanBoardSetup;
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  changes: readonly PlanAiChange[];
  actions: BoardActions;
}): Promise<PlanAiApplied> {
  const { setup, types, changes, actions } = input;
  const live = [...input.items.values()].filter((i) => !isTrashed(i));
  const statuses = setup.columns.map((c) => ({ status: c.status, name: c.name }));
  const naming = { statuses, items: live };
  const taken = boardAddTypes(setup, types);
  const creates: ItemCreate[] = [];
  const moves: ItemMoveOf[] = [];
  const patches: ItemPatchOf[] = [];
  const trashed: string[] = [];
  const lines: PlanAiLine[] = [];
  const refOf = (item: Item) => `${cardRefOrKey(item, types)} ${itemTitle(item)}`.trim();

  const resolve = (c: PlanAiChange): string => {
    switch (c.op) {
      case 'add': {
        const named = str(c['type']);
        const type = named ? must(resolveType(named, taken)).type : taken[0];
        if (!type) throw new Stop('This board takes no card type yet: add one in Card Types.');
        const wanted = str(c['status']);
        const status = wanted
          ? must(resolveStatus(wanted, statuses)).status
          : (setup.columns.find((col) => typeAllowsStatus(type, col.status))?.status ??
            setup.columns[0]?.status);
        if (!status) throw new Stop('This board has no column to put a card in.');
        const { fields } = must(resolveFields(fieldsIn(c['fields']), type, naming));
        const title = str(c['title']) ?? str(fields['title']) ?? type.newTitle ?? 'New card';
        const all: ItemFields = { ...(fields as ItemFields), title };
        const valid = validateFields(all, 'create');
        if (!valid.ok) throw new Stop(unfit(type, valid.field));
        const missing = missingRequiredFields(type, valid.fields);
        if (missing.length) throw new Stop(`${requiredFieldsMessage(type, missing)}.`);
        creates.push({ type: type.id, fields: valid.fields, place: { status } });
        return `Added “${title}”`;
      }
      case 'set': {
        const { item } = must(resolveItem(text(c['item']), live));
        const type = typeIn(types, item.type);
        const { fields, clear = [] } = must(resolveFields(fieldsIn(c['fields']), type, naming));
        const cleared = Array.isArray(c['clear'])
          ? c['clear'].flatMap((name) => {
              const key = Object.keys(
                must(resolveFields({ [String(name)]: null }, type, naming)).fields,
              );
              return key.length ? key : [];
            })
          : [];
        const set = fields as ItemFields;
        const valid = validateFields(set, 'patch');
        if (!valid.ok) throw new Stop(unfit(type, valid.field));
        patches.push({
          id: item.id,
          patch: {
            ...(Object.keys(valid.fields).length ? { set: valid.fields } : {}),
            ...(clear.length + cleared.length ? { clear: [...clear, ...cleared] } : {}),
          },
        });
        return `Changed ${refOf(item)}`;
      }
      case 'move': {
        const { item } = must(resolveItem(text(c['item']), live));
        const { status, name } = must(resolveStatus(text(c['status']), statuses));
        moves.push({ id: item.id, move: { status } });
        return `Moved ${refOf(item)} to ${name}`;
      }
      case 'delete': {
        const { item } = must(resolveItem(text(c['item']), live));
        trashed.push(item.id);
        return `Put ${refOf(item)} in the Trash`;
      }
      default:
        throw new Stop(`A board can’t take “${c.op}”.`);
    }
  };

  for (const change of changes) {
    try {
      lines.push({ text: resolve(change), ok: true });
    } catch (e) {
      if (!(e instanceof Stop)) throw e;
      lines.push({ text: forPeople(e.message), ok: false });
      break;
    }
  }

  let steps = 0;
  if (creates.length && actions.addItems) {
    const made = await actions.addItems(creates);
    if (made) steps++;
    else lines.push({ text: 'The new cards couldn’t be made.', ok: false });
  }
  if (moves.length && actions.moveItems) {
    actions.moveItems(moves);
    steps++;
  }
  if (patches.length && actions.patchItems) {
    actions.patchItems(patches);
    steps++;
  }
  if (trashed.length && actions.trashItems(trashed) > 0) steps++;
  return { lines, steps };
}
