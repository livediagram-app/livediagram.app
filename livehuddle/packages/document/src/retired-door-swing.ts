// Doors open on their own (docs/specs/009-elements/room-builder.md "Opening on their own"): nobody swings one by hand,
// so a door stores no open or shut state. A tab saved while doors were swung by hand may carry `doorClosed` on any of
// its elements: it is dropped, so a door saved shut loads as an ordinary door and nobody is shut in. Run on every
// stored or incoming tab by the stored-tab migration (./stored-tab), beside ./retired-locks. Pure; the same object
// back when there is nothing to drop, so the common read allocates nothing.
import { isRecord } from '@liveworkspace/model-core/is-record';

const carriesSwing = (el: unknown): boolean => isRecord(el) && 'doorClosed' in el;

function withoutSwing(el: unknown): unknown {
  if (!carriesSwing(el)) return el;
  const { doorClosed: _closed, ...rest } = el as Record<string, unknown>;
  return rest;
}

/** The tab without any element's `doorClosed`. */
export function dropRetiredDoorSwing<T extends object>(tab: T): T {
  const t = tab as T & Record<string, unknown>;
  const elements = Array.isArray(t.elements) ? (t.elements as unknown[]) : undefined;
  if (!elements?.some(carriesSwing)) return tab;
  return { ...t, elements: elements.map(withoutSwing) };
}
