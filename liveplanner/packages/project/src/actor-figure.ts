// Where an actor's stick figure is drawn in its box (docs/specs/008-canvas/canvas-and-palette.md
// "User"). The figure is the 90 × 130 actor geometry (shape-geometry.ts), its legs ending at 112
// with a band under them for the name. While the name fits that band the figure fills the box as it
// always has; when the name needs more room (a second line, a larger size, an imported caption) the
// figure shrinks and rises so its legs end where the name's room begins. Every renderer (canvas,
// export, hit-testing, anchors) fits the geometry into this rect, so they cannot disagree.

import { ACTOR_VIEWBOX } from './shape-geometry';
import { labelFontPx } from './label-font';
import { LABEL_LINE_HEIGHT } from './svg-render-primitives';
import { PADDING_PX, type Padding, type TextSize } from './index';

/** How far down the 130-high actor geometry the legs reach; the rest is the name's band. */
export const ACTOR_FIGURE_HEIGHT = 112;

type ActorLike = {
  width: number;
  height: number;
  label?: string | undefined;
  textSize?: TextSize | undefined;
  padding?: Padding | undefined;
};

/** The room an actor's name needs under the figure: its lines and the label padding both sides. */
export function actorNameRoom(el: Pick<ActorLike, 'label' | 'textSize' | 'padding'>): number {
  if (!el.label) return 0;
  const lines = el.label.split('\n').length;
  return lines * labelFontPx(el.textSize) * LABEL_LINE_HEIGHT + 2 * PADDING_PX[el.padding ?? 'sm'];
}

/** The element-local rect the actor geometry is fitted into (meet, centred across). */
export function actorFigureRect(el: ActorLike): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const room = actorNameRoom(el);
  const fits = Math.min(el.width / ACTOR_VIEWBOX.width, el.height / ACTOR_VIEWBOX.height);
  const above = room > 0 ? Math.max(0, el.height - room) / ACTOR_FIGURE_HEIGHT : Infinity;
  const k = Math.max(0, Math.min(fits, above));
  const height = ACTOR_VIEWBOX.height * k;
  const centred = (el.height - height) / 2;
  const clear = el.height - room - ACTOR_FIGURE_HEIGHT * k;
  return { x: 0, y: Math.max(0, Math.min(centred, clear)), width: el.width, height };
}
