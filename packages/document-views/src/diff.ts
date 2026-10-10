// What changed between two reads of a tab (docs/specs/024-agents/blueprints/document-views.md "diff",
// VW36), in the outline's terms. The CLI computes it from the tab it cached; no api door serves it.
import type { DiffView, ViewDoor } from '@livediagram/api-schema';
import { STYLE_KEYS, type Element, type Endpoint, type Tab } from '@livediagram/document';
import { attributesOf } from './attributes';
import { fitLines, fitOf, type ViewLine, type ViewResult } from './budget';
import { LABEL_CUT_CHARS } from './constants';
import { contentSummaryOf } from './content-summary';
import { edgeText, endText, type ViewEdge } from './edges';
import { boxOf, fieldOf, numberField, textField, threadOf } from './fields';
import { viewHeader } from './header';
import { buildViewModel, type ViewContext, type ViewModel } from './model';
import { stateAttributeOf } from './state-attribute';
import { attrValue, jsonString, plural } from './text';
import type { ViewAttribute } from './view-attribute';

export type DiffContext = { since: number; rev: number; tabIds?: readonly string[] };
export type DiffOptions = { budget?: number; door?: ViewDoor };

type Change = {
  text: string;
  field: string;
  before: unknown;
  after: unknown;
  covers: readonly string[];
};
type DiffChange = DiffView['changes'][number];

const CHANGE = { one: 'change', many: 'changes' };
const NONE = 'none';

// The stored fields each kind of change speaks for; anything else that differs is an "other field".
const SUMMARY_SOURCES = [
  'cells',
  'entityFields',
  'code',
  'codeLanguage',
  'pieSlices',
  'lineSeries',
  'lineCategories',
  'checklistItems',
];
const ATTRIBUTE_SOURCES = [
  'iconId',
  'link',
  'alt',
  'locked',
  'action',
  'actions',
  'esDraft',
  'responses',
  'responsesRevealed',
  'ideaCards',
  'ideasRevealed',
  'qaNotes',
  'agendaItems',
  'agendaCurrent',
  'decisionStatus',
  'rollCall',
  'quizRevealed',
  'quizLockedAt',
  'quizStartedAt',
  'pickerResult',
  'revealed',
  'stats',
  'processSteps',
  'navLinks',
  'legendItems',
  'rating',
  'progress',
  'railCount',
  'pageTitle',
];
const STYLE_FIELDS = STYLE_KEYS.map((k) => k.field);
const ALWAYS_COVERED = ['id', 'packedPoints'];

const labelText = (el: Element) => {
  const label = textField(el, 'label');
  return label === null ? NONE : jsonString(label, LABEL_CUT_CHARS);
};
const signed = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n)}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function attributeMap(model: ViewModel, el: Element): Map<string, ViewAttribute> {
  const attributes = [
    ...stateAttributeOf(el),
    ...attributesOf(el, { tabRefOf: model.tabRefOf, style: null }),
  ].filter((a) => a.key !== 'note' && a.key !== 'comments');
  return new Map(attributes.map((a) => [a.key, a]));
}

const attributeValue = (a: ViewAttribute | undefined) =>
  a === undefined ? NONE : a.value === null ? 'on' : attrValue(a.value);

function threadState(el: Element): string {
  const thread = threadOf(el);
  return thread === null
    ? NONE
    : `${thread.comments.length} ${thread.resolved ? 'resolved' : 'open'}`;
}

// Two reads have two ref tables: one added id can lengthen another's ref. So changes compare ids, and refs are
// only how a change prints.
const containerIdOf = (model: ViewModel, id: string): string | null =>
  model.tree.nodes.get(id)?.container ?? null;
const containerText = (model: ViewModel, id: string | null): string =>
  id === null ? 'canvas' : model.refs.refOf(id);
const endpointKey = (end: Endpoint): string =>
  end.kind === 'pinned'
    ? `pinned ${end.elementId}`
    : end.kind === 'on-arrow'
      ? `arrow ${end.arrowId}`
      : `free ${end.x},${end.y}`;

// A printed arrow's edge; every printed arrow has one.
function edgeOf(model: ViewModel, id: string): ViewEdge {
  return model.edges.byArrow.get(id)!;
}

// `arrow 202b → 7180 "label" [5d21]`.
function arrowLine(model: ViewModel, id: string): string {
  const edge = edgeOf(model, id);
  return `arrow ${endText(edge.from)} → ${edgeText(edge)} [${edge.ref}]`;
}

function changesOf(before: ViewModel, after: ViewModel, a: Element, b: Element): Change[] {
  const changes: Change[] = [];
  const add = (
    field: string,
    text: string,
    was: unknown,
    now: unknown,
    covers: readonly string[] = [],
  ) => changes.push({ text, field, before: was, after: now, covers });

  const [kindA, kindB] = [before.kindOf(a), after.kindOf(b)];
  if (kindA !== kindB)
    add('kind', `kind ${kindA} → ${kindB}`, kindA, kindB, ['type', 'shape', 'esKind']);
  if (textField(a, 'label') !== textField(b, 'label')) {
    add(
      'label',
      `label ${labelText(a)} → ${labelText(b)}`,
      textField(a, 'label'),
      textField(b, 'label'),
      ['label', 'richText'],
    );
  }
  const [noteA, noteB] = [textField(a, 'note'), textField(b, 'note')];
  if (noteA !== noteB) {
    const how = noteA === null ? 'added' : noteB === null ? 'removed' : 'changed';
    add('note', `note ${how}`, noteA, noteB, ['note', 'noteRich']);
  }
  if (b.type !== 'arrow') {
    const [idA, idB] = [containerIdOf(before, a.id), containerIdOf(after, b.id)];
    if (idA !== idB) {
      const [inA, inB] = [containerText(before, idA), containerText(after, idB)];
      add('in', `in ${inA} → ${inB}`, inA, inB);
    }
  }
  const [sumA, sumB] = [contentSummaryOf(a), contentSummaryOf(b)];
  if (sumA !== sumB)
    add('summary', `${sumA ?? NONE} → ${sumB ?? NONE}`, sumA, sumB, SUMMARY_SOURCES);
  const [attrsA, attrsB] = [attributeMap(before, a), attributeMap(after, b)];
  for (const key of new Set([...attrsB.keys(), ...attrsA.keys()])) {
    const [was, now] = [attributeValue(attrsA.get(key)), attributeValue(attrsB.get(key))];
    if (was !== now) add(key, `${key} ${was} → ${now}`, was, now, ATTRIBUTE_SOURCES);
  }
  const [threadA, threadB] = [threadState(a), threadState(b)];
  if (threadA !== threadB)
    add('comments', `comments ${threadA} → ${threadB}`, threadA, threadB, ['commentThread']);
  if (a.type === 'arrow' && b.type === 'arrow') {
    const [edgeA, edgeB] = [edgeOf(before, a.id), edgeOf(after, b.id)];
    for (const end of ['from', 'to'] as const) {
      if (endpointKey(a[end]) === endpointKey(b[end])) continue;
      const [was, now] = [endText(edgeA[end]), endText(edgeB[end])];
      add(end, `${end} ${was} → ${now}`, was, now, [end]);
    }
  }
  const [boxA, boxB] = [boxOf(a), boxOf(b)];
  if (boxA !== null && boxB !== null) {
    if (boxA.x !== boxB.x || boxA.y !== boxB.y) {
      const delta = `${signed(boxB.x - boxA.x)},${signed(boxB.y - boxA.y)}`;
      add('moved', `moved ${delta}`, { x: boxA.x, y: boxA.y }, { x: boxB.x, y: boxB.y }, [
        'x',
        'y',
      ]);
    }
    if (boxA.width !== boxB.width || boxA.height !== boxB.height) {
      const delta = `${signed(boxB.width - boxA.width)},${signed(boxB.height - boxA.height)}`;
      add(
        'resized',
        `resized ${delta}`,
        { w: boxA.width, h: boxA.height },
        { w: boxB.width, h: boxB.height },
        ['width', 'height'],
      );
    }
  }
  const [rotA, rotB] = [numberField(a, 'rotation') ?? 0, numberField(b, 'rotation') ?? 0];
  if (rotA !== rotB) add('rotated', 'rotated', rotA, rotB, ['rotation']);
  if (STYLE_FIELDS.some((field) => !same(fieldOf(a, field), fieldOf(b, field)))) {
    add('restyled', 'restyled', null, null, STYLE_FIELDS);
  }
  const covered = new Set([...ALWAYS_COVERED, ...changes.flatMap((c) => c.covers)]);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const others = [...keys].filter(
    (key) => !covered.has(key) && !same(fieldOf(a, key), fieldOf(b, key)),
  );
  if (others.length > 0)
    add(
      'other',
      `+${others.length} other ${others.length === 1 ? 'field' : 'fields'}`,
      null,
      others,
    );
  return changes;
}

function elementLine(model: ViewModel, el: Element): string {
  const label = textField(el, 'label');
  return `${model.kindOf(el)} ${model.refs.refOf(el.id)}${label === null ? '' : ` ${jsonString(label, LABEL_CUT_CHARS)}`}`;
}

function addedLine(model: ViewModel, el: Element): string {
  if (el.type === 'arrow') return `+ ${arrowLine(model, el.id)}`;
  const container = model.tree.nodes.get(el.id)?.container ?? null;
  const containerEl = container === null ? null : model.tree.nodes.get(container)!.el;
  const inPart =
    containerEl === null
      ? ''
      : ` in ${model.refs.refOf(containerEl.id)}${textField(containerEl, 'label') === null ? '' : ` ${labelText(containerEl)}`}`;
  return `+ ${elementLine(model, el)}${inPart}`;
}

function removedLine(model: ViewModel, el: Element): string {
  if (el.type === 'arrow') return `- ${arrowLine(model, el.id)}`;
  return `- ${elementLine(model, el)}`;
}

function diffEntry(
  model: ViewModel,
  el: Element,
  op: DiffChange['op'],
  changes: DiffChange['changes'] = [],
): DiffChange {
  return {
    op,
    ref: model.refs.refOf(el.id),
    kind: model.kindOf(el),
    label: textField(el, 'label'),
    changes,
  };
}

export function diffView(
  beforeTab: Tab,
  afterTab: Tab,
  context: DiffContext,
  options: DiffOptions = {},
): ViewResult<DiffView> {
  const viewContext: ViewContext = { tabIds: context.tabIds };
  const before = buildViewModel(beforeTab, { ...viewContext, rev: context.since });
  const after = buildViewModel(afterTab, { ...viewContext, rev: context.rev });
  const beforeById = new Map(before.printed.map((el) => [el.id, el]));
  const afterIds = new Set(after.printed.map((el) => el.id));

  const lines: ViewLine[] = [];
  const entries: DiffChange[] = [];
  for (const el of before.printed) {
    if (afterIds.has(el.id)) continue;
    lines.push({ text: removedLine(before, el), noun: CHANGE });
    entries.push(diffEntry(before, el, '-'));
  }
  for (const el of after.printed) {
    const was = beforeById.get(el.id);
    if (was === undefined) {
      lines.push({ text: addedLine(after, el), noun: CHANGE });
      entries.push(diffEntry(after, el, '+'));
      continue;
    }
    const changes = changesOf(before, after, was, el);
    if (changes.length === 0) continue;
    lines.push({
      text: `~ ${after.kindOf(el)} ${after.refs.refOf(el.id)} ${changes.map((c) => c.text).join(' · ')}`,
      noun: CHANGE,
    });
    entries.push(
      diffEntry(
        after,
        el,
        '~',
        changes.map(({ field, before: b, after: a }) => ({ field, before: b, after: a })),
      ),
    );
  }

  const facts = after.facts;
  const header = `tab ${facts.tab.ref} ${jsonString(facts.tab.name)} · since rev ${context.since} · rev ${context.rev} · ${plural(entries.length, 'change', 'changes')}`;
  const fitted = fitLines({ header, lines, budget: options.budget, door: options.door ?? 'cli' });
  return {
    text: fitted.text,
    fit: fitOf(fitted),
    json: {
      header: viewHeader('diff', facts),
      since: context.since,
      changes: entries.slice(0, fitted.kept),
      elision: fitted.elision,
    },
  };
}
