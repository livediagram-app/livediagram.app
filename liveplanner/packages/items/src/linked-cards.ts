// Linked cards (docs/specs/026-plan/linked-boards.md): the card a linked board holds for one canvas record (an
// assigned action), how the two map onto each other, and the heal that puts them back together. Pure, and structural
// about the record, so this package never imports the project model: the editor hands records in this shape.

import {
  TRASHED_FROM_FIELD,
  TRASH_STATUS,
  isTrashed,
  type LinkedRecordKind,
  type PlanBoardSetup,
} from './board';
import {
  itemAssignee,
  itemStatus,
  itemTitle,
  type Item,
  type ItemCreate,
  type ItemPerson,
} from './item';
import { ITEM_DESCRIPTION_MAX, ITEM_TITLE_MAX } from './limits';
import type { ItemPatchOf, ItemStoreState, ItemWrite } from './store';

// The card's link field: `<kind>/<tab id>/<element id>/<record id>`.
export const LINKED_FIELD = 'linked';
// The card's baseline: its record's stamp and its own revision when the two last agreed ("Keeping them together").
export const LINKED_AT_FIELD = 'linkedAt';
export const LINKED_REV_FIELD = 'linkedRev';
// Set on a card the link put in the Trash because its record went (deleted, or its element or tab was): the heal
// brings it back if the record does (an undo).
export const LINKED_GONE_FIELD = 'linkedGone';

// A record's status as the canvas holds it.
export type LinkedRecordStatus = 'open' | 'done' | 'wont-do';

// One canvas record as the heal reads it: where it is, what it says, and when it last changed.
export type LinkedRecord = {
  id: string;
  tabId: string;
  elementId: string;
  title: string;
  description: string;
  status: LinkedRecordStatus;
  updatedAt: number;
  // As Plan names people (a hashed id), or null when nobody (or nobody hashable yet).
  assignee: ItemPerson | null;
};

export type LinkedPlace = {
  kind: LinkedRecordKind;
  tabId: string;
  elementId: string;
  recordId: string;
};

// What the heal asks of a record: only the fields that change, from the card that changed last.
export type LinkedRecordChange = {
  id: string;
  tabId: string;
  elementId: string;
  title?: string;
  description?: string;
  status?: LinkedRecordStatus;
};

const KIND_LETTER: Record<LinkedRecordKind, string> = { actions: 'a' };
const ITEM_ID_MAX = 32;
const ITEM_ID_MIN = 6;

// The card id a record's card always has, so two editors making it at once make one card (the store refuses a
// second create of an id with `item_exists`). The kind's letter, then the record id's id-safe characters, cut to the
// id's longest and padded to its shortest.
export function linkedCardId(kind: LinkedRecordKind, recordId: string): string {
  const id = (KIND_LETTER[kind] + recordId.replace(/[^A-Za-z0-9_-]/g, '')).slice(0, ITEM_ID_MAX);
  return id.padEnd(ITEM_ID_MIN, '_');
}

export function linkString(place: LinkedPlace): string {
  return [place.kind, place.tabId, place.elementId, place.recordId].join('/');
}

export function parseLink(value: unknown): LinkedPlace | null {
  if (typeof value !== 'string') return null;
  const parts = value.split('/');
  if (parts.length !== 4 || parts.some((p) => !p)) return null;
  const [kind, tabId, elementId, recordId] = parts as [string, string, string, string];
  if (kind !== 'actions') return null;
  return { kind, tabId, elementId, recordId };
}

export function cardLink(item: Pick<Item, 'fields'>): LinkedPlace | null {
  return parseLink(item.fields[LINKED_FIELD]);
}

// The first board in `boards` (project order) that collects `kind`.
export function collectingBoard<T extends { setup: PlanBoardSetup }>(
  boards: Iterable<T>,
  kind: LinkedRecordKind,
): T | undefined {
  for (const b of boards) if (b.setup.collects === kind) return b;
  return undefined;
}

// A card's status read as a record's (docs/specs/026-plan/linked-boards.md "The link"): a column before the done
// column is open, the done column done, a column after it Won't Do. Null for a status the board does not show (or a
// board with no done column), which changes nothing.
export function recordStatusOf(
  setup: PlanBoardSetup,
  status: string | undefined,
): LinkedRecordStatus | null {
  const at = setup.columns.findIndex((c) => c.status === status);
  const done = setup.columns.findIndex((c) => c.id === setup.doneColumnId);
  if (at < 0 || done < 0) return null;
  return at < done ? 'open' : at === done ? 'done' : 'wont-do';
}

// The status a card takes for a record's status: open to the first column (unless it is in an open column already),
// done to the done column, Won't Do to the first column after Done (Done itself when there is none). Undefined when
// the board cannot hold it (no columns, or no done column).
export function cardStatusFor(
  setup: PlanBoardSetup,
  status: LinkedRecordStatus,
  current: string | undefined,
): string | undefined {
  const done = setup.columns.findIndex((c) => c.id === setup.doneColumnId);
  if (done < 0) return undefined;
  if (status === 'open') {
    return recordStatusOf(setup, current) === 'open' ? current : setup.columns[0]?.status;
  }
  if (status === 'done') return setup.columns[done]!.status;
  return (setup.columns[done + 1] ?? setup.columns[done])!.status;
}

// Whether a card's status and a record's agree. A board with no column after Done holds Won't Do in Done, so there
// the two read as one; anything else is a disagreement.
function statusAgrees(setup: PlanBoardSetup, card: Item, record: LinkedRecordStatus): boolean {
  const read = recordStatusOf(setup, itemStatus(card));
  if (read === null || read === record) return true;
  const done = setup.columns.findIndex((c) => c.id === setup.doneColumnId);
  const nothingAfterDone = done === setup.columns.length - 1;
  return nothingAfterDone && read === 'done' && record === 'wont-do';
}

const clip = (text: string, max: number) => text.slice(0, max);

// The card a record starts with.
export function linkedCardCreate(
  kind: LinkedRecordKind,
  record: LinkedRecord,
  setup: PlanBoardSetup,
  typeId: string,
): ItemCreate {
  const status = cardStatusFor(setup, record.status, undefined);
  return {
    id: linkedCardId(kind, record.id),
    type: typeId,
    fields: {
      title: clip(record.title, ITEM_TITLE_MAX) || 'Action',
      ...(record.description
        ? { description: clip(record.description, ITEM_DESCRIPTION_MAX) }
        : {}),
      ...(status ? { status } : {}),
      ...(record.assignee ? { assignee: record.assignee } : {}),
      [LINKED_FIELD]: linkString({
        kind,
        tabId: record.tabId,
        elementId: record.elementId,
        recordId: record.id,
      }),
      [LINKED_AT_FIELD]: record.updatedAt,
      // A new card's revision.
      [LINKED_REV_FIELD]: 1,
    },
  };
}

function sameText(card: Item, field: string, text: string): boolean {
  const value = card.fields[field];
  return (typeof value === 'string' ? value : '') === text;
}

export type LinkedHeal = {
  creates: ItemCreate[];
  patches: ItemPatchOf[];
  // Each carries `updatedAt`, the stamp the record is written with (the card's new baseline names it).
  records: (LinkedRecordChange & { updatedAt: number })[];
};

// What puts a linked board's cards and their records back together (docs/specs/026-plan/linked-boards.md "Keeping
// them together"): a card for each record with none; and, where a card and its record disagree (title, description,
// status), the side that changed since they were last together wins. Each card keeps that baseline: the record stamp
// (`linkedAt`) and its own revision (`linkedRev`) as of the last time they agreed, so neither clock is compared with
// the other (the server stamps cards, browsers stamp records). Both changed is settled by the later stamp. The record
// owns its assignee and where it is; the card follows. Never a delete: a record on a tab not loaded yet is not a
// missing record. A card in a status the board does not show, or in the Trash, is left alone. `now` stamps a record
// the heal writes.
export function healLinkedCards(input: {
  kind: LinkedRecordKind;
  records: readonly LinkedRecord[];
  items: ReadonlyMap<string, Item>;
  setup: PlanBoardSetup;
  typeId: string;
  now: number;
}): LinkedHeal {
  const { kind, records, items, setup, typeId, now } = input;
  const heal: LinkedHeal = { creates: [], patches: [], records: [] };
  if (!setup.columns.length) return heal;
  for (const record of records) {
    const card = items.get(linkedCardId(kind, record.id));
    if (!card) {
      heal.creates.push(linkedCardCreate(kind, record, setup, typeId));
      continue;
    }
    if (isTrashed(card)) {
      if (card.fields[LINKED_GONE_FIELD] === true)
        heal.patches.push({ id: card.id, patch: restorePatch(card, setup) });
      continue;
    }
    const healed = healOne(kind, record, card, setup, now);
    if (healed.patch) heal.patches.push({ id: card.id, patch: healed.patch });
    if (healed.record) heal.records.push(healed.record);
  }
  return heal;
}

function healOne(
  kind: LinkedRecordKind,
  record: LinkedRecord,
  card: Item,
  setup: PlanBoardSetup,
  now: number,
): { patch?: ItemPatchOf['patch']; record?: LinkedRecordChange & { updatedAt: number } } {
  const title = clip(record.title, ITEM_TITLE_MAX);
  const description = clip(record.description, ITEM_DESCRIPTION_MAX);
  const titleDiffers = !!title && itemTitle(card) !== title;
  const descriptionDiffers = !sameText(card, 'description', description);
  const statusDiffers = !statusAgrees(setup, card, record.status);
  const recordMoved = card.fields[LINKED_AT_FIELD] !== record.updatedAt;
  const cardMoved = card.fields[LINKED_REV_FIELD] !== card.rev;
  const cardWins =
    cardMoved &&
    (!recordMoved || card.updatedAt > record.updatedAt) &&
    (titleDiffers || descriptionDiffers || statusDiffers);

  const set: Record<string, Item['fields'][string]> = {};
  const clear: string[] = [];
  let change: (LinkedRecordChange & { updatedAt: number }) | undefined;
  if (cardWins) {
    change = { id: record.id, tabId: record.tabId, elementId: record.elementId, updatedAt: now };
    if (titleDiffers && itemTitle(card)) change.title = itemTitle(card);
    if (descriptionDiffers) {
      const text = card.fields['description'];
      change.description = typeof text === 'string' ? text : '';
    }
    if (statusDiffers) change.status = recordStatusOf(setup, itemStatus(card))!;
  } else {
    if (titleDiffers) set['title'] = title;
    if (descriptionDiffers) {
      if (description) set['description'] = description;
      else clear.push('description');
    }
    if (statusDiffers) {
      const status = cardStatusFor(setup, record.status, itemStatus(card));
      if (status) set['status'] = status;
    }
  }
  // Owned by the record, whichever side changed.
  const assignee = itemAssignee(card);
  if (
    record.assignee &&
    (assignee?.id !== record.assignee.id || assignee.name !== record.assignee.name)
  )
    set['assignee'] = record.assignee;
  else if (!record.assignee && assignee) clear.push('assignee');
  const link = linkString({
    kind,
    tabId: record.tabId,
    elementId: record.elementId,
    recordId: record.id,
  });
  if (card.fields[LINKED_FIELD] !== link) set[LINKED_FIELD] = link;
  const writesCard = Object.keys(set).length > 0 || clear.length > 0 || !!change;
  if (!writesCard) return {};
  // The new baseline: the record as it will stand, and the card's revision after this patch.
  set[LINKED_AT_FIELD] = change ? change.updatedAt : record.updatedAt;
  set[LINKED_REV_FIELD] = card.rev + 1;
  return {
    patch: { set, ...(clear.length ? { clear } : {}) },
    ...(change ? { record: change } : {}),
  };
}

// A card whose record went (docs/specs/026-plan/linked-boards.md "The link"): it stays on the board where it is, a card
// of its own from then on, its link and baseline dropped. Undefined for a card with no link, or one in the Trash (a
// person trashed it, and Restore brings its record back). Should the record come back (an undo), the heal finds the
// card by its id, fixed by the record's, and links them again.
export function linkedCardLeftPatch(card: Item): ItemPatchOf | undefined {
  if (!cardLink(card) || isTrashed(card)) return undefined;
  const clear = [LINKED_FIELD, LINKED_AT_FIELD, LINKED_REV_FIELD, LINKED_GONE_FIELD].filter(
    (f) => f in card.fields,
  );
  return { id: card.id, patch: { clear } };
}

// Back from the Trash to the status it had (the board's first column when it had none).
function restorePatch(card: Item, setup: PlanBoardSetup): ItemPatchOf['patch'] {
  const from = card.fields[TRASHED_FROM_FIELD];
  const status = typeof from === 'string' && from ? from : setup.columns[0]!.status;
  return { set: { status }, clear: [TRASHED_FROM_FIELD, LINKED_GONE_FIELD] };
}

// The linked cards a person's own write sends to the Trash (docs/specs/026-plan/linked-boards.md "The link"): their
// records leave the canvas with them. Read from the write and the store it applies to.
export function linkedCardsTrashedBy(write: ItemWrite, before: ItemStoreState): Item[] {
  const toTrash: string[] = [];
  const statusOf = (set: Item['fields'] | undefined) => set?.['status'];
  if (write.kind === 'patch' && statusOf(write.patch.set) === TRASH_STATUS) toTrash.push(write.id);
  if (write.kind === 'move' && (write.move.status ?? statusOf(write.move.set)) === TRASH_STATUS)
    toTrash.push(write.id);
  if (write.kind === 'patches')
    for (const p of write.patches) if (statusOf(p.patch.set) === TRASH_STATUS) toTrash.push(p.id);
  if (!toTrash.length) return [];
  const byId = new Map(before.items.map((i) => [i.id, i]));
  return toTrash.flatMap((id) => {
    const card = byId.get(id);
    return card && cardLink(card) && !isTrashed(card) ? [card] : [];
  });
}

// A card's fields without its link: a copy of a linked card (Duplicate) is a card of its own, never a second card for
// the same record.
export function unlinkedFields(fields: Item['fields']): Item['fields'] {
  const {
    [LINKED_FIELD]: _link,
    [LINKED_AT_FIELD]: _at,
    [LINKED_REV_FIELD]: _rev,
    [LINKED_GONE_FIELD]: _gone,
    ...rest
  } = fields;
  return rest;
}
