// Make Plan Cards' writes (liveworkspace/docs/specs/004-index/diagrams-and-plans.md "The doors"; livediagram's
// make-plan-cards.md): what each card a diagram's shape makes or updates holds, worked out before anything is written.
// New cards land in the column the shape's lane names (else the one picked); an updated card keeps its column, since
// the plan decides where work stands, and has its title, Start, Due and labels refreshed. Arrows become Blocked By
// links on each card's first Blocked By field; a board type without one gains one (`addField`). A link that would close
// a loop is left out and counted, the first drawn kept. Pure: the door mints ids, makes and writes the cards.
import type { Item, ItemFields } from './item';
import { itemLabels } from './item';
import type { CustomFieldDef, ItemTypeDef } from './item-types';
import { blockerIdsOf, blocksFieldsOf } from './blocked-by';
import { isArchived, isTrashed } from './board-model';
import { typeIn } from './type-catalogue';
import { FIELD_VALUES_MAX } from './limits';
import { holdsSeveral } from './several-values';

export const PLAN_MAKE_BLOCKS_FIELD_ID = 'f-blocked-by';
const LABELS_MAX = 12;

/** The field a board type gains when a made card waits on another and the type offers no Blocked By field. */
export function madeBlocksField(typeId: string): CustomFieldDef {
  return {
    id: PLAN_MAKE_BLOCKS_FIELD_ID,
    label: 'Blocked By',
    kind: 'card',
    linkType: typeId,
    blocks: true,
    multiple: true,
  };
}

/** The type with the field added (in its field list, after the rest), unchanged when it already offers one. */
export function withBlocksField(type: ItemTypeDef): ItemTypeDef {
  if (blocksFieldsOf(type).length > 0) return type;
  let id = PLAN_MAKE_BLOCKS_FIELD_ID;
  for (let n = 2; type.custom?.some((c) => c.id === id); n++)
    id = `${PLAN_MAKE_BLOCKS_FIELD_ID}-${n}`;
  return {
    ...type,
    fields: [...type.fields, id],
    custom: [...(type.custom ?? []), { ...madeBlocksField(type.id), id }],
  };
}

export type PlanMakeCardInput = {
  element: string;
  // Its id: a live card's (updated) or one the door minted (made).
  id: string;
  made: boolean;
  title: string;
  description: string;
  column?: string;
  labels?: string[];
  start?: string;
  due?: string;
  blockedBy?: string[];
  // The fields a made card starts with besides these (its Sent From).
  extra?: ItemFields;
};

export type PlanMakeInput = {
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  // The board's columns, in order, and the column picked.
  columns: readonly { status: string; name: string }[];
  column: string;
  // The board's card type: what a made card is.
  type: string;
  cards: readonly PlanMakeCardInput[];
};

export type PlanMakeCardOutput = {
  element: string;
  id: string;
  made: boolean;
  // A made card's status; an updated one's stays.
  status?: string;
  fields: ItemFields;
};

export type PlanMakeOutput = {
  // The board type with a Blocked By field added, when it needed one.
  type: ItemTypeDef | null;
  cards: PlanMakeCardOutput[];
  // Links left out: they would close a loop, or the card's type has no Blocked By field.
  skipped: number;
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const live = (it: Item | undefined): it is Item => !!it && !isTrashed(it) && !isArchived(it);

export function planMake(input: PlanMakeInput): PlanMakeOutput {
  const { items, columns, cards } = input;
  const boardType = input.types.find((t) => t.id === input.type);
  const anyLinks = cards.some((c) => (c.blockedBy?.length ?? 0) > 0);
  // The board type gains a Blocked By field only when a card of it will wait on another.
  const needsField =
    anyLinks && !!boardType && blocksFieldsOf(boardType).length === 0 && cards.some((c) => c.made);
  const grown = needsField && boardType ? withBlocksField(boardType) : null;
  const types = grown ? input.types.map((t) => (t.id === grown.id ? grown : t)) : input.types;
  const picked = columns.find((c) => same(c.name, input.column)) ?? columns[0];

  const idOf = new Map(cards.map((c) => [c.element, c.id]));
  // Each card's type: a made one is the board's, an updated one its own.
  const typeOfCard = (c: PlanMakeCardInput) =>
    typeIn(types, c.made ? input.type : (items.get(c.id)?.type ?? input.type));

  // Who waits on whom across the plan now (live cards), then each new link added only where it closes no loop.
  const waitsOn = new Map<string, Set<string>>();
  for (const it of items.values())
    if (live(it)) waitsOn.set(it.id, new Set(blockerIdsOf(it, typeIn(types, it.type))));
  const reaches = (from: string, to: string): boolean => {
    const seen = new Set<string>([from]);
    const stack = [from];
    while (stack.length) {
      const at = stack.pop()!;
      if (at === to) return true;
      for (const next of waitsOn.get(at) ?? [])
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
    }
    return false;
  };

  let skipped = 0;
  const out: PlanMakeCardOutput[] = cards.map((c) => {
    const before = c.made ? undefined : items.get(c.id);
    const fields: ItemFields = before ? { ...before.fields } : { ...c.extra };
    fields['title'] = c.title;
    if (c.made && c.description) fields['description'] = c.description;
    if (c.start) fields['start'] = c.start;
    if (c.due) fields['due'] = c.due;
    if (c.labels?.length) {
      const had = before ? itemLabels(before) : [];
      const labels = [...had];
      for (const l of c.labels) if (!labels.some((x) => same(x, l))) labels.push(l);
      fields['labels'] = labels.slice(0, LABELS_MAX);
    }
    const type = typeOfCard(c);
    const field = blocksFieldsOf(type)[0];
    const wanted = (c.blockedBy ?? []).map((e) => idOf.get(e)).filter((x): x is string => !!x);
    if (wanted.length > 0) {
      if (!field) skipped += wanted.length;
      else {
        const holds = new Set(blockerIdsOf({ id: c.id, fields }, type));
        // A Blocked By field stored holding one card (from before Holds Several) keeps one: a second would read as
        // nothing, so it is left out and counted.
        const most = holdsSeveral(field) ? FIELD_VALUES_MAX : 1;
        const mine = waitsOn.get(c.id) ?? new Set<string>();
        waitsOn.set(c.id, mine);
        for (const blocker of wanted) {
          if (holds.has(blocker)) continue;
          if (holds.size >= most || reaches(blocker, c.id)) {
            skipped += 1;
            continue;
          }
          holds.add(blocker);
          mine.add(blocker);
        }
        if (holds.size > 0) fields[field.id] = [...holds];
      }
    }
    const status = c.made
      ? ((c.column ? columns.find((col) => same(col.name, c.column!)) : undefined) ?? picked)
          ?.status
      : undefined;
    return { element: c.element, id: c.id, made: c.made, ...(status ? { status } : {}), fields };
  });
  return { type: grown, cards: out, skipped };
}
