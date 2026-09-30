// Test-only: a LiveStroke fed from a list of canvas points, one sample every `stepMs`.
import { createLiveStroke, type LiveStroke } from './live-stroke';

export function liveStrokeOf(
  points: { x: number; y: number }[],
  {
    zoom = 1,
    stepMs = 8,
    pointerType = 'mouse',
  }: { zoom?: number; stepMs?: number; pointerType?: string } = {},
): LiveStroke {
  const stroke = createLiveStroke(pointerType, 1, zoom);
  points.forEach((p, i) => stroke.smoother.push(p.x, p.y, i * stepMs));
  return stroke;
}
