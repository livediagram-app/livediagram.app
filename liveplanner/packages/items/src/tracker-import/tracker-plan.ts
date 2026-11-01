// What an import makes of a board read from another tool (docs/specs/026-plan/tracker-import.md "What it makes"):
// the board and its columns, the card type, each card's fields and comments, and the preview that says so before
// anything is written. Pure, so the editor and the agents plan an import the same way and write it their own way.
import { newItemId } from '../apply';
import { placeBoard } from '../board-place';
import type { ItemCreate, ItemFields, ItemPerson } from '../item';
import type { ItemFieldId } from '../item-types';
import type { CustomFieldDef, ItemTypeDef } from '../item-types';
import { ITEM_DESCRIPTION_MAX, PLAN_COLUMNS_MAX } from '../limits';
import type { PlanStatusName } from '../plan-outline';
import { personNamed } from '../plan-names';
import { statusKey } from '../status-names';
import { fitFields } from './tracker-fit';
import {
  TRACKER_CARD_COMMENTS_MAX,
  TRACKER_COMMENT_OVERHEAD,
  TRACKER_COMMENT_TEXT_MAX,
  TRACKER_COMMENTS_MAX,
  TRACKER_SOURCE_NAMES,
  TRACKER_THREAD_BUDGET,
  addSkip,
  type TrackerBoard,
  type TrackerCard,
  type TrackerExtraValue,
  type TrackerPerson,
  type TrackerSkips,
  type TrackerSource,
} from './tracker-model';
import { trackerPreview, type TrackerPreview } from './tracker-preview';
import { commentHeader, cutText } from './tracker-text';
import { TRACKER_TYPE_IDS, trackerCardType, type TrackerTypeResult } from './tracker-type';

// The column a card with no status goes to, and the one statuses past a board's columns share.
export const TRACKER_NO_STATUS = 'No Status';
export const TRACKER_OTHER_COLUMN = 'Other';

// A joined member of the plan's team, by their lower-cased email.
export interface TrackerMember {
  email: string;
  person: ItemPerson;
}

export interface TrackerPlanContext {
  // The plan's card types, and the states its boards name.
  types: readonly ItemTypeDef[];
  statuses: readonly PlanStatusName[];
  // People already on the plan (assigned, the team), matched by name.
  people: readonly ItemPerson[];
  members: readonly TrackerMember[];
  // How many more cards the plan has room for.
  room: number;
  // The new board element's id.
  boardId: string;
  random?: () => number;
}

// An imported comment as the thread will hold it: its text starting with its author and date, and when it was written.
export interface TrackerCommentOut {
  text: string;
  at: number | null;
}

export type TrackerCreate = ItemCreate & {
  id: string;
  place: { status: string };
  importedComments: TrackerCommentOut[];
};

export interface TrackerImportPlan {
  source: TrackerSource;
  sourceName: string;
  title: string;
  board: Extract<ReturnType<typeof placeBoard>, { ok: true }>['board'];
  type: ItemTypeDef;
  typeIsNew: boolean;
  creates: TrackerCreate[];
  preview: TrackerPreview;
}

// The board's columns: the source's, a card with no status in No Status, past the board's cap folded into Other.
function columnsOf(
  board: TrackerBoard,
  skips: TrackerSkips,
): { names: string[]; of: (c: string) => string } {
  const named = (c: string) => (statusKey(c) ? c : TRACKER_NO_STATUS);
  const all: string[] = [];
  for (const c of [...board.columns, ...board.cards.map((card) => card.column)]) {
    const name = named(c);
    if (!all.some((n) => statusKey(n) === statusKey(name))) all.push(name);
  }
  const kept = all.length > PLAN_COLUMNS_MAX ? all.slice(0, PLAN_COLUMNS_MAX - 1) : all;
  const folded = all.length > kept.length;
  const names =
    folded && !kept.some((n) => statusKey(n) === statusKey(TRACKER_OTHER_COLUMN))
      ? [...kept, TRACKER_OTHER_COLUMN]
      : kept;
  const of = (c: string) => {
    const key = statusKey(named(c));
    return names.find((n) => statusKey(n) === key) ?? TRACKER_OTHER_COLUMN;
  };
  if (folded)
    addSkip(
      skips,
      'otherColumn',
      board.cards.filter(
        (card) => !kept.some((n) => statusKey(n) === statusKey(named(card.column))),
      ).length,
    );
  return { names, of };
}

// The built-in fields the cards fill.
function usedFields(cards: readonly TrackerCard[]): Set<ItemFieldId> {
  const used = new Set<ItemFieldId>();
  for (const c of cards) {
    if (c.assignee) used.add('assignee');
    if (c.priority) used.add('priority');
    if (c.estimate !== undefined) used.add('estimate');
    if (c.start) used.add('start');
    if (c.due) used.add('due');
    if (c.labels.length) used.add('labels');
    if (c.checklist.length) used.add('checklist');
  }
  return used;
}

// People as the plan names them: a team member by email, else someone on the plan by name, else a named person.
class People {
  private readonly known: ItemPerson[];
  private readonly byEmail: Map<string, ItemPerson>;
  readonly matched = new Set<string>();
  readonly onPlan = new Set<string>();
  readonly named = new Set<string>();

  constructor(ctx: TrackerPlanContext) {
    this.known = [...ctx.people];
    this.byEmail = new Map(ctx.members.map((m) => [m.email.toLowerCase(), m.person]));
  }

  of(p: TrackerPerson): ItemPerson {
    const member = p.email ? this.byEmail.get(p.email) : undefined;
    if (member) {
      this.matched.add(member.id);
      return member;
    }
    const person = personNamed(p.name, this.known);
    if (!this.known.some((k) => k.id === person.id)) {
      this.known.push(person);
      this.named.add(person.id);
    } else if (!this.named.has(person.id)) this.onPlan.add(person.id);
    return person;
  }
}

// Each card's comments: the newest that fit the thread (its count and size) and the import's total, oldest first.
class CommentBudget {
  private total = 0;
  private readonly skips: TrackerSkips;

  constructor(skips: TrackerSkips) {
    this.skips = skips;
  }

  keep(card: TrackerCard): TrackerCommentOut[] {
    const out: TrackerCommentOut[] = [];
    let size = 0;
    for (let i = card.comments.length - 1; i >= 0; i -= 1) {
      const c = card.comments[i]!;
      const header = commentHeader(c.author, c.at);
      const text = `${header}\n${cutText(c.text, Math.max(1, TRACKER_COMMENT_TEXT_MAX - header.length - 1))}`;
      const cost = JSON.stringify(text).length + TRACKER_COMMENT_OVERHEAD;
      if (
        out.length >= TRACKER_CARD_COMMENTS_MAX ||
        size + cost > TRACKER_THREAD_BUDGET ||
        this.total >= TRACKER_COMMENTS_MAX
      ) {
        addSkip(this.skips, 'commentsOverCap', i + 1);
        break;
      }
      size += cost;
      this.total += 1;
      out.push({ text, at: c.at });
    }
    return out.reverse();
  }
}

function descriptionOf(card: TrackerCard): string {
  if (card.links.length === 0) return card.description;
  const lines = card.links.map((l) => `- ${l.name}: ${l.url}`).join('\n');
  const joined = card.description
    ? `${card.description}\n\nAttachments\n${lines}`
    : `Attachments\n${lines}`;
  return cutText(joined, ITEM_DESCRIPTION_MAX);
}

function extraValue(
  field: CustomFieldDef,
  value: TrackerExtraValue,
  people: People,
): ItemFields[string] | undefined {
  if (typeof value === 'string')
    return field.kind === 'choice' ? field.options?.find((o) => o === value) : value;
  const list = value.map((p) => people.of(p));
  return field.multiple ? list : list[0];
}

function fieldsOf(card: TrackerCard, typed: TrackerTypeResult, people: People): ItemFields {
  const fields: ItemFields = { title: card.title };
  const description = descriptionOf(card);
  if (description) fields['description'] = description;
  if (card.assignee) fields['assignee'] = people.of(card.assignee);
  if (card.priority) fields['priority'] = card.priority;
  if (card.estimate !== undefined) fields['estimate'] = card.estimate;
  if (card.start) fields['start'] = card.start;
  if (card.due) fields['due'] = card.due;
  if (card.labels.length) fields['labels'] = [...card.labels];
  if (card.checklist.length) fields['checklist'] = card.checklist.map((r) => ({ ...r }));
  for (const [key, value] of Object.entries(card.extras)) {
    const field = typed.fieldOf.get(key);
    const v = field ? extraValue(field, value, people) : undefined;
    if (v !== undefined) fields[field!.id] = v;
  }
  return fields;
}

// The import `board` makes in a plan described by `ctx`.
export function planTrackerImport(board: TrackerBoard, ctx: TrackerPlanContext): TrackerImportPlan {
  const random = ctx.random ?? Math.random;
  const skips: TrackerSkips = { ...board.skips };
  const columns = columnsOf(board, skips);
  const sourceName = TRACKER_SOURCE_NAMES[board.source];
  const typeId = TRACKER_TYPE_IDS[board.source];
  const placed = placeBoard(
    { columns: columns.names, title: board.title, types: [typeId] },
    [],
    ctx.statuses,
    ctx.boardId,
    random,
  );
  // Every name is cleaned, cut and distinct, and the title within its length: a refusal here is a bug.
  if (!placed.ok) throw new Error(`[tracker-import] board refused: ${placed.message}`);
  // A Board tab's board draws its cards Detailed: no card size kept (plan-tabs.md "Board tab and Sheet tab").
  const { cardSize: _size, ...setup } = placed.board.planBoard;
  const placedBoard = { ...placed.board, planBoard: setup };
  const statusOf = new Map(
    placed.board.planBoard.columns.map((c) => [statusKey(c.name), c.status]),
  );
  const typed = trackerCardType(
    board.source,
    usedFields(board.cards),
    board.extras,
    placed.board.planBoard.columns.map((c) => c.status),
    ctx.types,
  );
  const people = new People(ctx);
  const comments = new CommentBudget(skips);
  const creates: TrackerCreate[] = [];
  for (const card of board.cards) {
    const fit = fitFields(fieldsOf(card, typed, people));
    if (!fit) {
      addSkip(skips, 'invalidCards');
      continue;
    }
    if (fit.shortened) addSkip(skips, 'shortened');
    creates.push({
      id: newItemId(random),
      type: typed.type.id,
      fields: fit.fields,
      place: { status: statusOf.get(statusKey(columns.of(card.column)))! },
      importedComments: comments.keep(card),
    });
  }
  return {
    source: board.source,
    sourceName,
    title: board.title,
    board: placedBoard,
    type: typed.type,
    typeIsNew: typed.isNew,
    creates,
    preview: trackerPreview({
      board,
      columns: columns.names,
      columnOf: columns.of,
      creates,
      typed,
      people: {
        matched: people.matched.size,
        onPlan: people.onPlan.size,
        named: people.named.size,
      },
      skips,
      room: ctx.room,
    }),
  };
}
