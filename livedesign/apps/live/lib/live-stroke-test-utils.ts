// Test-only: a LiveStroke fed from a list of canvas points (and pressures, for a pen).
import { createLiveStroke, type LiveStroke } from './live-stroke';

export function liveStrokeOf(
  points: { x: number; y: number }[],
  { pointerType = 'mouse', pressures }: { pointerType?: string; pressures?: number[] } = {},
): LiveStroke {
  const stroke = createLiveStroke(pointerType, 1);
  points.forEach((p, i) => stroke.push(p.x, p.y, pressures?.[i]));
  return stroke;
}
