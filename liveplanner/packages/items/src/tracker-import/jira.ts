// A Jira issues CSV export (the issue search's Export, CSV all fields) as a TrackerBoard
// (docs/specs/026-plan/tracker-import.md "Fields"). Jira writes one column per value of a repeated field (Labels,
// Comment, Sprint, Attachment, Component/s), so those are read across every column of their name. A comment cell is
// `{date};{author};{text}` and an attachment `{date};{author};{name};{url}`; the author is often an account id, named
// through the file's own Assignee, Reporter and Creator columns when it can be.
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
  type Header,
  type Row,
} from './tracker-columns';
import {
  TRACKER_COMMENT_TEXT_MAX,
  addSkip,
  type TrackerBoard,
  type TrackerCard,
  type TrackerComment,
  type TrackerExtra,
  type TrackerExtraValue,
  type TrackerLink,
  type TrackerSkips,
} from './tracker-model';
import {
  cleanText,
  httpLink,
  trackerDay,
  trackerEstimate,
  trackerInstant,
  trackerPersonOf,
  trackerPriority,
} from './tracker-text';

const EXTRAS: readonly TrackerExtra[] = [
  { key: 'issuekey', label: 'Issue Key', from: 'Issue key', kind: 'text' },
  { key: 'issuetype', label: 'Issue Type', kind: 'choice' },
  { key: 'reporter', label: 'Reporter', kind: 'person' },
  { key: 'sprint', label: 'Sprint', kind: 'text' },
  { key: 'components', label: 'Components', from: 'Component/s', kind: 'text' },
];

// What a comment's author reads as when the file names only an account id nobody in it has.
const UNKNOWN_AUTHOR = 'Jira user';
const ACCOUNT_ID = /^[0-9a-z:-]{12,}$/i;

// Whether a CSV header is Jira's.
export function isJiraHeader(row: Row | undefined): boolean {
  const h = readHeader(row);
  return h.at('issuekey') !== undefined && h.at('summary') !== undefined;
}

const values = (row: Row, indexes: readonly number[]) =>
  indexes.map((i) => cellAt(row, i).trim()).filter(Boolean);

// The people the file names by id, from each person column and its `… Id` partner.
function namesById(rows: readonly Row[], h: Header): Map<string, string> {
  const out = new Map<string, string>();
  for (const role of ['assignee', 'reporter', 'creator']) {
    const name = h.at(role);
    const id = h.at(`${role}id`);
    if (name === undefined || id === undefined) continue;
    for (const row of rows) {
      const key = cellAt(row, id).trim();
      const shown = cellAt(row, name).trim();
      if (key && shown) out.set(key, shown);
    }
  }
  return out;
}

function authorOf(raw: string, names: Map<string, string>): string {
  const known = names.get(raw);
  if (known) return cleanText(known, 60);
  return ACCOUNT_ID.test(raw) && !/\s/.test(raw) ? UNKNOWN_AUTHOR : cleanText(raw, 60);
}

function commentOf(cell: string, names: Map<string, string>): TrackerComment | undefined {
  const first = cell.indexOf(';');
  const second = first < 0 ? -1 : cell.indexOf(';', first + 1);
  const at = first < 0 ? null : trackerInstant(cell.slice(0, first));
  // A cell that is not `{date};{author};{text}` is all text, from no one known.
  if (second < 0 || at === null) {
    const text = cleanText(cell, TRACKER_COMMENT_TEXT_MAX);
    return text ? { author: '', at: null, text } : undefined;
  }
  const text = cleanText(cell.slice(second + 1), TRACKER_COMMENT_TEXT_MAX);
  if (!text) return undefined;
  return { author: authorOf(cell.slice(first + 1, second).trim(), names), at, text };
}

function linkOf(cell: string, skips: TrackerSkips): TrackerLink | undefined {
  const parts = cell.split(';');
  const url = httpLink(parts.slice(3).join(';'));
  if (!url) {
    addSkip(skips, 'attachmentsNoLink');
    return undefined;
  }
  addSkip(skips, 'attachmentLinks');
  return { name: cleanText(parts[2], 120) || url, url };
}

export function readJiraRows(rows: readonly Row[]): TrackerBoard {
  const h = readHeader(rows[0]);
  const at = {
    summary: h.at('summary'),
    key: h.at('issuekey'),
    type: h.at('issuetype'),
    status: h.at('status'),
    priority: h.at('priority'),
    assignee: h.at('assignee'),
    reporter: h.at('reporter'),
    description: h.at('description'),
    due: h.at('duedate'),
    start: h.containing('startdate'),
    points: h.containing('storypoint'),
  };
  const many = {
    labels: h.all('labels'),
    comments: h.all('comment'),
    sprints: h.all('sprint'),
    attachments: h.all('attachment'),
    components: [...h.all('components'), ...h.all('component')],
  };
  const names = namesById(rows.slice(1), h);
  const skips: TrackerSkips = {};
  const columns = new ColumnOrder();
  const extras = new ExtraCollector(EXTRAS);
  const cards: TrackerCard[] = [];
  for (const row of rows.slice(1)) {
    if (isEmptyRow(row)) continue;
    const summary = cardTitle(cellAt(row, at.summary));
    if (!summary) {
      addSkip(skips, 'untitledRows');
      continue;
    }
    const own: Record<string, TrackerExtraValue> = {};
    extras.text(own, 'issuekey', cellAt(row, at.key));
    extras.text(own, 'issuetype', cellAt(row, at.type));
    const reporter = trackerPersonOf(cellAt(row, at.reporter));
    if (reporter) extras.person(own, 'reporter', [reporter]);
    extras.text(own, 'sprint', values(row, many.sprints).at(-1));
    extras.text(own, 'components', values(row, many.components).join(', '));
    const assignee = trackerPersonOf(cellAt(row, at.assignee));
    const priority = trackerPriority(cellAt(row, at.priority));
    const estimate = trackerEstimate(cellAt(row, at.points));
    const start = trackerDay(cellAt(row, at.start));
    const due = trackerDay(cellAt(row, at.due));
    cards.push({
      ...blankCard(summary, columns.add(cellAt(row, at.status))),
      description: cardDescription(cellAt(row, at.description)),
      labels: cardLabels(values(row, many.labels)),
      comments: values(row, many.comments)
        .map((c) => commentOf(c, names))
        .filter((c): c is TrackerComment => !!c)
        .sort((a, b) => (a.at ?? 0) - (b.at ?? 0)),
      links: values(row, many.attachments)
        .map((c) => linkOf(c, skips))
        .filter((l): l is TrackerLink => !!l),
      extras: own,
      ...(assignee ? { assignee } : {}),
      ...(priority ? { priority } : {}),
      ...(estimate !== undefined ? { estimate } : {}),
      ...(start ? { start } : {}),
      ...(due ? { due } : {}),
    });
  }
  return {
    source: 'jira',
    title: '',
    columns: columns.list,
    cards,
    extras: extras.fields(),
    skips,
  };
}
