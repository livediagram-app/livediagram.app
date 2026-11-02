// A Linear issues CSV export (Settings, Import and export, Export CSV) as a TrackerBoard
// (docs/specs/026-plan/tracker-import.md "Fields"). Statuses are the columns in the order rows name them; an archived
// issue is left out. Linear's CSV carries no comments or attachments.
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
  type TrackerExtra,
  type TrackerExtraValue,
  type TrackerSkips,
} from './tracker-model';
import { trackerDay, trackerEstimate, trackerPersonOf, trackerPriority } from './tracker-text';

const EXTRAS: readonly TrackerExtra[] = [
  { key: 'id', label: 'ID', kind: 'text' },
  { key: 'project', label: 'Project', kind: 'text' },
  { key: 'cycle', label: 'Cycle', kind: 'text' },
  { key: 'team', label: 'Team', kind: 'text' },
];

// Whether a CSV header is Linear's.
export function isLinearHeader(row: Row | undefined): boolean {
  const h = readHeader(row);
  return ['id', 'title', 'status', 'team'].every((k) => h.at(k) !== undefined);
}

export function readLinearRows(rows: readonly Row[]): TrackerBoard {
  const h = readHeader(rows[0]);
  const at = {
    id: h.at('id'),
    title: h.at('title'),
    description: h.at('description'),
    status: h.at('status'),
    priority: h.at('priority'),
    estimate: h.at('estimate'),
    assignee: h.at('assignee'),
    labels: h.at('labels'),
    started: h.at('started'),
    due: h.at('duedate'),
    project: h.at('project'),
    cycleName: h.at('cyclename'),
    cycleNumber: h.at('cyclenumber'),
    team: h.at('team'),
    archived: h.at('archived'),
  };
  const skips: TrackerSkips = {};
  const columns = new ColumnOrder();
  const extras = new ExtraCollector(EXTRAS);
  const cards: TrackerCard[] = [];
  for (const row of rows.slice(1)) {
    if (isEmptyRow(row)) continue;
    const name = cardTitle(cellAt(row, at.title));
    if (!name) {
      addSkip(skips, 'untitledRows');
      continue;
    }
    if (cellAt(row, at.archived).trim()) {
      addSkip(skips, 'archivedCards');
      continue;
    }
    const own: Record<string, TrackerExtraValue> = {};
    extras.text(own, 'id', cellAt(row, at.id));
    extras.text(own, 'project', cellAt(row, at.project));
    extras.text(own, 'cycle', cellAt(row, at.cycleName).trim() || cellAt(row, at.cycleNumber));
    extras.text(own, 'team', cellAt(row, at.team));
    const assignee = trackerPersonOf(cellAt(row, at.assignee));
    const priority = trackerPriority(cellAt(row, at.priority));
    const estimate = trackerEstimate(cellAt(row, at.estimate));
    const start = trackerDay(cellAt(row, at.started));
    const due = trackerDay(cellAt(row, at.due));
    cards.push({
      ...blankCard(name, columns.add(cellAt(row, at.status))),
      description: cardDescription(cellAt(row, at.description)),
      labels: cardLabels(cellAt(row, at.labels).split(',')),
      extras: own,
      ...(assignee ? { assignee } : {}),
      ...(priority ? { priority } : {}),
      ...(estimate !== undefined ? { estimate } : {}),
      ...(start ? { start } : {}),
      ...(due ? { due } : {}),
    });
  }
  return {
    source: 'linear',
    title: '',
    columns: columns.list,
    cards,
    extras: extras.fields(),
    skips,
  };
}
