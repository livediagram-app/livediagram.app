// One element in full (docs/specs/024-agents/blueprints/document-views.md "show", VW34): its container,
// geometry or ends, every stored field, a table's cells, an entity's fields, its comments and its
// arrows both ways. Mirrors, packed points and person ids are left out and named.
import type { ShowView, ViewDoor } from '@livediagram/api-schema';
import { contentOrigin, type Element, type Endpoint } from '@livediagram/document';
import { fitLines, fitOf, type ViewLine, type ViewResult } from './budget';
import { LABEL_CUT_CHARS } from './constants';
import { edgeJson, endText, type ViewEdge } from './edges';
import {
  arrayField,
  boxOf,
  isObject,
  numberField,
  stringField,
  textField,
  threadOf,
} from './fields';
import { headerLine, viewHeader } from './header';
import { layoutEndText } from './layout';
import type { ViewModel } from './model';
import { commentText, readComment } from './comments';
import { cellText, jsonString } from './text';

export type ShowOptions = { budget?: number; door?: ViewDoor };

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
  'from',
  'to',
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
  'responses[].participantId',
  'qaNotes[].voters',
] as const;

type Segment = { key: string; each: boolean };
type Path = readonly [Segment, ...Segment[]];
type Stripped<T> = { value: T; removed: boolean };

// `qaNotes[].voters` → [{ qaNotes, each }, { voters }].
function pathOf(field: string): Path {
  const [first, ...rest] = field
    .split('.')
    .map((part) => ({ key: part.replace(/\[\]$/, ''), each: part.endsWith('[]') }));
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

function labelOf(el: Element | undefined): string {
  const label = el === undefined ? null : textField(el, 'label');
  return label === null ? '' : ` ${jsonString(label, LABEL_CUT_CHARS)}`;
}

function edgeLines(model: ViewModel, edges: readonly ViewEdge[], direction: '←' | '→'): ViewLine[] {
  return edges.map((edge) => {
    const other = direction === '←' ? edge.arrow.from : edge.arrow.to;
    const end = direction === '←' ? edge.from : edge.to;
    const otherEl = other.kind === 'pinned' ? model.tree.nodes.get(other.elementId)?.el : undefined;
    const label = edge.label === null ? '' : ` label=${jsonString(edge.label, LABEL_CUT_CHARS)}`;
    return {
      text: `  ${direction} ${endText(end)}${labelOf(otherEl)}${label} [${edge.ref}]`,
      noun: LINE,
    };
  });
}

// Whether an arrow end is pinned to, or rides on, the element.
function names(end: Endpoint, id: string): boolean {
  if (end.kind === 'pinned') return end.elementId === id;
  return end.kind === 'on-arrow' && end.arrowId === id;
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
  const entityFields = arrayField(fields, 'entityFields').filter(isObject);
  if (entityFields.length > 0) {
    lines.push({ text: '  fields:', noun: LINE });
    for (const field of entityFields) {
      const type = stringField(field, 'type');
      const name = cellText(stringField(field, 'name') ?? '');
      lines.push({ text: `    - ${name}${type === null ? '' : ` ${cellText(type)}`}`, noun: LINE });
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

// `el` is a printed element of the model.
export function showView(
  model: ViewModel,
  el: Element,
  options: ShowOptions = {},
): ViewResult<ShowView> {
  const ref = model.refs.refOf(el.id);
  const kind = model.kindOf(el);
  const node = model.tree.nodes.get(el.id);
  const container = node?.container == null ? undefined : model.tree.nodes.get(node.container)?.el;
  const origin = contentOrigin(model.printed);
  const { fields, omitted } = shownFields(el);
  const incoming = model.edges.all.filter((edge) => names(edge.arrow.to, el.id));
  const outgoing = model.edges.all.filter((edge) => names(edge.arrow.from, el.id));

  const inPart =
    container === undefined
      ? ''
      : ` in ${model.kindOf(container)} ${model.refs.refOf(container.id)}${labelOf(container)}`;
  const box = boxOf(el);
  const rotation = Math.round(numberField(el, 'rotation') ?? 0);
  const placement =
    el.type === 'arrow'
      ? [`  ${layoutEndText(el.from, model, origin)} → ${layoutEndText(el.to, model, origin)}`]
      : box === null
        ? []
        : [
            `  at ${Math.round(box.x - origin.x)},${Math.round(box.y - origin.y)} ${Math.round(box.width)}x${Math.round(box.height)}${rotation !== 0 ? ` r=${rotation}` : ''}`,
          ];
  const fieldLines = Object.keys(fields)
    .filter((key) => !SHOWN_ELSEWHERE.has(key) && !BLOCK_FIELDS.has(key))
    .sort()
    .map((key) => ({ text: `  ${key}: ${JSON.stringify(fields[key])}`, noun: LINE }));
  const lines: ViewLine[] = [
    { text: `${kind} ${ref}${labelOf(el)}${inPart}`, noun: LINE },
    ...placement.map((text) => ({ text, noun: LINE })),
    ...fieldLines,
    ...blockLines(el, fields),
    ...edgeLines(model, incoming, '←'),
    ...edgeLines(model, outgoing, '→'),
    ...(omitted.length > 0 ? [{ text: `  omitted: ${omitted.join(', ')}`, noun: LINE }] : []),
  ];
  const fitted = fitLines({
    header: headerLine(model.facts),
    lines,
    budget: options.budget,
    door: options.door ?? 'cli',
  });
  const { id: _id, type: _type, ...jsonFields } = fields;
  return {
    text: fitted.text,
    fit: fitOf(fitted),
    json: {
      header: viewHeader('show', model.facts),
      ref,
      kind,
      container:
        container === undefined
          ? null
          : {
              ref: model.refs.refOf(container.id),
              kind: model.kindOf(container),
              label: textField(container, 'label'),
            },
      fields: jsonFields,
      incoming: incoming.map(edgeJson),
      outgoing: outgoing.map(edgeJson),
      omitted,
    },
  };
}
