// A run's text effects as span style (docs/specs/008-canvas/text-effects.md "Rendering"; blueprint
// "Canvas style"): the marker band and the gradient fill, as background layers on the run's own span,
// cloned onto every line it wraps to. One function for the label and its editor, so starting to
// edit never moves a glyph.

import type { CSSProperties } from 'react';
import {
  HIGHLIGHT_PAD_EM,
  HIGHLIGHT_RADIUS_EM,
  highlightBandCss,
  isHighlightColour,
  shadowFilterCss,
  textGradientCss,
  textGradientOf,
  type ElementShadow,
  type TextRun,
} from '@livedocuments/document';

export function runEffectCss(
  run: Pick<TextRun, 'highlight' | 'gradient'>,
  // The element's shadow, when it has one: a gradient run trades the inherited text-shadow (which
  // would paint over its clipped fill) for a drop-shadow of its own.
  shadow?: ElementShadow,
): CSSProperties {
  const band = isHighlightColour(run.highlight) ? run.highlight : null;
  const gradient = textGradientOf(run.gradient);
  if (!band && !gradient) return {};
  const layers: string[] = [];
  const clips: string[] = [];
  if (gradient) {
    layers.push(textGradientCss(gradient));
    clips.push('text');
  }
  if (band) {
    layers.push(highlightBandCss(band));
    clips.push('border-box');
  }
  const css: CSSProperties = {
    backgroundImage: layers.join(', '),
    backgroundClip: clips.join(', '),
    WebkitBackgroundClip: clips.join(', '),
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  };
  if (gradient) {
    css.color = 'transparent';
    css.WebkitTextFillColor = 'transparent';
    if (shadow) {
      css.textShadow = 'none';
      css.filter = shadowFilterCss(shadow);
    }
  }
  if (band) {
    // The band reaches past the words without moving them.
    css.padding = `0 ${HIGHLIGHT_PAD_EM}em`;
    css.margin = `0 -${HIGHLIGHT_PAD_EM}em`;
    css.borderRadius = `${HIGHLIGHT_RADIUS_EM}em`;
  }
  return css;
}
