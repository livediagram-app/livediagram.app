// Bare strokes fold into one counted line (docs/specs/024-agents/blueprints/document-views.md "Freehand
// runs", VW56).
import type { Element } from '@livediagram/document';
import { fieldOf, flagField, textField, threadOf } from './fields';
import type { Placed } from './reading-order';

export type FreehandRun<T extends Placed = Placed> = {
  run: 'freehand';
  strokes: T[];
  closed: number;
};

// A freehand with no label, note, thread, link or action, and no printed arrow ending on it.
export function isBareStroke(el: Element, arrowEndIds: ReadonlySet<string>): boolean {
  return (
    el.type === 'freehand' &&
    textField(el, 'label') === null &&
    textField(el, 'note') === null &&
    threadOf(el) === null &&
    fieldOf(el, 'link') === undefined &&
    fieldOf(el, 'action') === undefined &&
    fieldOf(el, 'actions') === undefined &&
    !arrowEndIds.has(el.id)
  );
}

// Two or more bare strokes adjacent in reading order become one run; a lone one stays itself.
export function freehandRuns<T extends Placed>(
  ordered: readonly T[],
  arrowEndIds: ReadonlySet<string>,
): (T | FreehandRun<T>)[] {
  const out: (T | FreehandRun<T>)[] = [];
  let pending: T[] = [];
  const flush = () => {
    if (pending.length > 1) {
      const closed = pending.filter((p) => flagField(p.el, 'closed')).length;
      out.push({ run: 'freehand', strokes: pending, closed });
    } else out.push(...pending);
    pending = [];
  };
  for (const placed of ordered) {
    if (isBareStroke(placed.el, arrowEndIds)) pending.push(placed);
    else {
      flush();
      out.push(placed);
    }
  }
  flush();
  return out;
}
