// FLIP reordering for a list (the form builder's questions, docs/specs/030-forms/forms.md "Building a form"): when
// the order changes, each row slides from where it was to where it now is. A row new to the list can be told
// (`onEnter`), once. Reduced motion moves nothing.
//
// Rows are measured with `measure`: by default `offsetTop`, layout units untouched by a transform on an ancestor, so
// the delta is in the units the translate is applied in. A list whose rows have different offset parents (questions
// in different sections) measures against a common root instead.
import { useEffectEvent, useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/motion-preference';

export type FlipListOptions = {
  // The class that carries the slide's transition, added once a row has its inverted start frame.
  moveClass: string;
  measure?: (node: HTMLElement) => number;
  onEnter?: (node: HTMLElement) => void;
};

// One flip: each row measured now, and one that was measured before and moved slid home from where it was; a row new
// to the list told `onEnter`. Answers the measurements, for the next flip. Plain DOM work, outside the hook.
function flipRows(
  order: readonly string[],
  nodes: ReadonlyMap<string, HTMLElement>,
  before: ReadonlyMap<string, number> | null,
  options: FlipListOptions,
): Map<string, number> {
  const { moveClass, measure = (n: HTMLElement) => n.offsetTop, onEnter } = options;
  const after = new Map<string, number>();
  const reduce = prefersReducedMotion();
  for (const id of order) {
    const node = nodes.get(id);
    if (!node) continue;
    const top = measure(node);
    after.set(id, top);
    // The first render places the list; nothing moves or enters yet.
    if (!before || reduce) continue;
    const was = before.get(id);
    if (was === undefined) {
      onEnter?.(node);
      continue;
    }
    if (was === top) continue;
    const delta = was - top;
    // Invert: put it back where it was, with no transition...
    node.style.transition = 'none';
    node.style.transform = `translateY(${delta}px)`;
    // ...force the browser to take that as the starting frame...
    void node.offsetHeight;
    // ...then play: let it slide home on the move class.
    node.style.transition = '';
    node.classList.add(moveClass);
    node.style.transform = '';
  }
  return after;
}

// `order` is the list's ids in display order; the effect re-runs only when it changes. Rows register with `rowRef(id)`.
export function useFlipList(order: string[], options: FlipListOptions) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const last = useRef<Map<string, number> | null>(null);
  const key = order.join('|');

  // Keyed on `key`, which stands in for `order` (a fresh array every render): the flip itself is an effect event
  // reading the order and options as they are now.
  const flip = useEffectEvent(() => {
    last.current = flipRows(order, nodes.current, last.current, options);
  });
  useLayoutEffect(() => flip(), [key]);

  return (id: string) => (node: HTMLElement | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  };
}
