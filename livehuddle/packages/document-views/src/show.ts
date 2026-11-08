// One element in full (docs/specs/024-agents/blueprints/document-views.md "show", VW34): its geometry, every stored
// field, a table's cells, its comments. Mirrors, packed points and person ids are left out and named. A stored
// arrow (a retired element, part 4 of the element engine) shows its stored fields, its ends among them, and no
// element lists arrows in or out.
import type { ShowView, ViewDoor } from '@livehuddle/api-schema';
import { contentOrigin, type Element } from '@livehuddle/document';
import {
  fitLines,
  fitOf,
  type ViewLine,
  type ViewResult,
} from '@liveworkspace/document-views/budget';
import { LABEL_CUT_CHARS } from './constants';
import {
  arrayField,
  boxOf,
  isObject,
  numberField,
  textField,
  threadOf,
} from '@liveworkspace/document-views/fields';
import { headerLine, viewHeader } from './header';
import type { ViewModel } from './model';
import { commentText, readComment } from './comments';
import { cellText, jsonString } from '@liveworkspace/document-views/text';

type ShowOptions = { budget?: number; door?: ViewDoor };

const LINE = { one: 'line', many: 'lines' };

// Fields printed on the first line, on `at`, or in their own block.
const SHOWN_ELSEWHERE = new Set([
  'id',
  'type',
  'shape',
  'label',
  'x',
  'y',
  'width',
  'height',
  'rotation',
]);
const BLOCK_FIELDS = new Set(['cells', 'entityFields', 'commentThread']);
// Plain-text mirrors' runs and packed geometry: noise beside the fields they mirror.
const MIRROR_FIELDS = ['richText', 'noteRich', 'packedPoints'];

// Every person id an element can hold, as `field` or `field.path` (`[]` for each item of a list).
export const PERSON_ID_FIELDS = [
  'commentThread.comments[].authorId',
  'commentThread.comments[].mentions[].userId',
  'commentThread.comments[].mentions[].memberId',
  'action.assignerId',
  'action.assignee.userId',
  'action.assignee.memberId',
  'action.teamId',
  'actions[].assignerId',
  'actions[].assignee.userId',
  'actions[].assignee.memberId',
  'actions[].teamId',
  // A retired element's stored answers and Q&A votes (docs/specs/002-project-scope/not-in-livehuddle.md): kept as
  // stored, so their person ids are still held back.
  'responses[].participantId',
  'qaNotes[].voters',
  // Which Participant added a sticky or text (docs/specs/013-workspace/share-roles.md): the room's record, a key
  // that ties one person's additions together, so it never leaves through a view either.
  'addedBy',
] as const;

// `each`: every item of a list (`[]`).
type Segment = { key: string; each: boolean };
type Path = readonly [Segment, ...Segment[]];
type Stripped<T> = { value: T; removed: boolean };

// `qaNotes[].voters` → [{ qaNotes, each }, { voters }].
function pathOf(field: string): Path {
  const [first, ...rest] = field.split('.').map((part) => ({
    key: part.replace(/\[\]$/, ''),
    each: part.endsWith('[]'),
  }));
  return [first!, ...rest];
}

function isPath(segments: readonly Segment[]): segments is Path {
  return segments.length > 0;
}

function asRecord(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value));
}

// The record with the person id at `path` removed, and whether one was there.
function stripRecord(
  record: Readonly<Record<string, unknown>>,
  path: Path,
): Stripped<Record<string, unknown>> {
  const [segment, ...rest] = path;
  const copy = { ...record };
  if (!(segment.key in copy)) return { value: copy, removed: false };
  if (!isPath(rest)) {
    delete copy[segment.key];
    return { value: copy, removed: true };
  }
  const child = copy[segment.key];
  if (segment.each) {
    if (!Array.isArray(child)) return { value: copy, removed: false };
    const items = child.map((item: unknown) => stripValue(item, rest));
    copy[segment.key] = items.map((item) => item.value);
    return { value: copy, removed: items.some((item) => item.removed) };
  }
  const inner = stripValue(child, rest);
  copy[segment.key] = inner.value;
  return { value: copy, removed: inner.removed };
}

function stripValue(value: unknown, path: Path): Stripped<unknown> {
  if (!isObject(value) || Array.isArray(value)) return { value, removed: false };
  return stripRecord(asRecord(value), path);
}

// The element's fields with person ids and mirrors taken out, and the names of what was taken.
export function shownFields(el: Element): { fields: Record<string, unknown>; omitted: string[] } {
  let fields = asRecord(el);
  const omitted: string[] = [];
  for (const field of PERSON_ID_FIELDS) {
    const result = stripRecord(fields, pathOf(field));
    fields = result.value;
    if (result.removed) omitted.push(field);
  }
  for (const key of MIRROR_FIELDS) {
    if (!(key in fields)) continue;
    delete fields[key];
    omitted.push(key);
  }
  return { fields, omitted };
}

function labelOf(el: Element): string {
  const label = textField(el, 'label');
  return label === null ? '' : ` ${jsonString(label, LABEL_CUT_CHARS)}`;
}

// What every shown element of one model reads: the content origin. Built once per model, so showing every selected
// element is linear in the tab, not selected x tab.
const origins = new WeakMap<ViewModel, ReturnType<typeof contentOrigin>>();

function originOf(model: ViewModel): ReturnType<typeof contentOrigin> {
  const known = origins.get(model);
  if (known) return known;
  const origin = contentOrigin(model.printed);
  origins.set(model, origin);
  return origin;
}

function blockLines(el: Element, fields: Record<string, unknown>): ViewLine[] {
  const lines: ViewLine[] = [];
  const rows = arrayField(fields, 'cells');
  if (rows.length > 0) {
    lines.push({ text: '  cells:', noun: LINE });
    for (const row of rows) {
      const cells = (Array.isArray(row) ? row : []).map((c: unknown) =>
        cellText(typeof c === 'string' ? c : ''),
      );
      lines.push({ text: `    | ${cells.join(' | ')} |`, noun: LINE });
    }
  }
  const thread = threadOf(el);
  if (thread !== null) {
    lines.push({
      text: `  comments: ${thread.resolved ? 'resolved' : 'open'} · ${thread.comments.length}`,
      noun: LINE,
    });
    for (const c of thread.comments) {
      lines.push({ text: `    ${commentText(readComment(c))}`, noun: LINE });
    }
  }
  return lines;
}

type ShownElement = Omit<ShowView, 'header'>;

// One printed element of the model in full: its lines after the header, and its JSON.
export function showElement(
  model: ViewModel,
  el: Element,
): { lines: ViewLine[]; json: ShownElement } {
  const ref = model.refs.refOf(el.id);
  const kind = model.kindOf(el);
  const origin = originOf(model);
  const { fields, omitted } = shownFields(el);

  const box = boxOf(el);
  const rotation = Math.round(numberField(el, 'rotation') ?? 0);
  const placement =
    box === null
      ? []
      : [
          `  at ${Math.round(box.x - origin.x)},${Math.round(box.y - origin.y)} ${Math.round(box.width)}x${Math.round(box.height)}${rotation !== 0 ? ` r=${rotation}` : ''}`,
        ];
  const fieldLines = Object.keys(fields)
    .filter((key) => !SHOWN_ELSEWHERE.has(key) && !BLOCK_FIELDS.has(key))
    .sort()
    .map((key) => ({ text: `  ${key}: ${JSON.stringify(fields[key])}`, noun: LINE }));
  const lines: ViewLine[] = [
    { text: `${kind} ${ref}${labelOf(el)}`, noun: LINE },
    ...placement.map((text) => ({ text, noun: LINE })),
    ...fieldLines,
    ...blockLines(el, fields),
    ...(omitted.length > 0 ? [{ text: `  omitted: ${omitted.join(', ')}`, noun: LINE }] : []),
  ];
  const { id: _id, type: _type, ...jsonFields } = fields;
  return {
    lines,
    json: {
      ref,
      kind,
      // Nothing holds an element since part 3 of the element engine; kept on the wire as null.
      container: null,
      fields: jsonFields,
      // Kept on the wire, empty: no arrow is an edge since part 4 of the element engine.
      incoming: [],
      outgoing: [],
      omitted,
    },
  };
}

// `el` is a printed element of the model.
export function showView(
  model: ViewModel,
  el: Element,
  options: ShowOptions = {},
): ViewResult<ShowView> {
  const { lines, json } = showElement(model, el);
  const fitted = fitLines({
    header: headerLine(model.facts),
    lines,
    budget: options.budget,
    door: options.door ?? 'cli',
  });
  return {
    text: fitted.text,
    fit: fitOf(fitted),
    json: { header: viewHeader('show', model.facts), ...json },
  };
}
