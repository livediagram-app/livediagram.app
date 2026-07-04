import { useEffect, useState } from 'react';
import { ANIMATION_SPEED_FACTOR, defaultFillColor, type BoxedElement } from '@livediagram/diagram';
import { isSvgRenderedShape } from '@/components/canvas/shape-svg-overlay';

// The looping-animation slice (spec/09), lifted out of BoxedElementView:
// which surface each animation kind rides (the wrapper box, the rendered
// text glyphs, or the shape's true SVG outline), the one-shot pop-in
// entry class and its drop-off timer, and the CSS custom properties the
// keyframes read. The view mounts the returned classes / style on its
// wrapper and label nodes.
export function useBoxedElementAnimation(element: BoxedElement, textColor: string) {
  // A standalone text element has no fill or border, so the box-shadow / ring /
  // background animations (glow / pulse / trace / gradient) would animate an
  // invisible bounding rectangle around the words. For those, ride the rendered
  // glyphs instead: the wrapper drops the box class (see wrapperAnimClass below)
  // and the label content node gets the matching .lvd-anim-text-* class. The
  // transform animations (bounce, float, swing, …) already move the text with
  // the box, so they stay on the wrapper unchanged.
  const isTextNativeAnim =
    element.type === 'text' &&
    (element.animation === 'glow' ||
      element.animation === 'pulse' ||
      element.animation === 'trace' ||
      element.animation === 'gradient');
  const labelAnimClass = isTextNativeAnim ? `lvd-anim-text-${element.animation}` : undefined;

  // trace / gradient / pulse / glow on an SVG-rendered shape (diamond,
  // triangle, hexagon, …) render against the true outline / fill / silhouette
  // inside ShapeSvgOverlay, so the wrapper must NOT also paint its
  // bounding-box version (pulse / glow as a box-shadow would ring the
  // rectangle, not the shape; trace / gradient would double up). Every other
  // animation — and these four on CSS-rendered shapes (circle / stadium /
  // square / browser, where the wrapper's border-radius already matches the
  // outline) and non-shape boxed elements — stays a wrapper class.
  const svgAnim =
    element.animation === 'trace' ||
    element.animation === 'gradient' ||
    element.animation === 'pulse' ||
    element.animation === 'glow'
      ? element.animation
      : undefined;
  const svgHandlesAnim =
    element.type === 'shape' && isSvgRenderedShape(element.shape) && svgAnim !== undefined;
  // The pop-in entry animation must drop off the wrapper once it has run:
  // CSS animations RESTART when a node is moved in the DOM, and layer
  // reorders (bring to front / send to back) move every keyed sibling — so
  // a lingering pop-in class made unrelated elements visibly re-enter.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    // Comfortably past the pop-in duration; a plain timeout (not
    // animationend) so reduced-motion sessions converge too.
    const t = setTimeout(() => setEntered(true), 400);
    return () => clearTimeout(t);
  }, []);
  const wrapperAnimClass = element.animation
    ? svgHandlesAnim || isTextNativeAnim
      ? ''
      : `lvd-anim-${element.animation}`
    : entered
      ? ''
      : 'animate-pop-in';

  // Pulse / glow rings take the element's accent (its stroke, else its
  // text colour); the speed factor scales the keyframe duration. See
  // .lvd-anim-* in globals.css.
  const animStyle: React.CSSProperties = element.animation
    ? ({
        '--lvd-anim-color': element.strokeColor ?? textColor,
        '--lvd-anim-speed': ANIMATION_SPEED_FACTOR[element.animationSpeed ?? 'normal'],
        // The moving-gradient animation blends the fill into the accent;
        // expose the fill (shared by the wrapper CSS gradient and the SVG
        // <stop> cycle that ShapeSvgOverlay inherits).
        ...(element.animation === 'gradient'
          ? { '--lvd-anim-bg': element.fillColor ?? defaultFillColor(element) }
          : {}),
        // Text-native gradient blends the element's own text colour
        // toward the accent (the box version blends the fill, which a
        // text element doesn't have); see .lvd-anim-text-gradient.
        ...(isTextNativeAnim && element.animation === 'gradient'
          ? { '--lvd-anim-text': textColor }
          : {}),
      } as React.CSSProperties)
    : {};

  return { labelAnimClass, svgAnim, wrapperAnimClass, animStyle };
}
