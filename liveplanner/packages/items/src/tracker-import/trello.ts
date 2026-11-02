// A Trello board's JSON export (Board menu, Print and export, Export as JSON) as a TrackerBoard
// (docs/specs/026-plan/tracker-import.md "Fields"). Lists, members, checklists and comments are indexed by id once, so
// reading is linear in the file. A value of the wrong type reads as empty; nothing here throws.
import type { Priority } from '../fields';
import { PLAN_TITLE_MAX } from '../limits';
import {
  ColumnOrder,
  ExtraCollector,
  blankCard,
  cardDescription,
  cardLabels,
  cardTitle,
  checklistRows,
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
  type TrackerPerson,
  type TrackerSkips,
} from './tracker-model';
import { cleanText, httpLink, trackerDay, trackerInstant, trackerPersonOf } from './tracker-text';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const objects = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const byPos = (a: Obj, b: Obj) => num(a['pos']) - num(b['pos']);

const MEMBERS: TrackerExtra = { key: 'members', label: 'Members', kind: 'person', several: true };

// Priorities a Trello label may be named, read as the card's priority rather than as a label.
const PRIORITY_LABELS: readonly Priority[] = ['urgent', 'high', 'medium', 'low'];

// Whether a JSON value is a Trello board export: an object with lists and cards.
export function isTrelloBoard(json: unknown): json is Obj {
  return isObj(json) && Array.isArray(json['lists']) && Array.isArray(json['cards']);
}

function groupBy(list: Obj[], key: (o: Obj) => string): Map<string, Obj[]> {
  const out = new Map<string, Obj[]>();
  for (const o of list) {
    const k = key(o);
    if (!k) continue;
    out.set(k, [...(out.get(k) ?? []), o]);
  }
  return out;
}

// Each card's comments, oldest first (Trello lists its actions newest first).
function commentsOf(actions: Obj[]): Map<string, TrackerComment[]> {
  const out = new Map<string, TrackerComment[]>();
  for (const a of actions) {
    if (a['type'] !== 'commentCard') continue;
    const data = isObj(a['data']) ? a['data'] : {};
    const cardId = isObj(data['card']) ? str(data['card']['id']) : '';
    const text = cleanText(data['text'], TRACKER_COMMENT_TEXT_MAX);
    if (!cardId || !text) continue;
    const by = isObj(a['memberCreator']) ? a['memberCreator'] : {};
    const comment = {
      author: cleanText(str(by['fullName']) || str(by['username']), 60),
      at: trackerInstant(a['date']),
      text,
    };
    const list = out.get(cardId);
    if (list) list.push(comment);
    else out.set(cardId, [comment]);
  }
  for (const list of out.values()) list.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  return out;
}

function labelNames(
  card: Obj,
  boardLabels: Map<string, Obj>,
): { labels: string[]; priority?: Priority } {
  const raw = Array.isArray(card['labels'])
    ? objects(card['labels'])
    : (Array.isArray(card['idLabels']) ? card['idLabels'] : [])
        .map((id) => boardLabels.get(str(id)))
        .filter(isObj);
  let priority: Priority | undefined;
  const names: string[] = [];
  for (const l of raw) {
    const name = str(l['name']).trim() || str(l['color']);
    const asPriority = PRIORITY_LABELS.find((p) => p === name.toLowerCase());
    if (asPriority && !priority) priority = asPriority;
    else names.push(name);
  }
  return { labels: cardLabels(names), ...(priority ? { priority } : {}) };
}

function linksOf(card: Obj, skips: TrackerSkips): TrackerLink[] {
  const links: TrackerLink[] = [];
  for (const a of objects(card['attachments'])) {
    const url = httpLink(a['url']);
    if (!url) {
      addSkip(skips, 'attachmentsNoLink');
      continue;
    }
    links.push({ name: cleanText(a['name'], 120) || url, url });
  }
  addSkip(skips, 'attachmentLinks', links.length);
  return links;
}

function checklistOf(
  card: Obj,
  byId: Map<string, Obj>,
  byCard: Map<string, Obj[]>,
): TrackerCard['checklist'] {
  const lists = Array.isArray(card['idChecklists'])
    ? card['idChecklists'].map((id) => byId.get(str(id))).filter(isObj)
    : [...(byCard.get(str(card['id'])) ?? [])];
  lists.sort(byPos);
  // A card of several checklists names each item after its checklist ("QA: Test on Safari").
  const named = lists.length > 1;
  return checklistRows(
    lists.flatMap((list) =>
      objects(list['checkItems'])
        .sort(byPos)
        .map((item) => ({
          text: named ? `${str(list['name']).trim()}: ${str(item['name'])}` : item['name'],
          done: item['state'] === 'complete',
        })),
    ),
  );
}

export function readTrelloBoard(json: Obj): TrackerBoard {
  const skips: TrackerSkips = {};
  const openLists = new Map<string, Obj>();
  for (const l of objects(json['lists']).sort(byPos)) {
    if (l['closed'] === true) addSkip(skips, 'archivedLists');
    else openLists.set(str(l['id']), l);
  }
  const listIndex = new Map([...openLists.keys()].map((id, i) => [id, i]));
  const members = new Map(objects(json['members']).map((m) => [str(m['id']), m]));
  const boardLabels = new Map(objects(json['labels']).map((l) => [str(l['id']), l]));
  const checklists = objects(json['checklists']);
  const checklistById = new Map(checklists.map((c) => [str(c['id']), c]));
  const checklistsByCard = groupBy(checklists, (c) => str(c['idCard']));
  const comments = commentsOf(objects(json['actions']));
  const columns = new ColumnOrder();
  for (const l of openLists.values()) columns.add(l['name']);
  const extras = new ExtraCollector([MEMBERS]);

  const kept = objects(json['cards']).filter((c) => {
    const open = c['closed'] !== true && listIndex.has(str(c['idList']));
    if (!open) addSkip(skips, 'archivedCards');
    return open;
  });
  kept.sort(
    (a, b) => listIndex.get(str(a['idList']))! - listIndex.get(str(b['idList']))! || byPos(a, b),
  );

  const cards: TrackerCard[] = [];
  for (const c of kept) {
    const column = columns.add(openLists.get(str(c['idList']))!['name']);
    const people = (Array.isArray(c['idMembers']) ? c['idMembers'] : [])
      .map((id) => members.get(str(id)))
      .filter(isObj)
      .map((m) => trackerPersonOf(str(m['fullName']) || str(m['username'])))
      .filter((p): p is TrackerPerson => !!p);
    const { labels, priority } = labelNames(c, boardLabels);
    const due = trackerDay(c['due']);
    const start = trackerDay(c['start']);
    const own: Record<string, TrackerExtraValue> = {};
    // Members as a field only when a card has more than its Assignee.
    if (people.length > 1) extras.person(own, 'members', people);
    cards.push({
      ...blankCard(cardTitle(c['name']) || 'Untitled', column),
      description: cardDescription(c['desc']),
      labels,
      checklist: checklistOf(c, checklistById, checklistsByCard),
      comments: comments.get(str(c['id'])) ?? [],
      links: linksOf(c, skips),
      extras: own,
      ...(people[0] ? { assignee: people[0] } : {}),
      ...(priority ? { priority } : {}),
      ...(due ? { due } : {}),
      ...(start ? { start } : {}),
    });
  }
  // Once the field exists, a card with one member lists it there too.
  const fields = extras.fields();
  if (fields.length)
    for (const card of cards)
      if (card.assignee && !card.extras['members']) card.extras['members'] = [card.assignee];
  return {
    source: 'trello',
    title: cleanText(json['name'], PLAN_TITLE_MAX),
    columns: columns.list,
    cards,
    extras: fields,
    skips,
  };
}
