// A turn stored on an element that does not turn (docs/specs/009-elements/pointer-note.md, a pointer note; an
// annotation marker), dropped where stored elements enter (./stored-elements): from storage, a peer, a paste or an
// agent's write. The canvas and the export draw such an element upright (`rotationOf`), but anchors, resizing, the
// eraser and the agents' views read the field itself, so a stored turn put arrows, handles
// and hit tests on an outline that is not on screen, and nothing offers a way to reset it (no Rotation for these).
// Dropping it once at the door keeps every reader right without each having to remember.
import { isBoxed, type Element } from './element';
import { supportsRotation } from './rotation';

const carriesUnturnableRotation = (el: Element): boolean =>
  isBoxed(el) && !supportsRotation(el) && 'rotation' in el;

export function dropUnturnableRotation<E extends Element>(elements: E[]): E[] {
  if (!elements.some(carriesUnturnableRotation)) return elements;
  return elements.map((el) => {
    if (!carriesUnturnableRotation(el)) return el;
    // Rotation is optional on every element, so leaving it out keeps the caller's type.
    const { rotation: _turn, ...rest } = el as E & { rotation?: number };
    return rest as unknown as E;
  });
}
