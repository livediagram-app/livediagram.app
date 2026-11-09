// A peer's camera (docs/specs/012-collaboration/follow-me-viewport.md): a presence op from any share level, which a
// follower applies to its own view. Checked where the room relays it and where a screen applies it, so a malformed
// one (a zoom of 0 or NaN, a pan that is not a number) never sends a follower's canvas to a blank view.

const TAB_ID_MAX = 128;
/** The largest canvas side a sender may report, in CSS px: far past any screen. */
const SIZE_MAX = 100_000;

export type ViewportOp = {
  kind: 'viewport';
  tabId: string;
  pan: { x: number; y: number };
  zoom: number;
  size?: { width: number; height: number };
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isSide = (v: unknown): v is number => isNum(v) && v > 0 && v <= SIZE_MAX;

/** A `viewport` op as sent, its own fields alone, or null. A size that does not check is left out (unknown). */
export function parseViewport(op: unknown): ViewportOp | null {
  const o = op as Partial<Record<keyof ViewportOp, unknown>> | null;
  if (!o || o.kind !== 'viewport') return null;
  if (typeof o.tabId !== 'string' || o.tabId.length === 0 || o.tabId.length > TAB_ID_MAX)
    return null;
  const pan = o.pan as { x?: unknown; y?: unknown } | null | undefined;
  if (!pan || typeof pan !== 'object' || !isNum(pan.x) || !isNum(pan.y)) return null;
  if (!isNum(o.zoom) || o.zoom <= 0) return null;
  const size = o.size as { width?: unknown; height?: unknown } | null | undefined;
  const sized = !!size && typeof size === 'object' && isSide(size.width) && isSide(size.height);
  return {
    kind: 'viewport',
    tabId: o.tabId,
    pan: { x: pan.x, y: pan.y },
    zoom: o.zoom,
    ...(sized ? { size: { width: size.width as number, height: size.height as number } } : {}),
  };
}
