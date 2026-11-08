// The graph view (docs/specs/024-agents/blueprints/document-views.md "graph", VW30): the elements an
// arrow touches, then every arrow. A stored arrow is a retired element (docs/specs/002-project-scope/
// not-in-livehuddle.md "The element engine", part 4) that joins nothing, so the graph lists no node and no edge, and
// names every element as unconnected.
import type { GraphView, ViewDoor } from '@livehuddle/api-schema';
import { fitLines, fitOf, type ViewResult } from '@liveworkspace/document-views/budget';
import { headerLine, viewHeader } from './header';
import type { ViewModel } from './model';
import { nodesOf } from './tree';

type GraphOptions = { budget?: number; door?: ViewDoor };

export function graphView(model: ViewModel, options: GraphOptions = {}): ViewResult<GraphView> {
  const unconnected = nodesOf(model.tree.roots).length;
  const fitted = fitLines({
    header: headerLine(model.facts),
    lines: [],
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
  return {
    text: fitted.text,
    fit: fitOf(fitted),
    json: {
      header: viewHeader('graph', model.facts),
      nodes: [],
      arrows: [],
      elision: fitted.elision,
    },
  };
}
