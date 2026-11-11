// A quick-swatch binding re-read for a theme (docs/specs/008-canvas/quick-style-panel.md "Colours"): the
// element stores the slot its colour came from, so a theme change writes that
// slot's colour in the new theme instead of preserving the old one as a custom.
import type { Element } from './element';
import { isQuickSwatchSlot, quickSwatchColor } from './quick-swatches';
import type { ThemeDefinition } from './themes';

// The slots an element may store: a text's text colour, a shape's or an arrow's stroke, a shape's fill.
type Swatches = { textSwatch?: unknown; strokeSwatch?: unknown; fillSwatch?: unknown };

export function rederiveQuickSwatches<E extends Element>(el: E, theme: ThemeDefinition): E {
  const slots = el as E & Swatches;
  if (el.type === 'text') {
    if (!isQuickSwatchSlot(slots.textSwatch)) return el;
    return { ...el, textColor: quickSwatchColor(theme, 'text', slots.textSwatch) };
  }
  if (el.type !== 'shape' && el.type !== 'arrow') return el;
  const stroke = isQuickSwatchSlot(slots.strokeSwatch) ? slots.strokeSwatch : null;
  const fill = el.type === 'shape' && isQuickSwatchSlot(slots.fillSwatch) ? slots.fillSwatch : null;
  if (stroke === null && fill === null) return el;
  return {
    ...el,
    ...(stroke !== null ? { strokeColor: quickSwatchColor(theme, 'stroke', stroke) } : {}),
    ...(fill !== null ? { fillColor: quickSwatchColor(theme, 'fill', fill) } : {}),
  };
}
