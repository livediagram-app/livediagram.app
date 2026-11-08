// The content origin (docs/specs/024-agents/document-views.md "The outline"): where a tab's boxed content starts,
// which views and edit operations measure positions from. The containment rule that once lived beside it (a lane,
// stack or boundary holding what its box held) left with those kinds
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3).
import type { Element } from './index';
import type { Point } from '@liveworkspace/model-core/geometry-primitives';

type Boxed = Element & { x: number; y: number; width: number; height: number };

const GEOMETRY_KEYS = ['x', 'y', 'width', 'height'] as const;

function hasGeometry(el: Element): el is Boxed {
  return GEOMETRY_KEYS.every((key) => {
    const value: unknown = Reflect.get(el, key);
    return typeof value === 'number' && Number.isFinite(value);
  });
}

// The rounded top-left of the boxed content; 0,0 when there is none.
export function contentOrigin(elements: readonly Element[]): Point {
  const boxed = elements.filter((el): el is Boxed => el.type !== 'arrow' && hasGeometry(el));
  if (boxed.length === 0) return { x: 0, y: 0 };
  const minOf = (key: 'x' | 'y') => boxed.reduce((min, el) => Math.min(min, el[key]), Infinity);
  return { x: Math.round(minOf('x')), y: Math.round(minOf('y')) };
}
