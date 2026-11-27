// What Plan AI is sent of the open tab (docs/specs/026-plan/plan-ai.md "What it may change"): the tab as plain text, in
// the names its changes take back (column, card type and field names; card numbers; A1 cells; question ids; rows and
// slots by number), cut to PLAN_AI_TAB_MAX with a line saying what was left out. Pure, and linear in what the tab
// holds: read when a turn is sent, never on load.
import {
  boardShowsType,
  cardRefOrKey,
  isArchived,
  isItemPerson,
  isTrashed,
  itemStatus,
  itemTitle,
  PLAN_AI_TAB_MAX,
  typeIn,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import {
  QUESTION_TYPES,
  questionsOf,
  type FormDefinition,
  type FormQuestion,
} from '@liveplanner/forms';
import type { DashboardContent, DashboardLayout } from '@liveplanner/project';
import { columnLetters, readRange, type Workbook } from '@liveplanner/sheets';

/** One value cut short for the read. */
const VALUE_MAX = 160;
const DESCRIPTION_MAX = 200;

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

// A field's value as words: a person by name, a list joined, a flag as yes; anything else (a structure) left out.
export function valueText(value: unknown, items?: ReadonlyMap<string, Item>): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const linked = items?.get(value);
    return cut(linked ? itemTitle(linked) : value.replace(/\s+/g, ' ').trim(), VALUE_MAX);
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'yes' : null;
  if (isItemPerson(value)) return value.name;
  if (Array.isArray(value)) {
    const parts = value.map((v) => valueText(v, items)).filter((v): v is string => !!v);
    return parts.length ? cut(parts.join(', '), VALUE_MAX) : null;
  }
  return null;
}

/** Text kept within the bound: lines until the next would pass it, then a line saying how many were left out. */
export function withinBound(
  head: readonly string[],
  lines: readonly string[],
  what: string,
): string {
  const out = [...head];
  let size = out.join('\n').length;
  for (const [i, line] of lines.entries()) {
    if (size + line.length + 1 > PLAN_AI_TAB_MAX - 120) {
      out.push(`(${lines.length - i} more ${what} left out: too many to send.)`);
      break;
    }
    out.push(line);
    size += line.length + 1;
  }
  return out.join('\n');
}

const BUILT_IN_SHOWN: readonly [string, string][] = [
  ['assignee', 'Assignee'],
  ['priority', 'Priority'],
  ['start', 'Start'],
  ['due', 'Due'],
  ['labels', 'Labels'],
  ['estimate', 'Estimate'],
];

function typeLine(type: ItemTypeDef): string {
  const fields = (type.custom ?? []).map((f) =>
    f.options?.length
      ? `${f.label} (${f.kind}: ${f.options.join(', ')})`
      : `${f.label} (${f.kind})`,
  );
  return `- ${type.label}${fields.length ? `: ${fields.join('; ')}` : ''}`;
}

function cardLine(
  item: Item,
  types: readonly ItemTypeDef[],
  items: ReadonlyMap<string, Item>,
): string {
  const type = typeIn(types, item.type);
  const parts = [`${cardRefOrKey(item, types)} ${itemTitle(item)}`, `type ${type.label}`];
  for (const [key, label] of BUILT_IN_SHOWN) {
    const v = valueText(item.fields[key], items);
    if (v) parts.push(`${label}: ${v}`);
  }
  for (const field of type.custom ?? []) {
    const v = valueText(item.fields[field.id], items);
    if (v) parts.push(`${field.label}: ${v}`);
  }
  if (item.fields['flagged'] === true) parts.push('Flagged');
  const description = item.fields['description'];
  if (typeof description === 'string' && description.trim())
    parts.push(`Description: ${cut(description.replace(/\s+/g, ' ').trim(), DESCRIPTION_MAX)}`);
  return `- ${parts.join(' | ')}`;
}

/** A board: its columns, the card types it takes with their fields, and its cards by column. */
export function readBoard(input: {
  setup: PlanBoardSetup;
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
}): string {
  const { setup, items, types } = input;
  const taken = types.filter((t) => boardShowsType(setup, t.id, types));
  const head = [
    `Board "${setup.title}"`,
    `Columns, left to right: ${setup.columns.map((c) => c.name).join(', ') || 'none'}`,
    'Card types it takes, each with its own fields (every card also has Title, Description, Assignee, Priority, ' +
      'Start, Due and Labels):',
    ...(taken.length ? taken.map(typeLine) : ['- none yet']),
  ];
  const byStatus = new Map<string, Item[]>();
  for (const item of items.values()) {
    if (isTrashed(item) || (isArchived(item) && !setup.archive)) continue;
    if (!boardShowsType(setup, item.type, types)) continue;
    const status = itemStatus(item);
    if (!status) continue;
    const list = byStatus.get(status) ?? [];
    list.push(item);
    byStatus.set(status, list);
  }
  const lines: string[] = [];
  for (const column of setup.columns) {
    const cards = (byStatus.get(column.status) ?? []).sort((a, b) =>
      a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0,
    );
    lines.push(
      `Column "${column.name}" (${cards.length} ${cards.length === 1 ? 'card' : 'cards'}):`,
    );
    for (const item of cards) lines.push(cardLine(item, types, items));
  }
  return withinBound(head, lines, 'lines of cards');
}

/** A sheet: its title and size, and each row's cells that hold anything, as typed (a formula with what it shows). */
export function readSheet(wb: Workbook, sheetId: string): string | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return null;
  const read = readRange(wb, sheetId);
  if (!read.ok) return null;
  const extent = wb.extent(sheetId);
  const head = [
    `Sheet "${sheet.title}": ${extent.rows} rows by ${extent.cols} columns used` +
      (extent.cols ? ` (A to ${columnLetters(extent.cols - 1)})` : ''),
  ];
  const lines: string[] = [];
  read.rows.forEach((row, r) => {
    const cells: string[] = [];
    row.forEach((cell, c) => {
      if (cell.input === '' && (cell.value === null || cell.value === '')) return;
      const at = `${columnLetters(c)}${r + 1}`;
      const shown = cut(cell.display, VALUE_MAX);
      cells.push(
        cell.input.startsWith('=')
          ? `${at} ${cut(cell.input, VALUE_MAX)} → ${shown}`
          : `${at} ${cut(cell.input || shown, VALUE_MAX)}`,
      );
    });
    if (cells.length) lines.push(cells.join(' | '));
  });
  if (lines.length === 0) lines.push('(The sheet is empty.)');
  if (read.truncated) lines.push(`(Rows from ${read.rest} not read.)`);
  return withinBound(head, lines, 'rows');
}

function questionLine(q: FormQuestion): string {
  const parts = [`[${q.id}] ${q.type}: "${q.prompt}"`];
  if (q.required) parts.push('required');
  if (q.options?.length) parts.push(`options: ${q.options.join(', ')}`);
  if (q.help) parts.push(`help: "${cut(q.help, VALUE_MAX)}"`);
  return `- ${parts.join(' | ')}`;
}

/** A form: its heading and description, its sections and their questions with ids, and the question kinds. */
export function readFormTab(form: FormDefinition): string {
  const head = [
    `Form "${form.heading}"`,
    ...(form.description ? [`Description: ${cut(form.description, 400)}`] : []),
    `Question kinds: ${QUESTION_TYPES.filter((t) => t !== 'content').join(', ')}`,
    `${questionsOf(form).length} questions in ${form.sections.length} ${form.sections.length === 1 ? 'section' : 'sections'}:`,
  ];
  const lines: string[] = [];
  form.sections.forEach((section, i) => {
    lines.push(`Section ${i + 1}${section.title ? ` "${section.title}"` : ''}:`);
    for (const q of section.questions) if (q.type !== 'content') lines.push(questionLine(q));
  });
  return withinBound(head, lines, 'questions');
}

function contentText(
  content: DashboardContent | undefined,
  tabName: (tabId: string) => string | undefined,
): string {
  if (!content) return 'empty';
  switch (content.type) {
    case 'tab':
      return `the ${content.of ?? 'board'} tab "${tabName(content.tabId) ?? 'a deleted tab'}"`;
    case 'element':
      return content.name ? `a view "${content.name}"` : 'a view or chart';
    case 'note':
      return `a note "${content.title}": ${cut(content.text, VALUE_MAX)}`;
    case 'title':
      return `a title "${content.title}"`;
    default:
      return content.type;
  }
}

/** A dashboard: its rows top to bottom, each its height and its slots with their spans and what they show, and the
 *  Board and Sheet tabs a slot may show. */
export function readDashboard(
  layout: DashboardLayout,
  tabs: readonly { id: string; name: string; kind?: string }[],
): string {
  const name = (id: string) => tabs.find((t) => t.id === id)?.name;
  const shown = tabs.filter((t) => t.kind === 'board' || t.kind === 'sheet');
  const head = [
    `Dashboard of ${layout.rows.length} ${layout.rows.length === 1 ? 'row' : 'rows'}`,
    `Board and Sheet tabs a slot can show: ${shown.map((t) => `"${t.name}" (${t.kind})`).join(', ') || 'none'}`,
  ];
  const lines = layout.rows.map(
    (row, r) =>
      `Row ${r + 1}, ${row.height} px tall: ` +
      row.slots
        .map(
          (slot, s) => `slot ${s + 1} (span ${slot.span}) shows ${contentText(slot.content, name)}`,
        )
        .join('; '),
  );
  if (lines.length === 0) lines.push('(No rows yet.)');
  return withinBound(head, lines, 'rows');
}
