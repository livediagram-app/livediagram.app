// The outline (docs/specs/024-agents/document-views.md "The outline"): one line per element, flat (nothing
// nests since part 3 of the element engine, docs/specs/002-project-scope/not-in-livehuddle.md), fitted to a budget
// down a fixed ladder (blueprint "Budgets", VW38). A stored arrow prints on its own line as `? arrow`, like any
// retired element (part 4): no arrow is an edge.
import type { FreehandRunJson, OutlineNode, OutlineView, ViewDoor } from '@livehuddle/api-schema';
import { isKnownElement, type Element } from '@livehuddle/document';
import { attributesOf, isOpenCommentsAttribute } from './attributes';
import { estimateTokens, type ViewResult } from '@liveworkspace/document-views/budget';
import { buildElision, elisionLine } from '@liveworkspace/document-views/elision';
import { textField } from '@liveworkspace/document-views/fields';
import { headerLine, viewHeader } from './header';
import type { ViewModel } from './model';
import { styleBaselines, type StyleBaselines } from './style-attributes';
import { LABEL_CUT_CHARS } from './constants';
import { jsonString } from '@liveworkspace/document-views/text';
import {
  isViewRun,
  subtreeItems,
  type FreehandRunItem,
  type ViewItem,
  type ViewNode,
} from './tree';
import type { ViewAttribute } from '@liveworkspace/document-views/view-attribute';

type OutlineOptions = {
  // The id of the element whose subtree to print, resolved by the caller.
  only?: string;
  style?: boolean;
  budget?: number;
  door?: ViewDoor;
};

// Full detail, notes dropped, attributes dropped (an open comment count kept).
type Level = 0 | 1 | 2;
const LEVELS: readonly Level[] = [0, 1, 2];

type OutlineState = 'full' | 'notes-dropped' | 'attributes-dropped' | 'lines-dropped';

type EntryLine = { kind: 'node'; node: ViewNode } | { kind: 'run'; run: FreehandRunItem };

type Entry = {
  line: EntryLine;
  // The line at each level.
  texts: readonly [string, string, string];
  // Printed elements this line carries: a node, or a run's strokes.
  elements: number;
};

type OutlineResult = ViewResult<OutlineView> & {
  state: OutlineState;
  // The estimate of the whole outline, unfitted.
  fullTokens: number;
};

function nodeAttributes(
  model: ViewModel,
  el: Element,
  style: StyleBaselines | null,
): ViewAttribute[] {
  return attributesOf(el, { tabRefOf: model.tabRefOf, style });
}

function attributesAt(attributes: readonly ViewAttribute[], level: Level): ViewAttribute[] {
  if (level === 2) return attributes.filter(isOpenCommentsAttribute);
  return level === 1 ? attributes.filter((a) => a.key !== 'note') : [...attributes];
}

function nodeLine(
  model: ViewModel,
  node: ViewNode,
  level: Level,
  style: StyleBaselines | null,
): string {
  const label = textField(node.el, 'label');
  const attributes = attributesAt(nodeAttributes(model, node.el, style), level);
  const parts = [
    model.kindOf(node.el),
    model.refs.refOf(node.el.id),
    ...(label === null ? [] : [jsonString(label, LABEL_CUT_CHARS)]),
    ...attributes.map((a) => a.text),
  ];
  return parts.join(' ');
}

function runLine(run: FreehandRunItem): string {
  const closed = run.closed > 0 ? ` (${run.closed} closed)` : '';
  return `freehand ×${run.strokes.length}${closed}`;
}

function buildEntries(
  model: ViewModel,
  items: readonly ViewItem[],
  style: StyleBaselines | null,
): Entry[] {
  return items.map((item): Entry => {
    if (isViewRun(item)) {
      const text = runLine(item);
      return {
        line: { kind: 'run', run: item },
        texts: [text, text, text],
        elements: item.strokes.length,
      };
    }
    const texts = LEVELS.map((level) => nodeLine(model, item, level, style));
    return {
      line: { kind: 'node', node: item },
      texts: [texts[0]!, texts[1]!, texts[2]!],
      elements: 1,
    };
  });
}

// The fitted shape: the detail level, and how many of the leading lines are kept.
type Fit = { level: Level; kept: number };

type Measure = {
  // Joined length of the header and the first `kept` lines at a level, each line with its newline.
  length: (level: Level, kept: number) => number;
  // Printed elements the lines from `kept` on carry.
  elementsFrom: (kept: number) => number;
};

function measure(entries: readonly Entry[], header: string): Measure {
  const sums = LEVELS.map((level) => {
    const out = [header.length];
    for (const entry of entries) out.push(out.at(-1)! + entry.texts[level].length + 1);
    return out;
  });
  const elements = [0];
  for (const entry of entries) elements.push(elements.at(-1)! + entry.elements);
  return {
    length: (level, kept) => sums[level]![kept]!,
    elementsFrom: (kept) => elements.at(-1)! - elements[kept]!,
  };
}

function elisionOf(m: Measure, fit: Fit, fullTokens: number, door: ViewDoor) {
  const dropped = (['notes', 'attributes'] as const).slice(0, fit.level);
  const hidden = m.elementsFrom(fit.kept);
  const omitted =
    hidden > 0 ? [{ noun: hidden === 1 ? 'element' : 'elements', count: hidden }] : [];
  if (dropped.length === 0 && omitted.length === 0) return null;
  return buildElision(
    { dropped: [...dropped], collapsed: [], omitted },
    { budget: fullTokens },
    door,
  );
}

// Down the ladder: notes, then attributes, then the trailing lines, as few as the budget asks. Each step is measured
// from prefix sums, so the fit is linear in the outline however many lines go.
function fitOutline(
  entries: readonly Entry[],
  m: Measure,
  budget: number | undefined,
  door: ViewDoor,
): { fit: Fit; state: OutlineState; fullTokens: number } {
  const all = entries.length;
  const full: Fit = { level: 0, kept: all };
  const fullTokens = estimateTokens(m.length(0, all));
  if (budget === undefined) return { fit: full, state: 'full', fullTokens };
  const tokens = (fit: Fit) => {
    const elision = elisionOf(m, fit, fullTokens, door);
    return estimateTokens(
      m.length(fit.level, fit.kept) + (elision === null ? 0 : elisionLine(elision).length + 1),
    );
  };
  if (tokens(full) <= budget) return { fit: full, state: 'full', fullTokens };
  const notes: Fit = { level: 1, kept: all };
  if (tokens(notes) <= budget) return { fit: notes, state: 'notes-dropped', fullTokens };
  const attributes: Fit = { level: 2, kept: all };
  if (tokens(attributes) <= budget)
    return { fit: attributes, state: 'attributes-dropped', fullTokens };
  let kept = all - 1;
  while (kept > 0 && tokens({ level: 2, kept }) > budget) kept -= 1;
  return { fit: { level: 2, kept }, state: 'lines-dropped', fullTokens };
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
): OutlineNode {
  const label = textField(node.el, 'label');
  return {
    ref: model.refs.refOf(node.el.id),
    id: node.el.id,
    kind: model.kindOf(node.el),
    unknown: !isKnownElement(node.el),
    label,
    // No live kind has a content summary since the element engine's parts 1 to 3; kept on the wire as null.
    summary: null,
    attributes: attributesAt(nodeAttributes(model, node.el, style), level).map(
      ({ key, value }) => ({ key, value }),
    ),
    // Kept on the wire, empty: no arrow is an edge since part 4 of the element engine.
    edges: [],
    // Kept on the wire, empty: nothing nests since part 3 of the element engine.
    children: [],
    collapsed: 0,
  };
}

export function outlineView(model: ViewModel, options: OutlineOptions = {}): OutlineResult {
  const door = options.door ?? 'cli';
  const style = options.style ? styleBaselines() : null;
  const items = subtreeItems(model.tree, options.only);
  const entries = buildEntries(model, items, style);
  const header = headerLine(model.facts);
  const m = measure(entries, header);
  const { fit, state, fullTokens } = fitOutline(entries, m, options.budget, door);
  const elision = elisionOf(m, fit, fullTokens, door);
  const lines = entries.slice(0, fit.kept).map((entry) => entry.texts[fit.level]);
  const text = [header, ...lines, ...(elision === null ? [] : [elisionLine(elision)])].join('\n');

  const json: OutlineView = {
    header: viewHeader('outline', model.facts),
    nodes: items
      .slice(0, fit.kept)
      .map((item) =>
        isViewRun(item) ? runJson(model, item) : nodeJson(model, item, fit.level, style),
      ),
    // Kept on the wire, empty: a stored arrow prints as a node since part 4 of the element engine.
    ownLineArrows: [],
    elision,
  };
  return { text, json, state, fullTokens, fit: { estimate: fullTokens, state } };
}

// One element's outline line at full detail: what `find` prints for a match.
export function outlineLine(model: ViewModel, node: ViewNode): string {
  return nodeLine(model, node, 0, null);
}
