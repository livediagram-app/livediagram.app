// A board's cards as CSV rows, out and in (docs/specs/026-plan/plan-board.md "CSV"). Rows of fields only: the CSV
// text itself is read and written by the Sheet's CSV module in the editor, as this package imports no other.
import { byRank } from './apply';
import { boardAddTypes, linkedCard, projectBoard, statusLabel, type PlanBoardSetup } from './board';
import { builtInFieldOf } from './card-source';
import { PRIORITIES, PRIORITY_LABELS, isPriority, validateFields } from './fields';
import type { Item, ItemCreate, ItemFieldValue, ItemFields, ItemPerson } from './item';
import { itemAssignee, itemLabels, itemStatus, itemTitle } from './item';
import { ratingScaleOf, type CustomFieldDef, type ItemTypeDef } from './item-types';
import {
  ITEM_DESCRIPTION_MAX,
  ITEM_LABEL_MAX,
  ITEM_LABELS_MAX,
  ITEM_NUMBER_MAX,
  ITEM_TITLE_MAX,
  ITEM_UNKNOWN_STRING_MAX,
} from './limits';
import { resolvedDefaultStatus, typeAllowsStatus, typeIn } from './type-catalogue';

// The built-in fields after Key, Title, Type and Status, in file order, each under its header.
export const BOARD_CSV_FIELDS = [
  ['assignee', 'Assignee'],
  ['priority', 'Priority'],
  ['start', 'Start'],
  ['due', 'Due'],
  ['estimate', 'Estimate'],
  ['labels', 'Labels'],
  ['description', 'Description'],
] as const;

// The file's name when the board has no title.
export const BOARD_CSV_UNTITLED = 'Board';

export function boardCsvFileName(title: string): string {
  return `${title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || BOARD_CSV_UNTITLED}.csv`;
}

const lower = (s: string) => s.trim().toLowerCase();

// The custom fields of the board's types, one per label (the first type naming it wins), in catalogue order.
function customColumns(types: readonly ItemTypeDef[]): string[] {
  const out = new Map<string, string>();
  for (const t of types)
    for (const f of t.custom ?? []) if (!out.has(lower(f.label))) out.set(lower(f.label), f.label);
  return [...out.values()];
}

function customByLabel(type: ItemTypeDef, label: string): CustomFieldDef | undefined {
  const l = lower(label);
  return type.custom?.find((f) => lower(f.label) === l);
}

function cellOf(v: ItemFieldValue | undefined): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'Yes' : '';
  if (Array.isArray(v)) return v.map((x) => cellOf(x)).join(', ');
  return typeof v['name'] === 'string' ? v['name'] : '';
}

function builtInCell(item: Item, field: (typeof BOARD_CSV_FIELDS)[number][0]): string {
  switch (field) {
    case 'assignee':
      return itemAssignee(item)?.name ?? '';
    case 'priority': {
      const p = item.fields['priority'];
      return isPriority(p) ? PRIORITY_LABELS[p] : '';
    }
    case 'labels':
      return itemLabels(item).join(', ');
    default:
      return cellOf(item.fields[field]);
  }
}

// The header and a row per card the board shows (before any quick filter), column by column in board order.
export function boardCsvRows(
  setup: PlanBoardSetup,
  items: ReadonlyMap<string, Item>,
  types: readonly ItemTypeDef[],
  statusNames?: ReadonlyMap<string, string>,
): string[][] {
  const shown = boardAddTypes(setup, types);
  const builtIns = BOARD_CSV_FIELDS.filter(([id]) => shown.some((t) => t.fields.includes(id)));
  const customs = customColumns(shown);
  const rows: string[][] = [
    ['Key', 'Title', 'Type', 'Status', ...builtIns.map(([, h]) => h), ...customs],
  ];
  const byColumn = setup.archive === true || setup.allCards === true;
  const projection = projectBoard(setup, items, undefined, types, statusNames);
  for (const col of projection.columns) {
    const cards = col.lanes.flatMap((l) => l.items).sort(byRank);
    for (const item of cards) {
      const type = typeIn(types, item.type);
      const status = itemStatus(item);
      const statusText = byColumn
        ? status
          ? statusLabel(status, statusNames)
          : ''
        : col.column.name || statusLabel(col.column.status, statusNames);
      rows.push([
        String(item.key),
        itemTitle(item),
        type.label,
        statusText,
        ...builtIns.map(([id]) => (type.fields.includes(id) ? builtInCell(item, id) : '')),
        ...customs.map((label) => {
          const f = customByLabel(type, label);
          if (!f) return '';
          if (f.kind === 'card') {
            const linked = linkedCard(items, item.fields[f.id]);
            return linked ? itemTitle(linked) : '';
          }
          // An option may hold a comma, so a Multiple Choice's picks are kept apart by semicolons.
          if (f.kind === 'multichoice') {
            const v = item.fields[f.id];
            return Array.isArray(v) ? v.map((x) => cellOf(x)).join('; ') : cellOf(v);
          }
          return cellOf(item.fields[f.id]);
        }),
      ]);
    }
  }
  return rows;
}

// --- Import ---------------------------------------------------------------------------------------------------

const ISO_DATE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/;
const DAY_FIRST = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/;

function realDay(y: number, m: number, d: number): string | undefined {
  const at = new Date(Date.UTC(y, m - 1, d));
  if (at.getUTCFullYear() !== y || at.getUTCMonth() !== m - 1 || at.getUTCDate() !== d)
    return undefined;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// A date as a card holds it (YYYY-MM-DD), from YYYY-MM-DD or a day-first D/M/YYYY (`-` and `.` too, a two-digit
// year in this century); undefined for anything else or a day that does not exist.
export function cardDateOf(text: string): string | undefined {
  const t = text.trim();
  const iso = ISO_DATE.exec(t);
  if (iso) return realDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = DAY_FIRST.exec(t);
  if (!dmy) return undefined;
  const y = dmy[3]!.length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
  return realDay(y, Number(dmy[2]), Number(dmy[1]));
}

// A Multiple Choice's picks from "Vegan; Gluten free" (or commas, when every part is an option), in option order;
// undefined when none is an option.
export function multiChoiceOf(options: readonly string[], text: string): string[] | undefined {
  const pick = (parts: string[]) =>
    options.filter((o) => parts.some((p) => lower(p.trim()) === lower(o)));
  const bySemicolon = text.split(';');
  let picks = pick(bySemicolon);
  if (bySemicolon.length === 1) {
    const byComma = text.split(',');
    const commaPicks = pick(byComma);
    if (commaPicks.length === byComma.filter((p) => p.trim()).length) picks = commaPicks;
  }
  return picks.length ? picks : undefined;
}

const TRUE_TEXT = new Set(['yes', 'y', 'true', '1', 'x', '✓', '✔']);

function customValue(f: CustomFieldDef, text: string): ItemFieldValue | undefined {
  switch (f.kind) {
    case 'card':
      return undefined;
    case 'number': {
      const n = Number(text);
      return text && Number.isFinite(n) ? n : undefined;
    }
    case 'date':
      return cardDateOf(text);
    case 'checkbox':
      return TRUE_TEXT.has(lower(text)) ? true : undefined;
    case 'choice':
      return f.options?.find((o) => lower(o) === lower(text));
    case 'multichoice':
      return multiChoiceOf(f.options ?? [], text);
    case 'rating': {
      const n = Number(text);
      return Number.isInteger(n) && n >= 1 && n <= ratingScaleOf(f) ? n : undefined;
    }
    default:
      return text.slice(0, ITEM_UNKNOWN_STRING_MAX);
  }
}

function builtInValue(
  id: string,
  text: string,
  people: readonly ItemPerson[],
): ItemFieldValue | undefined {
  switch (id) {
    case 'assignee':
      return people.find((p) => lower(p.name) === lower(text));
    case 'priority':
      return PRIORITIES.find((p) => p === lower(text));
    case 'start':
    case 'due':
      return cardDateOf(text);
    case 'estimate': {
      const n = Number(text);
      return Number.isFinite(n) && n >= 0 && n <= ITEM_NUMBER_MAX ? n : undefined;
    }
    case 'labels': {
      const out: string[] = [];
      for (const part of text.split(/[,;]/)) {
        const l = part.trim().slice(0, ITEM_LABEL_MAX).trim();
        if (l && !out.includes(l) && out.length < ITEM_LABELS_MAX) out.push(l);
      }
      return out.length ? out : undefined;
    }
    case 'description':
      return text.slice(0, ITEM_DESCRIPTION_MAX);
    default:
      return undefined;
  }
}

export type BoardCsvRefusal = 'no_title_column' | 'no_types' | 'archive';

export interface BoardCsvImport {
  creates: ItemCreate[];
  // Rows with a cell in them that add no card: no title, no status their type allows, past the room left.
  skipped: number;
  refusal?: BoardCsvRefusal;
}

export interface BoardCsvImportContext {
  setup: PlanBoardSetup;
  types: readonly ItemTypeDef[];
  // The names the document's boards give their statuses: an All Cards board's states.
  statusNames?: ReadonlyMap<string, string>;
  // Who could be assigned: an Assignee is matched by name among them.
  people: readonly ItemPerson[];
  // How many cards the document still has room for (ITEMS_MAX less what it holds).
  room: number;
}

// The creates a CSV's rows (the first naming the columns) make on a board, in file order, each at the end of its
// column; pure, so the editor writes them as one write and one undo step.
export function boardCsvImport(
  rows: readonly (readonly string[])[],
  ctx: BoardCsvImportContext,
): BoardCsvImport {
  const { setup } = ctx;
  if (setup.archive === true) return { creates: [], skipped: 0, refusal: 'archive' };
  const header = (rows[0] ?? []).map((h) => lower(h));
  const builtIns = new Map<string, number>();
  header.forEach((h, i) => {
    const id = builtInFieldOf(h);
    if (id && !builtIns.has(id)) builtIns.set(id, i);
  });
  const titleAt = builtIns.get('title');
  if (titleAt === undefined) return { creates: [], skipped: 0, refusal: 'no_title_column' };
  const boardTypes = boardAddTypes(setup, ctx.types);
  if (boardTypes.length === 0) return { creates: [], skipped: 0, refusal: 'no_types' };

  // The statuses a row may name: the board's columns, or on an All Cards board every state a board names.
  const named =
    setup.allCards === true && ctx.statusNames?.size
      ? [...ctx.statusNames].map(([status, name]) => ({ status, name }))
      : setup.columns.map((c) => ({ status: c.status, name: c.name || statusLabel(c.status) }));
  const pairs = named.map((c) => [c.status, c.name] as const);

  const creates: ItemCreate[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    if (row.every((cell) => cell.trim() === '')) continue;
    const cell = (id: string) => {
      const at = builtIns.get(id);
      return at === undefined ? '' : (row[at] ?? '').trim();
    };
    const title = cell('title').slice(0, ITEM_TITLE_MAX).trim();
    if (!title || creates.length >= ctx.room) {
      skipped++;
      continue;
    }
    const typeText = lower(cell('#type'));
    const type =
      (typeText && boardTypes.find((t) => lower(t.label) === typeText || t.id === typeText)) ||
      boardTypes[0]!;
    const statusText = lower(cell('status'));
    const fallback = resolvedDefaultStatus(type, pairs);
    let status =
      (statusText &&
        named.find((c) => lower(c.name) === statusText || c.status === statusText)?.status) ||
      (fallback && named.some((c) => c.status === fallback) ? fallback : named[0]?.status);
    if (!status || !typeAllowsStatus(type, status))
      status = named.find((c) => typeAllowsStatus(type, c.status))?.status;
    if (!status) {
      skipped++;
      continue;
    }
    const fields: ItemFields = { title };
    for (const [id] of BOARD_CSV_FIELDS) {
      const text = cell(id);
      if (!text || !type.fields.includes(id)) continue;
      const v = builtInValue(id, text, ctx.people);
      if (v !== undefined) fields[id] = v;
    }
    for (const f of type.custom ?? []) {
      const at = header.indexOf(lower(f.label));
      // A built-in's name wins its column ("Due" is the card's Due, not a custom field of that label).
      if (at < 0 || [...builtIns.values()].includes(at)) continue;
      const text = (row[at] ?? '').trim();
      if (!text) continue;
      const v = customValue(f, text);
      if (v !== undefined) fields[f.id] = v;
    }
    const valid = validateFields(fields, 'create');
    if (!valid.ok) {
      skipped++;
      continue;
    }
    creates.push({ type: type.id, fields: valid.fields, place: { status } });
  }
  return { creates, skipped };
}

// What the board says once an import is done (docs/specs/026-plan/plan-board.md "CSV").
export function boardCsvMessage(result: {
  added: number;
  skipped: number;
  refusal?: BoardCsvRefusal;
}): string {
  if (result.refusal === 'no_title_column') return 'No Title column in the file';
  if (result.refusal === 'no_types') return 'This board takes no card types';
  if (result.refusal === 'archive') return 'Cards cannot be imported onto an Archive board';
  const rows = (n: number) => `${n} ${n === 1 ? 'row' : 'rows'}`;
  if (result.added === 0)
    return result.skipped ? `No cards added; skipped ${rows(result.skipped)}` : 'No cards to add';
  const added = `Added ${result.added} ${result.added === 1 ? 'card' : 'cards'}`;
  return result.skipped ? `${added}; skipped ${rows(result.skipped)}` : added;
}

// Whether this board takes an import at all (not an Archive board).
export function boardTakesCsv(setup: Pick<PlanBoardSetup, 'archive'>): boolean {
  return setup.archive !== true;
}
