// The graph view (docs/specs/024-agents/blueprints/document-views.md "graph", VW30): the elements an
// arrow touches, then every arrow in its stored direction with its ref.
import type { GraphView, ViewDoor } from '@livediagram/api-schema';
import { fitLines, type ViewLine } from './budget';
import { LABEL_CUT_CHARS } from './constants';
import { edgeJson, endText, type ViewEdge } from './edges';
import { textField } from './fields';
import { headerLine, viewHeader } from './header';
import type { ViewModel } from './model';
import { jsonString } from './text';
import { depthFirst, type ViewNode } from './tree';
import { pinnedIds } from './visibility';

export type GraphOptions = { budget?: number; door?: ViewDoor };

const NODE = { one: 'node', many: 'nodes' };
const ARROW = { one: 'arrow', many: 'arrows' };

function labelText(label: string | null): string {
  return label === null ? '' : ` ${jsonString(label, LABEL_CUT_CHARS)}`;
}

function arrowLine(edge: ViewEdge): string {
  return `${endText(edge.from)} -> ${endText(edge.to)}${labelText(edge.label)} [${edge.ref}]`;
}

export function graphView(
  model: ViewModel,
  options: GraphOptions = {},
): { text: string; json: GraphView } {
  const connected = new Set(model.edges.all.flatMap((edge) => pinnedIds(edge.arrow)));
  const all = depthFirst(model.tree.roots);
  const nodes = all.filter((node) => connected.has(node.el.id));
  const nodeLine = (node: ViewNode) =>
    `${model.kindOf(node.el)} ${model.refs.refOf(node.el.id)}${labelText(textField(node.el, 'label'))}`;
  const lines: ViewLine[] = [
    ...nodes.map((node) => ({ text: nodeLine(node), noun: NODE })),
    ...(nodes.length > 0 && model.edges.all.length > 0 ? [{ text: '' }] : []),
    ...model.edges.all.map((edge) => ({ text: arrowLine(edge), noun: ARROW })),
  ];
  const unconnected = all.length - nodes.length;
  const fitted = fitLines({
    header: headerLine(model.facts),
    lines,
    budget: options.budget,
    door: options.door ?? 'cli',
    fixed:
      unconnected > 0
        ? {
            omitted: [
              {
                noun: unconnected === 1 ? 'unconnected element' : 'unconnected elements',
                count: unconnected,
              },
            ],
            args: { view: 'outline' },
          }
        : null,
  });
  const keptNodes = Math.min(nodes.length, fitted.kept);
  const keptArrows = Math.max(0, fitted.kept - lines.length + model.edges.all.length);
  return {
    text: fitted.text,
    json: {
      header: viewHeader('graph', model.facts),
      nodes: nodes.slice(0, keptNodes).map((node) => ({
        ref: model.refs.refOf(node.el.id),
        id: node.el.id,
        kind: model.kindOf(node.el),
        label: textField(node.el, 'label'),
      })),
      arrows: model.edges.all.slice(0, keptArrows).map(edgeJson),
      elision: fitted.elision,
    },
  };
}
