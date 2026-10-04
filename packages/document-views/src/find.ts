// The find view (docs/specs/024-agents/blueprints/document-views.md "find", VW35): elements whose text
// holds the query, each under its container chain. Substring only, so no pattern reaches a regex engine.
import { FIND_FIELDS, type FindField, type FindView, type ViewDoor } from '@livediagram/api-schema';
import type { Element } from '@livediagram/document';
import { fitLines, fitOf, type ViewLine, type ViewResult } from './budget';
import { LABEL_CUT_CHARS } from './constants';
import { ownLineText, type ViewEdge } from './edges';
import { arrayField, isObject, stringField, textField, threadOf } from './fields';
import { headerLine, viewHeader } from './header';
import type { ViewModel } from './model';
import { outlineLine } from './outline';
import { jsonString, plural } from './text';
import { depthFirst, type ViewNode } from './tree';

export type FindOptions = { budget?: number; door?: ViewDoor };

const LINE = { one: 'line', many: 'lines' };

export function normaliseFind(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

// The texts of each field `find` searches on one element.
function searchedTexts(el: Element): [FindField, string[]][] {
  const strings = (values: readonly unknown[]) =>
    values.filter((v): v is string => typeof v === 'string');
  const rows = arrayField(el, 'cells').flatMap((row) => (Array.isArray(row) ? row : []));
  const entityFields = arrayField(el, 'entityFields').filter(isObject);
  const thread = threadOf(el);
  return [
    ['label', strings([textField(el, 'label')])],
    ['note', strings([textField(el, 'note')])],
    ['cell', strings(rows)],
    [
      'field',
      entityFields.flatMap((f) => strings([stringField(f, 'name'), stringField(f, 'type')])),
    ],
    [
      'item',
      strings(
        arrayField(el, 'checklistItems')
          .filter(isObject)
          .map((i) => stringField(i, 'text')),
      ),
    ],
    ['code', strings([stringField(el, 'code')])],
    ['comment', strings((thread?.comments ?? []).map((c) => stringField(c, 'text')))],
  ];
}

function matchedFields(el: Element, q: string): FindField[] {
  return searchedTexts(el).flatMap(([field, texts]) =>
    texts.some((text) => normaliseFind(text).includes(q)) ? [field] : [],
  );
}

function ancestorsOf(model: ViewModel, node: ViewNode): ViewNode[] {
  const chain: ViewNode[] = [];
  for (let at = node.container; at !== null;) {
    const parent = model.tree.nodes.get(at)!;
    chain.unshift(parent);
    at = parent.container;
  }
  return chain;
}

// `q` is non-empty; the caller bounds its length.
export function findView(
  model: ViewModel,
  q: string,
  options: FindOptions = {},
): ViewResult<FindView> {
  const wanted = normaliseFind(q);
  const lines: ViewLine[] = [];
  const matches: FindView['matches'] = [];
  const counts = new Map<FindField, number>();
  // The ids printed at each depth, so a chain prints once for siblings.
  let printedChain: string[] = [];
  const refOf = (node: ViewNode) => model.refs.refOf(node.el.id);
  const label = (el: Element) => {
    const text = textField(el, 'label');
    return text === null ? '' : ` ${jsonString(text, LABEL_CUT_CHARS)}`;
  };
  const printChain = (chain: readonly ViewNode[]) => {
    chain.forEach((ancestor, depth) => {
      if (printedChain[depth] === ancestor.el.id) return;
      lines.push({
        text: `${'  '.repeat(depth)}${model.kindOf(ancestor.el)} ${refOf(ancestor)}${label(ancestor.el)}`,
        noun: LINE,
      });
      printedChain = [...printedChain.slice(0, depth), ancestor.el.id];
    });
    printedChain = printedChain.slice(0, chain.length);
  };
  const record = (ref: string, el: Element, field: FindField, path: readonly ViewNode[]) => {
    matches.push({
      ref,
      kind: model.kindOf(el),
      label: textField(el, 'label'),
      field,
      path: path.map(refOf),
    });
    counts.set(field, (counts.get(field) ?? 0) + 1);
  };
  const edgeMatches = (edge: ViewEdge) =>
    edge.label !== null && normaliseFind(edge.label).includes(wanted);
  const printEdge = (edge: ViewEdge, chain: readonly ViewNode[]) => {
    printChain(chain);
    lines.push({ text: `${'  '.repeat(chain.length)}${ownLineText(edge)}`, noun: LINE });
    record(edge.ref, edge.arrow, 'edge', chain);
  };

  for (const node of depthFirst(model.tree.roots)) {
    const fields = matchedFields(node.el, wanted);
    const chain = ancestorsOf(model, node);
    if (fields.length > 0) {
      printChain(chain);
      lines.push({ text: outlineLine(model, node, chain.length), noun: LINE });
      printedChain = [...printedChain, node.el.id];
      for (const field of fields) record(refOf(node), node.el, field, chain);
    }
    for (const edge of model.edges.bySource.get(node.el.id) ?? [])
      if (edgeMatches(edge)) printEdge(edge, chain);
  }
  for (const edge of model.edges.ownLine) {
    if (!edgeMatches(edge)) continue;
    printedChain = [];
    printEdge(edge, []);
  }

  const summary = FIND_FIELDS.flatMap((field) => {
    const count = counts.get(field) ?? 0;
    return count > 0 ? [plural(count, field, `${field}s`)] : [];
  });
  lines.push({
    text:
      matches.length === 0
        ? '0 matches'
        : `${plural(matches.length, 'match', 'matches')}: ${summary.join(', ')}`,
  });
  const fitted = fitLines({
    header: headerLine(model.facts),
    lines,
    budget: options.budget,
    door: options.door ?? 'cli',
  });
  return {
    text: fitted.text,
    fit: fitOf(fitted),
    json: { header: viewHeader('find', model.facts), q, matches, elision: fitted.elision },
  };
}
