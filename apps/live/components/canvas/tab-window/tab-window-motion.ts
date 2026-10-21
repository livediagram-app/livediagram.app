// How a tab window's drawing moves (docs/specs/009-elements/tab-window.md "The drawing"): the shown tab's arrows
// flow as they do on the canvas, by the canvas's own classes and custom properties, set on each line in the window's
// inline SVG so the page's motion stylesheets play them. Every other element shows still, as every export does.
import {
  ANIMATION_SPEED_FACTOR,
  DEFAULT_ANIMATION_SPEED,
  defaultArrowStrokeColor,
  type ArrowElement,
  type ArrowLineMotion,
  type CanvasSurface,
} from '@liveplanner/document';
import type { SvgMotion } from '@/lib/export-tab';
import { FLOW_PATH_CLASS, FLOW_PATH_DASH } from '../arrow-flow';

/** An arrow's flow as a moving line, as ArrowView draws it; undefined for none, or a travelling dot or comet. */
export function windowArrowLine(
  arrow: ArrowElement,
  surface: CanvasSurface,
): ArrowLineMotion | undefined {
  const flow = arrow.flow;
  const className = flow ? FLOW_PATH_CLASS[flow] : undefined;
  if (!flow || !className) return undefined;
  const vars = [
    `--lvd-flow-speed:${ANIMATION_SPEED_FACTOR[arrow.flowSpeed ?? DEFAULT_ANIMATION_SPEED]}`,
  ];
  if (flow === 'grow' || flow === 'heartbeat' || flow === 'breathe')
    vars.push(`--lvd-flow-w:${arrow.strokeWidth ?? 2}px`);
  if (flow === 'glow' || flow === 'shimmer')
    vars.push(`--lvd-flow-color:${arrow.strokeColor ?? defaultArrowStrokeColor(surface)}`);
  if (arrow.flowRepeat === false) vars.push('--lvd-flow-iter:1');
  return {
    className,
    dash: FLOW_PATH_DASH[flow],
    pathLength: flow === 'draw' ? 1 : undefined,
    style: vars.join(';'),
  };
}

/** The renderer's motion option for a tab drawn on `surface`. */
export function windowMotion(surface: CanvasSurface): SvgMotion {
  return {
    arrowLine: (el) => windowArrowLine(el, surface),
  };
}
