// Chart-view helpers: the shared LAYOUT is re-exported from the document
// package (see below); what stays here is the animation wiring, which is CSS
// classes and therefore the canvas's alone.
//
// The LAYOUT it used to hold (the palette, the box, the data, the legend
// toggle, the plot + legend rects) moved to @livedocuments/document, because the
// headless renderer has to lay a chart out the same way or an exported chart
// is a different chart. Re-exported here so a chart view keeps importing it
// from the module it always has.

import type { CSSProperties } from 'react';
import { animLoops, PIE_LOOPING_ANIMS, type ShapeElement } from '@livedocuments/document';
import { useConceptTourPreview } from './concept-tour-preview';
import { animClass, animSpeedVars } from './icons';

export { chartFrame } from '@livedocuments/document';

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

// chartAnim for a chart on screen: while the Chart tour previews Grow on it (docs/specs/007-editor/element-tours.md
// "The Chart tour"), its marks grow over and over, never stored, whatever animation the chart has of its own.
export function useChartAnim(
  element: ShapeElement,
  transformOrigin: string,
): ReturnType<typeof chartAnim> {
  const preview = useConceptTourPreview(element.id);
  return chartAnim(
    preview?.anim === 'grow' ? { ...element, pieAnim: 'grow', pieAnimRepeat: true } : element,
    transformOrigin,
  );
}
