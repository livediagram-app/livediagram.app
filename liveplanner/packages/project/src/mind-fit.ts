// A mind node grows to fit its label (docs/specs/009-elements/mind-node.md "A node grows to fit
// its label"). The measuring is the editor's (it needs the DOM and the label's font); this is the
// pure half: given the height the label needs, make the node that tall and keep the map tidy.

import { applyMindMoves, relayoutMindMap } from './mind-grow';
import { isMindTreeTidy } from './mind-layout';
import { isMindNode, mindFlowOf, mindRootOf } from './mind-map';
import type { Element, ElementId } from './index';

/**
 * `elements` with mind node `id` at least `height` tall (rounded up to a whole pixel). Grows
 * only: a node already that tall comes back unchanged, as the same array. The node grows downward
 * (its top stays put); a map that was tidy before is laid out again around it, so siblings never
 * overlap it, while a hand-arranged map is left where it is.
 */
export function fitMindNodeHeight(elements: Element[], id: ElementId, height: number): Element[] {
  const node = elements.find((el) => el.id === id);
  if (!node || !isMindNode(node) || !Number.isFinite(height)) return elements;
  const target = Math.ceil(height);
  if (target <= node.height) return elements;
  const root = mindRootOf(elements, node);
  const wasTidy = isMindTreeTidy(elements, root.id, mindFlowOf(elements, root));
  const grown = elements.map((el) => (el.id === id ? { ...el, height: target } : el));
  if (!wasTidy) return grown;
  const plan = relayoutMindMap(grown, id);
  return plan ? applyMindMoves(grown, plan.moves, plan.reanchored) : grown;
}
