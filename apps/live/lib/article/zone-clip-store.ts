'use client';

// The drawing-zone clips on the canvas (docs/specs/007-editor/article-pages.md "Zones"), by element:
// published by the article pages (ArticleFlows), read by each element view. Per element, so a view
// re-renders only when its own clip changes (docs/specs/008-canvas/canvas-performance.md): a rect
// keeps its identity while its values do.
import { useSyncExternalStore } from 'react';
import type { PageRect } from '@livediagram/document';

let clips: ReadonlyMap<string, PageRect> = new Map();
const listeners = new Set<() => void>();

const same = (a: PageRect, b: PageRect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

export function publishZoneClips(next: ReadonlyMap<string, PageRect>): void {
  let changed = next.size !== clips.size;
  const out = new Map<string, PageRect>();
  for (const [id, rect] of next) {
    const was = clips.get(id);
    if (was && same(was, rect)) out.set(id, was);
    else {
      out.set(id, rect);
      changed = true;
    }
  }
  if (!changed) return;
  clips = out;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** The rect an element is clipped to (a drawing zone it is in), or undefined. */
export function useZoneClip(id: string): PageRect | undefined {
  return useSyncExternalStore(
    subscribe,
    () => clips.get(id),
    () => undefined,
  );
}

/** A CSS clip-path keeping only what is inside `rect` (canvas px) of a box whose corner is at
 *  (`x`, `y`): polygon coordinates are relative to the box. */
export function zoneClipPolygon(rect: PageRect, x: number, y: number): string {
  const l = rect.x - x;
  const t = rect.y - y;
  const r = l + rect.width;
  const b = t + rect.height;
  return `polygon(${l}px ${t}px, ${r}px ${t}px, ${r}px ${b}px, ${l}px ${b}px)`;
}
