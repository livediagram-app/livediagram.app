// An Asana project's CSV export (the project's menu, Export or sync, CSV) as a TrackerBoard
// (docs/specs/026-plan/tracker-import.md "Fields"). Sections are the columns in the order rows name them; a completed
// task goes to a Completed column after every section. Asana's CSV carries no comments or attachments.
import {
  ColumnOrder,
  ExtraCollector,
  blankCard,
  cardDescription,
  cardLabels,
  cardTitle,
  cellAt,
  isEmptyRow,
  readHeader,
  type Row,
} from './tracker-columns';
import {
  addSkip,
  type TrackerBoard,
  type TrackerCard,
  type TrackerExtraValue,
} from './tracker-model';
import type { TrackerSkips } from './tracker-model';
import { trackerDay, trackerPersonOf, trackerPriority } from './tracker-text';

export const ASANA_COMPLETED_COLUMN = 'Completed';

// Whether a CSV header is Asana's.
export function isAsanaHeader(row: Row | undefined): boolean {
  const h = readHeader(row);
  return h.at('taskid') !== undefined && h.at('sectioncolumn') !== undefined;
}

export function readAsanaRows(rows: readonly Row[]): TrackerBoard {
  const h = readHeader(rows[0]);
  const at = {
    name: h.at('name'),
    section: h.at('sectioncolumn'),
    notes: h.at('notes'),
    email: h.at('assigneeemail'),
    assignee: h.at('assignee'),
    start: h.at('startdate'),
    due: h.at('duedate'),
    tags: h.at('tags'),
    completed: h.at('completedat'),
    projects: h.at('projects'),
    priority: h.at('priority'),
  };
  const skips: TrackerSkips = {};
  const columns = new ColumnOrder();
  const extras = new ExtraCollector([{ key: 'projects', label: 'Projects', kind: 'text' }]);
  const cards: TrackerCard[] = [];
  let completed = false;
  for (const row of rows.slice(1)) {
    if (isEmptyRow(row)) continue;
    const name = cardTitle(cellAt(row, at.name));
    if (!name) {
      addSkip(skips, 'untitledRows');
      continue;
    }
    const done = cellAt(row, at.completed).trim() !== '';
    completed ||= done;
    const section = columns.add(cellAt(row, at.section));
    const own: Record<string, TrackerExtraValue> = {};
    extras.text(own, 'projects', cellAt(row, at.projects));
    const assignee = trackerPersonOf(cellAt(row, at.assignee), cellAt(row, at.email));
    const priority = trackerPriority(cellAt(row, at.priority));
    const start = trackerDay(cellAt(row, at.start));
    const due = trackerDay(cellAt(row, at.due));
    cards.push({
      ...blankCard(name, done ? ASANA_COMPLETED_COLUMN : section),
      description: cardDescription(cellAt(row, at.notes)),
      labels: cardLabels(cellAt(row, at.tags).split(',')),
      extras: own,
      ...(assignee ? { assignee } : {}),
      ...(priority ? { priority } : {}),
      ...(start ? { start } : {}),
      ...(due ? { due } : {}),
    });
  }
  // A section only completed tasks named stays a column; the Completed column comes after them all.
  const list = [...columns.list];
  if (completed && !list.includes(ASANA_COMPLETED_COLUMN)) list.push(ASANA_COMPLETED_COLUMN);
  return {
    source: 'asana',
    title: '',
    columns: list,
    cards,
    extras: extras.fields(),
    skips,
  };
}
