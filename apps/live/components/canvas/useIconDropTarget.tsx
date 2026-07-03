import { useState, type DragEvent as ReactDragEvent } from 'react';
import { acceptsInlineIcon, type Element, type IconPosition } from '@livediagram/diagram';
import { iconDropSide } from '@/lib/canvas';
import { ICON_DND_MIME } from '@/lib/icons';

// Dragging a palette icon ONTO a shape (spec/09 inline icons): the drag
// handlers that mark an icon-capable element as a drop target, tracking
// the side of the text nearest the cursor. `dropSide` drives the live
// IconDropPreview below. Lifted out of BoxedElementView as one cohesive
// slice; the existing inline icon is deliberately NOT draggable to
// reposition — the context menu's Icon position section is the one way
// to move it.
export function useIconDropTarget(
  element: Element,
  onDropIcon: ((id: string, iconId: string, side: IconPosition) => void) | undefined,
) {
  const acceptsIconDrop = !!onDropIcon && acceptsInlineIcon(element);
  const [dropSide, setDropSide] = useState<IconPosition | null>(null);
  const handleIconDragOver = (e: ReactDragEvent) => {
    if (!acceptsIconDrop || !e.dataTransfer.types.includes(ICON_DND_MIME)) return;
    // preventDefault marks this element as a valid drop target.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const side = iconDropSide(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
    setDropSide((prev) => (prev === side ? prev : side));
  };
  const handleIconDragLeave = () => setDropSide(null);
  const handleIconDrop = (e: ReactDragEvent) => {
    if (!acceptsIconDrop) return;
    const iconId = e.dataTransfer.getData(ICON_DND_MIME);
    setDropSide(null);
    if (!iconId) return;
    e.preventDefault();
    e.stopPropagation();
    onDropIcon!(
      element.id,
      iconId,
      iconDropSide(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect()),
    );
  };
  return { acceptsIconDrop, dropSide, handleIconDragOver, handleIconDragLeave, handleIconDrop };
}

// Translucent band on the target side + a ring, shown while dragging an
// icon over this shape so the drop position is obvious. Cleared on drop
// / drag-leave.
const DROP_BAND: Record<IconPosition, string> = {
  left: 'left-0 top-0 bottom-0 w-1/3',
  right: 'right-0 top-0 bottom-0 w-1/3',
  above: 'left-0 right-0 top-0 h-1/3',
  below: 'left-0 right-0 bottom-0 h-1/3',
};

export function IconDropPreview({ side }: { side: IconPosition }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[var(--z-toolbar)] ring-2 ring-brand-400"
      style={{ borderRadius: 'inherit' }}
    >
      <div className={`absolute bg-brand-400/25 ${DROP_BAND[side]}`} />
    </div>
  );
}
