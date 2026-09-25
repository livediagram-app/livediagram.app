// Chart-view helpers: the shared LAYOUT is re-exported from the diagram
// package (see below); what stays here is the animation wiring, which is CSS
// classes and therefore the canvas's alone.
//
// The LAYOUT it used to hold (the palette, the box, the data, the legend
// toggle, the plot + legend rects) moved to @livediagram/diagram, because the
// headless renderer has to lay a chart out the same way or an exported chart
// is a different chart. Re-exported here so a chart view keeps importing it
// from the module it always has.

import type { CSSProperties } from 'react';
import { animLoops, PIE_LOOPING_ANIMS, type ShapeElement } from '@livediagram/diagram';
import { animClass, animSpeedVars } from './icons';

export { chartFrame } from '@livediagram/diagram';

// The animated-group className + style for a chart element (pie / bar share the
// `pieAnim` / `pieAnimRepeat` / `pieAnimSpeed` fields + the `lvd-pie-*` classes).
// `transformOrigin` is the only per-chart difference (the pie centre vs the bar
// baseline), so each view passes its own. Returns no style when there's no
// animation.
export function chartAnim(
  element: ShapeElement,
  transformOrigin: string,
): { className: string | undefined; style: CSSProperties | undefined } {
  const anim = element.pieAnim;
  const loops = animLoops(anim, element.pieAnimRepeat, PIE_LOOPING_ANIMS);
  return {
    className: animClass('pie', anim),
    style: anim
      ? { transformOrigin, ...animSpeedVars('pie', element.pieAnimSpeed, loops) }
      : undefined,
  };
}
