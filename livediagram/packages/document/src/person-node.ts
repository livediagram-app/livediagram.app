// Person nodes (docs/specs/009-elements/org-chart.md, blueprint org-chart.md): a mind node drawn as a person, an
// initials disc beside the name (its label) and the role (`pageSubtitle`). An org chart is a mind map of them in the
// Downward flow, so it grows, tidies and moves as any mind map.
//
// A LEAF module: types only from './index'.

import { clamp } from '@liveworkspace/model-core/geometry-primitives';
import type { Element } from './index';
import type { LayoutRect } from './web-components';

export type MindLook = 'person';

export function isPersonNode(el: Element): boolean {
  return el.type === 'shape' && el.shape === 'mind-node' && el.mindLook === 'person';
}

/** Up to two capitals for a name: the first letters of its first two words, a one-word name's first two letters. */
export function personInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters =
    words.length >= 2
      ? `${[...words[0]!][0]}${[...words[1]!][0]}`
      : [...words[0]!].slice(0, 2).join('');
  return letters.toUpperCase();
}

/** Where the disc, the name and the role sit in a person node. */
export function personNodeLayout(
  w: number,
  h: number,
  hasRole: boolean,
): { disc: LayoutRect; name: LayoutRect; role: LayoutRect | null } {
  const d = Math.max(0, Math.min(44, Math.round(h * 0.7)));
  const x = 12 + d + 12;
  const width = Math.max(0, w - x - 10);
  const disc = { x: 12, y: Math.round((h - d) / 2), width: d, height: d };
  if (!hasRole) return { disc, name: { x, y: 0, width, height: h }, role: null };
  const half = h / 2;
  return {
    disc,
    name: { x, y: clamp(half - 22, 0, half), width, height: Math.min(22, half) },
    role: { x, y: half, width, height: Math.min(20, half) },
  };
}
