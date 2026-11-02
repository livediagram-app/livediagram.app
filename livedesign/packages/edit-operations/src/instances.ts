// Component instances in edit operations (docs/specs/024-agents/edit-operations.md "Components"): an instance is
// placed with an ordinary `add` (`shape: 'instance'`, `componentId`), its box the main's frame unless a size is named,
// and `detach` needs its main. Only those operations need the design's mains; `operationsNeedComponents` says when
// a caller must read them.
import type { EditRejection } from '@livedesign/api-schema';
import { INSTANCE_SHAPE, type BoxedElement, type DesignComponent } from '@livedesign/design';
import { invalidValue } from './rejections';
import type { EditState } from './state';
import type { EditOperation } from './types';

export const COMPONENTS_HINT = 'the components view lists the mains: livedesign component ls <doc>';
// The mains a refusal names, at most.
const MAINS_NAMED = 10;

const isInstanceKind = (value: unknown) => value === INSTANCE_SHAPE;

/** Whether applying these operations needs the design's mains: an instance placed, or one detached. */
export function operationsNeedComponents(operations: readonly EditOperation[]): boolean {
  return operations.some((op) => {
    if (op.op === 'detach') return true;
    if (op.op !== 'add') return false;
    return 'element' in op ? isInstanceKind(op.element.shape) : isInstanceKind(op.kind);
  });
}

function mainsNamed(library: ReadonlyMap<string, DesignComponent>): string {
  const mains = [...library.values()];
  if (mains.length === 0) return 'the design has no components yet';
  const named = mains.slice(0, MAINS_NAMED).map((c) => `${c.id} ${JSON.stringify(c.name)}`);
  const more = mains.length - named.length;
  return `mains: ${named.join(', ')}${more > 0 ? ` and ${more} more` : ''}`;
}

/** An instance about to be added, checked and sized: it must name a main the design holds (when the caller read the
 *  library), and each side it was not given is the main's frame's. Anything else passes as is. */
export function placedInstance<E extends BoxedElement>(
  state: EditState,
  el: E,
  given: { width: boolean; height: boolean },
  operation: number,
): { el: E } | { rejection: EditRejection } {
  if (el.type !== 'shape' || el.shape !== INSTANCE_SHAPE) return { el };
  const id = el.componentId;
  if (typeof id !== 'string' || id === '')
    return {
      rejection: invalidValue(
        operation,
        'componentId',
        id ?? null,
        'an instance names its main',
        COMPONENTS_HINT,
      ),
    };
  if (state.components === null) return { el };
  const main = state.components.get(id);
  if (!main)
    return {
      rejection: invalidValue(
        operation,
        'componentId',
        id,
        'is not a main of this design',
        mainsNamed(state.components),
      ),
    };
  return {
    el: {
      ...el,
      width: given.width ? el.width : main.width,
      height: given.height ? el.height : main.height,
    },
  };
}
