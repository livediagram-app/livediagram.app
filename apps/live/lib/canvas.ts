export type ShapeDragMode = 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se';

// Back-compat alias — used in ShapeView / drag handlers.
export type DragMode = ShapeDragMode;

export type ArrowEnd = 'from' | 'to';

export const SNAP_THRESHOLD = 24;
