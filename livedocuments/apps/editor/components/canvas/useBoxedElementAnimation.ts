import { useEffect, useState } from 'react';
import {
  ANIMATION_SPEED_FACTOR,
  DEFAULT_ANIMATION_SPEED,
  bodyAnimationSetOf,
  defaultFillColor,
  defaultStrokeColor,
  hasOwnBodySet,
  keptAnimation,
  SHAPE_MOTIONS,
  type BoxedElement,
  type ShapeAnimation,
  STEP_SEQUENCE_BEAT_S,
  stepOrdinal,
} from '@livedocuments/document';
import { drawsShapeSvgOverlay } from '@/components/canvas/ShapeContentRouter';
import { bodySetClass } from '@/lib/animation-classes';
import { useElementSurface } from '@/components/canvas/CanvasSurfaceContext';
import { useArrivesWithBoard } from '@liveworkspace/workbench/components/canvas/CanvasArrivalContext';

// The looping-animation slice (docs/specs/008-canvas/canvas-and-palette.md), lifted out of BoxedElementView:
// which surface each animation kind rides (the wrapper box, the rendered
// text glyphs, or the shape's true SVG outline), the one-shot element-pop-in
// entry class and its drop-off timer, and the CSS custom properties the
// keyframes read. The view mounts the returned classes / style on its
// wrapper and label nodes.
// The Sticky motions that draw a fold or a shadow on the animation layer.
const STICKY_LAYERED = new Set(['peel', 'lift', 'slap']);

// The attention motions the Sticky and Table sets share with the Shape set: a note and a table are
// rectangles, so the Shape set's ring, halo and fill swell already fit them.
const SHARED_WITH_SHAPE = new Set(['pulse', 'glow', 'highlight']);

/**
 * The Shape-set value the wrapper draws (docs/specs/028-animation/element-animations.md): a Shape
 * member's own value; a Shape motion or a value kept from before the sets split on any other element; and, on a
 * sticky or table, the motions it shares with the Shape set. Undefined when the element's own set
 * draws its animation, or when a text element's Text animation replaces its legacy one.
 */
export function wrapperShapeAnimation(element: BoxedElement): ShapeAnimation | undefined {
  const value = element.animation;
  if (!value) return undefined;
  if (element.type === 'text') {
    return (element as { textAnimation?: string }).textAnimation
      ? undefined
      : (value as ShapeAnimation);
  }
  // Concept graphics and sequences animate their rows by their own fields; their Shape section offers the motions
  // alone, so an older Shape value has nothing to clear it from and does not play.
  if (hasOwnBodySet(element)) {
    return (SHAPE_MOTIONS as readonly string[]).includes(value)
      ? (value as ShapeAnimation)
      : undefined;
  }
  const set = bodyAnimationSetOf(element);
  // Icons, charts, progress and rating own other fields; a Shape motion, or an old value, here plays.
  if (set === undefined || set === 'shape') return value as ShapeAnimation;
  if ((set === 'sticky' || set === 'table') && SHARED_WITH_SHAPE.has(value)) {
    return value as ShapeAnimation;
  }
  return keptAnimation(set, value);
}

function stepSequenceDelay(element: BoxedElement): React.CSSProperties {
  if (element.type !== 'shape' || element.shape !== 'step' || !element.stepSequence) return {};
  const n = stepOrdinal(element);
  if (n === null || n <= 1) return {};
  const speed = ANIMATION_SPEED_FACTOR[element.animationSpeed ?? DEFAULT_ANIMATION_SPEED];
  return { animationDelay: `${((n - 1) * STEP_SEQUENCE_BEAT_S * speed).toFixed(2)}s` };
}

export function useBoxedElementAnimation(element: BoxedElement, textColor: string) {
  const animation = wrapperShapeAnimation(element);
  // The gradient animation blends the element's fill, which falls back to the
  // canvas's own ink when the element carries none (docs/specs/007-editor/editor-app.md).
  const surface = useElementSurface(element.id);
  // A standalone text element has no fill or border, so the box-shadow / ring /
  // background animations (glow / pulse / trace / gradient) would animate an
  // invisible bounding rectangle around the words. For those, ride the rendered
  // glyphs instead: the wrapper drops the box class (see wrapperAnimClass below)
  // and the label content node gets the matching .lvd-anim-text-* class. The
  // transform animations (bounce, float, swing, …) already move the text with
  // the box, so they stay on the wrapper unchanged.
  //
  // A STICKER has the same problem for the same reason, one step further on: it
  // is a die-cut shape that paints its own art, so a box-shadow would ring its
  // bounding rectangle. It also counts as SVG-rendered, which made the wrapper
  // drop the class on the assumption ShapeSvgOverlay would paint it — and the
  // overlay never renders for a sticker, so glow and pulse did nothing at all.
  // Routing it down this same filter path is what makes them appear.
  const silhouetteAnim =
    animation === 'glow' ||
    animation === 'pulse' ||
    animation === 'trace' ||
    animation === 'gradient';
  const isDrawnArt = element.type === 'shape' && element.shape === 'sticker';
  const isTextNativeAnim = (element.type === 'text' || isDrawnArt) && silhouetteAnim;
  // `gradient` is a background clipped to the glyphs, which drawn art has
  // nothing to clip to, so it gets a hue cycle over its own colours instead,
  // which is the same idea (a colour that moves) on a surface that has one.
  const silhouetteAnimClass = !isTextNativeAnim
    ? undefined
    : isDrawnArt && animation === 'gradient'
      ? 'lvd-anim-sticker-gradient'
      : `lvd-anim-text-${animation}`;
  // Text wears it on its glyphs; drawn art wears it on the drawing, which the
  // art's own view mounts (StickerView), not on the label under it.
  // A sticker mounts it on its art (StickerView); a
  // timeline rail has no art view to mount it, so it sits on the element itself, where a
  // drop-shadow follows the drawing's silhouette just the same over its transparent box.
  const hasArtView = element.type === 'shape' && element.shape === 'sticker';
  const labelAnimClass = isDrawnArt ? undefined : silhouetteAnimClass;
  const artAnimClass = isDrawnArt && hasArtView ? silhouetteAnimClass : undefined;
  const ownAnimClass = isDrawnArt && !hasArtView ? silhouetteAnimClass : undefined;

  // trace / gradient / pulse / glow on an SVG-rendered shape (diamond,
  // triangle, hexagon, …) render against the true outline / fill / silhouette
  // inside ShapeSvgOverlay, so the wrapper must NOT also paint its
  // bounding-box version (pulse / glow as a box-shadow would ring the
  // rectangle, not the shape; trace / gradient would double up). Every other
  // animation — and these four on CSS-rendered shapes (circle / stadium /
  // square / browser, where the wrapper's border-radius already matches the
  // outline) and non-shape boxed elements — stays a wrapper class.
  const svgAnim =
    animation === 'trace' ||
    animation === 'gradient' ||
    animation === 'pulse' ||
    animation === 'glow'
      ? animation
      : undefined;
  // Only when the overlay really draws the shape: a self-faced kind (a plan board, a code block)
  // never renders it, so its effects stay on the element.
  const svgHandlesAnim =
    element.type === 'shape' && drawsShapeSvgOverlay(element.shape) && svgAnim !== undefined;
  // The pop-in entry animation must drop off the wrapper once it has run:
  // CSS animations RESTART when a node is moved in the DOM, and layer
  // reorders (bring to front / send to back) move every keyed sibling — so
  // a lingering pop-in class made unrelated elements visibly re-enter.
  // An element that never pops starts entered and arms nothing: one the board arrives with
  // (docs/specs/008-canvas/canvas-and-palette.md "Motion and animations").
  const arrivesWithBoard = useArrivesWithBoard();
  const [entered, setEntered] = useState(() => arrivesWithBoard);
  const [pops] = useState(!entered);
  useEffect(() => {
    if (!pops) return;
    // Comfortably past the pop-in duration; a plain timeout (not
    // animationend) so reduced-motion sessions converge too.
    const t = setTimeout(() => setEntered(true), 400);
    return () => clearTimeout(t);
  }, [pops]);
  // The Shape set's ring, halo, trace light and gradient sheet ride a child layer
  // (AnimationLayer), which the wrapper class reaches as `.lvd-anim-<a> > .lvd-anim-layer`. The
  // SVG overlay and the silhouette path draw their own, so they need no layer.
  // A sticky's own motions sit on the wrapper too; its fold and shadows ride the same layer.
  const stickyClass = bodySetClass(element, 'sticky');
  const layer =
    (svgAnim !== undefined && !svgHandlesAnim && !isTextNativeAnim) ||
    (stickyClass !== undefined && STICKY_LAYERED.has(element.animation!));
  const wrapperAnimClass = animation
    ? svgHandlesAnim || isTextNativeAnim
      ? (ownAnimClass ?? '')
      : `lvd-anim-${animation}`
    : stickyClass
      ? stickyClass
      : // Nothing else on the wrapper drives `animation` (a Drawing, Media or Table animation
        // sits on an inner node), so a new element still pops in.
        entered
        ? ''
        : 'animate-element-pop-in';

  // Pulse / glow rings take the element's accent (its stroke, else its
  // text colour); the speed factor scales the keyframe duration. See
  // .lvd-anim-* in globals.css.
  const animStyle: React.CSSProperties = element.animation
    ? ({
        // The accent is the border actually drawn (a theme's default stroke when the element sets
        // none); a text element has no border, so its own ink.
        '--lvd-anim-color':
          element.strokeColor ??
          (element.type === 'text' ? textColor : defaultStrokeColor(element, surface)),
        // The size the motions scale their travel to (unitless px, for calc()).
        '--lvd-anim-size': Math.round(Math.min(element.width, element.height)),
        '--lvd-w': Math.round(element.width),
        '--lvd-h': Math.round(element.height),
        '--lvd-anim-speed':
          ANIMATION_SPEED_FACTOR[element.animationSpeed ?? DEFAULT_ANIMATION_SPEED],
        // Repeat off = play once and hold (docs/specs/008-canvas/canvas-and-palette.md). The var inherits into
        // the SVG-overlay / text-native variants, so one knob covers all
        // three surfaces an animation can ride.
        ...(element.animationRepeat === false ? { '--lvd-anim-iter': 1 } : {}),
        // The moving-gradient animation blends the fill into the accent;
        // expose the fill (shared by the wrapper CSS gradient and the SVG
        // <stop> cycle that ShapeSvgOverlay inherits).
        ...(animation === 'gradient' || element.animation === 'peel'
          ? { '--lvd-anim-bg': element.fillColor ?? defaultFillColor(element, surface) }
          : {}),
        // Text-native gradient blends the element's own text colour
        // toward the accent (the box version blends the fill, which a
        // text element doesn't have); see .lvd-anim-text-gradient.
        ...(isTextNativeAnim && animation === 'gradient' ? { '--lvd-anim-text': textColor } : {}),
        // Play in Order (docs/specs/009-elements/step-number.md "Animation"): step n starts n - 1 beats after
        // step 1, the beat scaled like the animation's own duration, so a pulse walks the numbers in turn.
        ...stepSequenceDelay(element),
      } as React.CSSProperties)
    : {};

  return {
    labelAnimClass,
    artAnimClass,
    svgAnim: svgHandlesAnim ? svgAnim : undefined,
    wrapperAnimClass,
    animStyle,
    layer,
    // A sticky's own Peel / Lift / Slap draw on the layer too.
    layerAnim: animation ?? (stickyClass ? element.animation : undefined),
  };
}
