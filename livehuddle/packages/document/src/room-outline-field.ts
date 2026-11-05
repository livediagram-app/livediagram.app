// A custom room's `roomOutline` as stored (docs/specs/009-elements/room-builder.md "The custom room"): three or more
// corners, each a 0..1 fraction of the room's box. A leaf module so validation reads it without the model's factories.

/** Fewest and most corners a stored outline may have. */
export const ROOM_OUTLINE_MIN = 3;
export const ROOM_OUTLINE_MAX = 200;

/** Whether a value is a valid stored room outline. */
export function isRoomOutline(value: unknown): value is { x: number; y: number }[] {
  if (!Array.isArray(value) || value.length < ROOM_OUTLINE_MIN || value.length > ROOM_OUTLINE_MAX)
    return false;
  return value.every((p: unknown) => {
    if (typeof p !== 'object' || p === null) return false;
    const { x, y } = p as { x?: unknown; y?: unknown };
    return (
      typeof x === 'number' &&
      typeof y === 'number' &&
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= 0 &&
      x <= 1 &&
      y >= 0 &&
      y <= 1
    );
  });
}
