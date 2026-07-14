import type { CSSProperties } from 'react';
import {
  BORDER_RADIUS_PX,
  BORDER_STROKE_PX,
  DEFAULT_BORDER_STROKE,
  DEFAULT_BORDER_STYLE,
  defaultFillColor,
  defaultStrokeColor,
  isChartShape,
  isChecklistShape,
  isCodeBlockShape,
  isRailShape,
  isRatingShape,
  shadowBoxCss,
  shadowFilterCss,
  supportsShadow,
  type BoxedElement,
} from '@livediagram/diagram';
import { isCssNativeBorderStyle } from '@/components/canvas/border-css';
import { isSvgRenderedShape } from '@/components/canvas/shape-svg-overlay';

// The wrapper className + inline style for a boxed element, derived purely
// from the element + its selection state. Encodes the per-type styling
// rules: single vs multi selection rings; the remote-selector border/halo;
// SVG-rendered shapes carrying no wrapper border; text / image / freehand /
// table using an outline rather than a real border; and the user-pickable
// border width / style / radius for CSS shapes. Lifted out of
// BoxedElementView so the rules are unit-testable.
export function describeVariant(
  element: BoxedElement,
  isSelected: boolean,
  isMultiSelected: boolean,
  remoteBorderColor: string | null,
): { className: string; style: CSSProperties } {
  // Multi-selection uses a much louder ring (solid brand-500, offset)
  // so a busy canvas with many selected elements reads unambiguously.
  // Single selection keeps the subtler brand-200 / brand-300 rings.
  const singleRing = (cls: string) => (isSelected && !isMultiSelected ? cls : '');
  const multiRing = isMultiSelected ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-white' : '';
  // When a remote participant has this element selected, draw a thicker
  // 3-pixel border in their colour so the realtime signal is glanceable.
  // We apply it as a box-shadow inset on text (which has no real border)
  // and as an actual border on shape / sticky. The local selection ring
  // stays on top so the active user still sees their own selection.
  const remoteBorderWidth = remoteBorderColor ? 3 : 0;
  // Element drop shadow (spec/86). Two render paths: box-shadow follows
  // the border box + radius (right for opaque rectangular bodies, and
  // cheap; the inline value overrides the cosmetic shadow-sm/md classes
  // since both drive the same property); drop-shadow() follows the drawn
  // alpha instead, needed when the wrapper is transparent and the visible
  // body is an inner SVG / bitmap — a box-shadow there would draw a
  // floating rectangle around nothing.
  const shadow = supportsShadow(element) ? element.shadow : undefined;
  const boxShadow: CSSProperties = shadow ? { boxShadow: shadowBoxCss(shadow) } : {};
  const filterShadow: CSSProperties = shadow ? { filter: shadowFilterCss(shadow) } : {};
  switch (element.type) {
    case 'shape': {
      const ring = `${singleRing('ring-2 ring-brand-200')} ${multiRing}`.trim();
      // SVG-rendered shapes (diamond, cylinder, parallelogram, hexagon,
      // document) draw themselves via an inner SVG overlay; the wrapper div
      // carries no border/background, just the selection ring. The
      // border colour for those propagates through ShapeSvgOverlay's
      // `stroke` prop, not this style block.
      if (isSvgRenderedShape(element.shape)) {
        return {
          className: `text-brand-800 ${ring}`,
          style: { borderRadius: '4px', ...filterShadow },
        };
      }
      // Timeline rail (spec/51) + rating (spec/52) + charts (spec/53) +
      // code block (spec/82) + checklist (spec/83) paint their own content,
      // so the wrapper carries no box border / background — just the
      // selection ring.
      if (
        isRailShape(element.shape) ||
        isRatingShape(element.shape) ||
        isChartShape(element.shape) ||
        isCodeBlockShape(element.shape) ||
        isChecklistShape(element.shape)
      ) {
        return { className: ring, style: { borderRadius: '4px', ...filterShadow } };
      }
      // CSS-rendered shapes (square / circle / stadium and the
      // rectangular device frames). The user-pickable border
      // strength + style apply here as the HTML element's
      // borderWidth / borderStyle; borderRadius only applies to
      // free-corner shapes (NOT circle / stadium, whose radii
      // are part of the silhouette).
      const fixedRadius =
        element.shape === 'circle' ? '50%' : element.shape === 'stadium' ? '9999px' : null;
      const userRadius =
        element.borderRadius !== undefined ? BORDER_RADIUS_PX[element.borderRadius] : null;
      const strokePx = BORDER_STROKE_PX[element.strokeWidth ?? DEFAULT_BORDER_STROKE];
      const style = element.strokeStyle ?? DEFAULT_BORDER_STYLE;
      // The composite dash patterns can't be drawn by a CSS border, so
      // BoxedElementView strokes them with an SVG overlay (BoxBorderOverlay)
      // instead. Here we drop the CSS border for those so the two don't
      // double up. Remote-selection highlights are always a solid border,
      // so they keep the CSS path regardless of the picked pattern.
      const useSvgBorder = !remoteBorderColor && !isCssNativeBorderStyle(style);
      // Transparent-fill shapes (icons, outline boxes) take the filter
      // path: a box-shadow behind a see-through body reads as a floating
      // grey rectangle.
      const fill = element.fillColor ?? defaultFillColor(element);
      return {
        // Drop the border-2 class so we can drive border width from
        // the user's strokeWidth pick instead of a fixed 2px.
        className: `text-brand-800 shadow-sm ${ring}`,
        style: {
          ...(fill === 'transparent' ? filterShadow : boxShadow),
          borderRadius: fixedRadius ?? (userRadius !== null ? `${userRadius}px` : '8px'),
          backgroundColor: fill,
          borderColor: remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element),
          borderWidth: useSvgBorder ? 0 : remoteBorderColor ? remoteBorderWidth : strokePx,
          borderStyle: useSvgBorder
            ? 'none'
            : remoteBorderColor
              ? 'solid'
              : // Guarded by useSvgBorder above: only CSS-native styles reach here.
                (style as CSSProperties['borderStyle']),
        },
      };
    }
    case 'text': {
      const ring = isMultiSelected
        ? multiRing
        : isSelected
          ? 'ring-2 ring-brand-300 ring-offset-2 ring-offset-white'
          : // Unselected text has no border / outline — it reads as plain
            // text on the canvas; the selection ring only appears on select.
            '';
      return {
        className: `text-slate-800 rounded-sm ${ring}`,
        // Text elements have no real border; render the remote-selector
        // halo as an outline so it shows up regardless of the element
        // having transparent fill.
        style: remoteBorderColor
          ? { outline: `${remoteBorderWidth}px solid ${remoteBorderColor}`, outlineOffset: 2 }
          : {},
      };
    }
    case 'sticky': {
      const ring = `${singleRing('ring-2 ring-brand-200')} ${multiRing}`.trim();
      return {
        className: `border text-amber-950 shadow-md ${ring}`,
        style: {
          ...boxShadow,
          borderRadius: '4px',
          backgroundColor: element.fillColor ?? defaultFillColor(element),
          borderColor: remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element),
          borderWidth: remoteBorderColor ? remoteBorderWidth : undefined,
        },
      };
    }
    case 'image': {
      // The image element renders its bitmap (or upload placeholder)
      // via the dedicated ImageElementView, which slots in as the
      // children of this wrapper. The wrapper here just contributes
      // the selection ring + remote-selector border, with a
      // transparent background so the bitmap shows through.
      // No overflow-hidden on the wrapper: the lock / comment /
      // note badges sit at -right-1 / -top-1 outside the box, and
      // clipping the wrapper cuts them off (the bitmap clipping
      // happens inside ImageElementView instead).
      const ring = `${singleRing('ring-2 ring-brand-300')} ${multiRing}`.trim();
      return {
        className: `rounded ${ring}`,
        style: {
          // Filter path: the bitmap clips inside ImageElementView, so the
          // wrapper is transparent and a box-shadow would outline the box,
          // not the (possibly letterboxed) image.
          ...filterShadow,
          borderColor: remoteBorderColor ?? undefined,
          borderWidth: remoteBorderColor ? remoteBorderWidth : undefined,
          borderStyle: remoteBorderColor ? 'solid' : undefined,
        },
      };
    }
    case 'freehand': {
      // The freehand element renders its SVG path as the child
      // content. The wrapper here just contributes the selection
      // ring + remote-selector outline, with a transparent
      // background so the SVG geometry is what the user sees, not
      // a bounding rectangle. Same shape as the image case
      // (selection-via-outline, not selection-via-border) so a
      // dashed / dotted stroke doesn't get overridden by a box
      // border around it.
      const ring = `${singleRing('ring-2 ring-brand-300')} ${multiRing}`.trim();
      return {
        className: `${ring}`,
        style: remoteBorderColor
          ? { outline: `${remoteBorderWidth}px solid ${remoteBorderColor}`, outlineOffset: 2 }
          : {},
      };
    }
    case 'table': {
      // TableView draws the grid + cell borders as the child
      // content; the wrapper only contributes the selection ring
      // (transparent background so the grid is what shows).
      const ring = `${singleRing('ring-2 ring-brand-300')} ${multiRing}`.trim();
      return {
        className: `${ring}`,
        style: remoteBorderColor
          ? { outline: `${remoteBorderWidth}px solid ${remoteBorderColor}`, outlineOffset: 2 }
          : {},
      };
    }
    case 'annotation': {
      // A themed circle marker (spec/38): fill + ring from the element's
      // colours, fully round. The note glyph paints as the child content.
      const ring = `${singleRing('ring-2 ring-brand-200')} ${multiRing}`.trim();
      return {
        className: `shadow-sm ${ring}`,
        style: {
          borderRadius: '50%',
          backgroundColor: element.fillColor ?? defaultFillColor(element),
          borderColor: remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element),
          borderWidth: remoteBorderColor ? remoteBorderWidth : 2,
          borderStyle: 'solid',
        },
      };
    }
    case 'link-card': {
      // A bookmark card (spec/40): fill background + 1px border, rounded.
      // The favicon / title / image render as the child content
      // (LinkCardView); overflow-hidden clips the image to the rounded box.
      const ring = `${singleRing('ring-2 ring-brand-200')} ${multiRing}`.trim();
      return {
        className: `overflow-hidden shadow-sm ${ring}`,
        style: {
          ...boxShadow,
          borderRadius: '10px',
          backgroundColor: element.fillColor ?? defaultFillColor(element),
          borderColor: remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element),
          borderWidth: remoteBorderColor ? remoteBorderWidth : 1,
          borderStyle: 'solid',
        },
      };
    }
  }
}
