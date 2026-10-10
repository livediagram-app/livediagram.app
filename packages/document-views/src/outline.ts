// The outline (docs/specs/024-agents/document-views.md "The outline"): one line per element, indentation
// for containment, outgoing arrows on their source's line, fitted to a budget down a fixed ladder
// (blueprint "Budgets", VW38).
import type { FreehandRunJson, OutlineNode, OutlineView, ViewDoor } from '@livediagram/api-schema';
import { isKnownElement, type Element } from '@livediagram/document';
import { attributesOf, isOpenCommentsAttribute } from './attributes';
import { contentSummaryOf } from './content-summary';
import { edgeJson, edgeText, ownLineText, type ViewEdge } from './edges';
import { estimateTokens, type ViewResult } from './budget';
import {
  buildElision,
  collapsedPartsOf,
  elisionCommand,
  elisionLine,
  elisionText,
  type ElisionArguments,
} from './elision';
import { textField } from './fields';
import { headerLine, viewHeader } from './header';
import type { ViewModel } from './model';
import { stateAttributeOf } from './state-attribute';
import { styleAttributesOf, styleBaselines, type StyleBaselines } from './style-attributes';
import { ELISION_CONTAINERS_NAMED, LABEL_CUT_CHARS } from './constants';
import { jsonString } from './text';
import {
  isViewRun,
  subtreeItems,
  type FreehandRunItem,
  type ViewItem,
  type ViewNode,
} from './tree';
import type { ViewAttribute } from './view-attribute';

export type OutlineOptions = {
  // The id of the element whose subtree to print, resolved by the caller.
  only?: string;
  style?: boolean;
  budget?: number;
  door?: ViewDoor;
};

// Full detail, notes dropped, attributes dropped (an open comment count kept).
type Level = 0 | 1 | 2;
const LEVELS: readonly Level[] = [0, 1, 2];

export type OutlineState =
  'full' | 'notes-dropped' | 'attributes-dropped' | 'containers-collapsed' | 'root-collapsed';

type EntryLine =
  | { kind: 'node'; node: ViewNode }
  | { kind: 'run'; run: FreehandRunItem }
  | { kind: 'arrow'; edge: ViewEdge };

type Entry = {
  line: EntryLine;
  depth: number;
  // The line at each level.
  texts: readonly [string, string, string];
  // Printed elements this line carries: a node and the arrows on its line, a run's strokes, an arrow.
  elements: number;
  // The index after its last descendant line.
  end: number;
};

export type OutlineResult = ViewResult<OutlineView> & {
  state: OutlineState;
  // The estimate of the whole outline, unfitted.
  fullTokens: number;
};

function nodeAttributes(
  model: ViewModel,
  el: Element,
  style: StyleBaselines | null,
): ViewAttribute[] {
  return [...stateAttributeOf(el), ...attributesOf(el, { tabRefOf: model.tabRefOf, style })];
}

function attributesAt(attributes: readonly ViewAttribute[], level: Level): ViewAttribute[] {
  if (level === 2) return attributes.filter(isOpenCommentsAttribute);
  return level === 1 ? attributes.filter((a) => a.key !== 'note') : [...attributes];
}

function edgeExtras(edge: ViewEdge, style: StyleBaselines | null, level: Level): string[] {
  return style === null || level === 2
    ? []
    : styleAttributesOf(edge.arrow, style).map((a) => a.text);
}

function nodeLine(
  model: ViewModel,
  node: ViewNode,
  depth: number,
  level: Level,
  style: StyleBaselines | null,
): string {
  const label = textField(node.el, 'label');
  const summary = level === 2 ? null : contentSummaryOf(node.el);
  const attributes = attributesAt(nodeAttributes(model, node.el, style), level);
  const edges = model.edges.bySource.get(node.el.id) ?? [];
  const parts = [
    model.kindOf(node.el),
    model.refs.refOf(node.el.id),
    ...(label === null ? [] : [jsonString(label, LABEL_CUT_CHARS)]),
    ...(summary === null ? [] : [summary]),
    ...attributes.map((a) => a.text),
  ];
  const arrows = edges.map((edge) => edgeText(edge, edgeExtras(edge, style, level)));
  return `${'  '.repeat(depth)}${parts.join(' ')}${arrows.length ? ` → ${arrows.join(', ')}` : ''}`;
}

function runLine(run: FreehandRunItem, depth: number): string {
  const closed = run.closed > 0 ? ` (${run.closed} closed)` : '';
  return `${'  '.repeat(depth)}freehand ×${run.strokes.length}${closed}`;
}

function buildEntries(
  model: ViewModel,
  items: readonly ViewItem[],
  ownLine: readonly ViewEdge[],
  style: StyleBaselines | null,
): Entry[] {
  const entries: Entry[] = [];
  const walk = (item: ViewItem, depth: number) => {
    const at = entries.length;
    if (isViewRun(item)) {
      const text = runLine(item, depth);
      entries.push({
        line: { kind: 'run', run: item },
        depth,
        texts: [text, text, text],
        elements: item.strokes.length,
        end: at + 1,
      });
      return;
    }
    const texts = LEVELS.map((level) => nodeLine(model, item, depth, level, style));
    const edges = model.edges.bySource.get(item.el.id)?.length ?? 0;
    const entry: Entry = {
      line: { kind: 'node', node: item },
      depth,
      texts: [texts[0]!, texts[1]!, texts[2]!],
      elements: 1 + edges,
      end: 0,
    };
    entries.push(entry);
    for (const child of item.children) walk(child, depth + 1);
    entry.end = entries.length;
  };
  for (const item of items) walk(item, 0);
  for (const edge of ownLine) {
    const texts = LEVELS.map((level) => ownLineText(edge, edgeExtras(edge, style, level)));
    entries.push({
      line: { kind: 'arrow', edge },
      depth: 0,
      texts: [texts[0]!, texts[1]!, texts[2]!],
      elements: 1,
      end: entries.length + 1,
    });
  }
  return entries;
}

// A container whose children a budget left out: its entry, its node and the elements beneath it.
type Collapse = { index: number; node: ViewNode; elements: number };

// The fitted shape: the detail level, the collapsed containers, whether the root went.
type Fit = { level: Level; collapsed: Collapse[]; root: boolean };

type Measure = {
  // Joined length of the header and the lines a fit keeps, the root collapse aside.
  length: (fit: Fit) => number;
  elementsUnder: (index: number) => number;
  // Joined length of entries `from` to `to` (exclusive) at a level, each with its newline.
  range: (level: Level, from: number, to: number) => number;
};

function measure(entries: readonly Entry[], header: string): Measure {
  // Prefix sums of (line length + 1) per level, and of elements carried.
  const sums = LEVELS.map((level) => {
    const out = [0];
    for (const entry of entries) out.push(out.at(-1)! + entry.texts[level].length + 1);
    return out;
  });
  const elements = [0];
  for (const entry of entries) elements.push(elements.at(-1)! + entry.elements);
  const range = (level: Level, from: number, to: number) => sums[level]![to]! - sums[level]![from]!;
  return {
    length: ({ level, collapsed }) => {
      const hidden = collapsed.reduce(
        (n, c) => n + range(level, c.index + 1, entries[c.index]!.end),
        0,
      );
      return header.length + range(level, 0, entries.length) - hidden;
    },
    elementsUnder: (i) => elements[entries[i]!.end]! - elements[i + 1]!,
    range,
  };
}

function elisionOf(
  model: ViewModel,
  entries: readonly Entry[],
  fit: Fit,
  fullTokens: number,
  door: ViewDoor,
) {
  const dropped = (['notes', 'attributes'] as const).slice(0, fit.level);
  const collapsed = [...fit.collapsed]
    .sort((a, b) => a.index - b.index)
    .map((c) => ({
      ref: model.refs.refOf(c.node.el.id),
      kind: model.kindOf(c.node.el),
      elements: c.elements,
    }));
  const inCollapsed = collapsed.reduce((n, c) => n + c.elements, 0);
  const total = entries.reduce((n, e) => n + e.elements, 0);
  const omitted = fit.root
    ? [{ noun: total - inCollapsed === 1 ? 'element' : 'elements', count: total - inCollapsed }]
    : [];
  if (dropped.length === 0 && collapsed.length === 0 && omitted.length === 0) return null;
  const largest = collapsed.reduce<(typeof collapsed)[number] | null>(
    (best, c) => (best === null || c.elements > best.elements ? c : best),
    null,
  );
  const args: ElisionArguments = largest === null ? { budget: fullTokens } : { only: largest.ref };
  return buildElision(
    {
      dropped: [...dropped],
      collapsed,
      omitted,
    },
    args,
    door,
  );
}

function fitOutline(
  model: ViewModel,
  entries: readonly Entry[],
  header: string,
  budget: number | undefined,
  door: ViewDoor,
): { fit: Fit; state: OutlineState; fullTokens: number } {
  const m = measure(entries, header);
  const full: Fit = { level: 0, collapsed: [], root: false };
  const fullTokens = estimateTokens(m.length(full));
  if (budget === undefined) return { fit: full, state: 'full', fullTokens };
  const tokens = (fit: Fit) => {
    const elision = elisionOf(model, entries, fit, fullTokens, door);
    return estimateTokens(m.length(fit) + (elision === null ? 0 : elisionLine(elision).length + 1));
  };
  if (tokens(full) <= budget) return { fit: full, state: 'full', fullTokens };
  const notes: Fit = { ...full, level: 1 };
  if (tokens(notes) <= budget) return { fit: notes, state: 'notes-dropped', fullTokens };
  const attributes: Fit = { ...full, level: 2 };
  if (tokens(attributes) <= budget)
    return { fit: attributes, state: 'attributes-dropped', fullTokens };
  // Largest container first (most elements beneath it; the earlier on a tie). An ancestor holds more
  // than any descendant, so it comes first, and a descendant of a collapsed container is skipped.
  const candidates = entries
    .flatMap((entry, index): Collapse[] =>
      entry.line.kind === 'node' && entry.end > index + 1
        ? [{ index, node: entry.line.node, elements: m.elementsUnder(index) }]
        : [],
    )
    .sort((a, b) => b.elements - a.elements || a.index - b.index);
  // Each step adds one collapse and measures in O(ELISION_CONTAINERS_NAMED): the hidden length and the elided
  // totals are kept running, entries inside a collapse are marked once (collapses never nest), and the elision
  // line is measured from its named containers (the first collapsed, being the largest) and the rest's totals.
  // Rebuilding the fit and its elision per step was quadratic: 1.3 s for 4,000 frames at the MCP budget.
  const collapsed: Collapse[] = [];
  const inside = new Uint8Array(entries.length);
  let hiddenLength = 0;
  let restElements = 0;
  const dropped = ['notes', 'attributes'];
  const collapsedTokens = () => {
    const named = collapsed.slice(0, ELISION_CONTAINERS_NAMED).map((c) => ({
      ref: model.refs.refOf(c.node.el.id),
      kind: model.kindOf(c.node.el),
      elements: c.elements,
    }));
    const rest = { count: collapsed.length - named.length, elements: restElements };
    const command = elisionCommand({ only: named[0]!.ref }, door);
    const line = elisionText(dropped, collapsedPartsOf(named, rest), [], command);
    return estimateTokens(m.length(attributes) - hiddenLength + line.length + 1);
  };
  for (const candidate of candidates) {
    if (inside[candidate.index] === 1) continue;
    const end = entries[candidate.index]!.end;
    inside.fill(1, candidate.index + 1, end);
    hiddenLength += m.range(2, candidate.index + 1, end);
    if (collapsed.length >= ELISION_CONTAINERS_NAMED) restElements += candidate.elements;
    collapsed.push(candidate);
    if (collapsedTokens() <= budget)
      return { fit: { ...attributes, collapsed }, state: 'containers-collapsed', fullTokens };
  }
  return { fit: { ...attributes, collapsed, root: true }, state: 'root-collapsed', fullTokens };
}

function runJson(model: ViewModel, run: FreehandRunItem): FreehandRunJson {
  return {
    run: 'freehand',
    refs: run.strokes.map((s) => model.refs.refOf(s.el.id)),
    closed: run.closed,
  };
}

function nodeJson(
  model: ViewModel,
  node: ViewNode,
  level: Level,
  style: StyleBaselines | null,
  collapsedIds: ReadonlyMap<string, number>,
): OutlineNode {
  const label = textField(node.el, 'label');
  const collapsed = collapsedIds.get(node.el.id) ?? 0;
  return {
    ref: model.refs.refOf(node.el.id),
    id: node.el.id,
    kind: model.kindOf(node.el),
    unknown: !isKnownElement(node.el),
    label,
    summary: level === 2 ? null : contentSummaryOf(node.el),
    attributes: attributesAt(nodeAttributes(model, node.el, style), level).map(
      ({ key, value }) => ({ key, value }),
    ),
    edges: (model.edges.bySource.get(node.el.id) ?? []).map(edgeJson),
    children:
      collapsed > 0
        ? []
        : node.children.map((child) =>
            isViewRun(child)
              ? runJson(model, child)
              : nodeJson(model, child, level, style, collapsedIds),
          ),
    collapsed,
  };
}

export function outlineView(model: ViewModel, options: OutlineOptions = {}): OutlineResult {
  const door = options.door ?? 'cli';
  const style = options.style ? styleBaselines() : null;
  const items = subtreeItems(model.tree, options.only);
  const ownLine = options.only === undefined ? model.edges.ownLine : [];
  const entries = buildEntries(model, items, ownLine, style);
  const header = headerLine(model.facts);
  const { fit, state, fullTokens } = fitOutline(model, entries, header, options.budget, door);
  const elision = elisionOf(model, entries, fit, fullTokens, door);

  const hidden = new Set<number>();
  for (const c of fit.collapsed) {
    for (let i = c.index + 1; i < entries[c.index]!.end; i++) hidden.add(i);
  }
  const lines = fit.root
    ? []
    : entries.filter((_, i) => !hidden.has(i)).map((entry) => entry.texts[fit.level]);
  const text = [header, ...lines, ...(elision === null ? [] : [elisionLine(elision)])].join('\n');

  const collapsedIds = new Map(fit.collapsed.map((c) => [c.node.el.id, c.elements]));
  const json: OutlineView = {
    header: viewHeader('outline', model.facts),
    nodes: fit.root
      ? []
      : items.map((item) =>
          isViewRun(item)
            ? runJson(model, item)
            : nodeJson(model, item, fit.level, style, collapsedIds),
        ),
    ownLineArrows: fit.root ? [] : ownLine.map(edgeJson),
    elision,
  };
  return { text, json, state, fullTokens, fit: { estimate: fullTokens, state } };
}

// One element's outline line at full detail: what `find` prints for a match.
export function outlineLine(model: ViewModel, node: ViewNode, depth: number): string {
  return nodeLine(model, node, depth, 0, null);
}
