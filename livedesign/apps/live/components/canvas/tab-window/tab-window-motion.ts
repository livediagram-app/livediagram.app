// How a tab window's drawing moves (docs/specs/009-elements/tab-window.md "The drawing"): the shown tab's elements
// animate as they do on the canvas, by the canvas's own classes and custom properties, set on each element's group in
// the window's inline SVG so the page's motion stylesheets play them. Only the animations that ride the element
// whole (a transform, a filter, an opacity or a clip on the wrapper) or an arrow's line can play on a drawn group;
// the ones that need the canvas's own nodes (a ring or halo layer, a trace light measured onto the outline, a
// sticky's fold, letters split into spans, a table's cells, a photo inside its frame) show their rest frame, as
// every export does.
import {
  ANIMATION_SPEED_FACTOR,
  DEFAULT_ANIMATION_SPEED,
  bodyAnimationSetOf,
  defaultArrowStrokeColor,
  defaultStrokeColor,
  type AnimationSetId,
  type ArrowElement,
  type ArrowLineMotion,
  type BoxedElement,
  type CanvasSurface,
} from '@livedesign/design';
import { setAnimationClass } from '@/lib/animation-classes';
import type { SvgMotion } from '@/lib/export-tab';
import { FLOW_PATH_CLASS, FLOW_PATH_DASH } from '../arrow-flow';
import { wrapperShapeAnimation } from '../useBoxedElementAnimation';

/** The Shape set's values drawn by the wrapper class alone: its motions and its filter swells. */
export const WINDOW_SHAPE_PLAYS: ReadonlySet<string> = new Set([
  'blink',
  'heartbeat',
  'breathe',
  'shimmer',
  'highlight',
  'bounce',
  'wobble',
  'shake',
  'jelly',
  'float',
  'swing',
]);

/** The other body sets' values whose class moves the element whole. */
export const WINDOW_BODY_PLAYS: Readonly<Partial<Record<AnimationSetId, ReadonlySet<string>>>> = {
  sticky: new Set(['flutter', 'sway', 'wiggle', 'drop']),
  media: new Set(['develop', 'focus', 'wipe', 'iris']),
  drawing: new Set(['glow']),
};

// The custom properties the motion stylesheets read, as useBoxedElementAnimation sets them on the canvas.
function motionStyle(el: BoxedElement, surface: CanvasSurface): string {
  const vars = [
    `--lvd-anim-color:${el.strokeColor ?? defaultStrokeColor(el, surface)}`,
    `--lvd-anim-size:${Math.round(Math.min(el.width, el.height))}`,
    `--lvd-w:${Math.round(el.width)}`,
    `--lvd-h:${Math.round(el.height)}`,
    `--lvd-anim-speed:${ANIMATION_SPEED_FACTOR[el.animationSpeed ?? DEFAULT_ANIMATION_SPEED]}`,
  ];
  if (el.animationRepeat === false) vars.push('--lvd-anim-iter:1');
  return vars.join(';');
}

/** The class and style a boxed element's group wears in the window, or undefined when it holds still. */
export function windowBoxedMotion(
  el: BoxedElement,
  surface: CanvasSurface,
): { className: string; style: string } | undefined {
  const shape = wrapperShapeAnimation(el);
  if (shape) {
    return WINDOW_SHAPE_PLAYS.has(shape)
      ? { className: `lvd-anim-${shape}`, style: motionStyle(el, surface) }
      : undefined;
  }
  const set = bodyAnimationSetOf(el);
  const value = el.animation;
  if (!set || !value || !WINDOW_BODY_PLAYS[set]?.has(value)) return undefined;
  return {
    className: setAnimationClass(set, value, el.animationRepeat),
    style: motionStyle(el, surface),
  };
}

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
    boxed: (el) => windowBoxedMotion(el, surface),
    arrowLine: (el) => windowArrowLine(el, surface),
  };
}
