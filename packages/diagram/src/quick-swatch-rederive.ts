// A quick-swatch binding re-read for a theme (docs/specs/008-canvas/quick-style-panel.md "Colours"): the
// element stores the slot its colour came from, so a theme change writes that
// slot's colour in the new theme instead of preserving the old one as a custom.
import type { Element } from './index';
import { isQuickSwatchSlot, quickSwatchColor } from './quick-swatches';
import type { ThemeDefinition } from './themes';

export function rederiveQuickSwatches(el: Element, theme: ThemeDefinition): Element {
  if (el.type !== 'shape' && el.type !== 'arrow') return el;
  const stroke = isQuickSwatchSlot(el.strokeSwatch) ? el.strokeSwatch : null;
  const fill = el.type === 'shape' && isQuickSwatchSlot(el.fillSwatch) ? el.fillSwatch : null;
  if (stroke === null && fill === null) return el;
  return {
    ...el,
    ...(stroke !== null ? { strokeColor: quickSwatchColor(theme, 'stroke', stroke) } : {}),
    ...(fill !== null ? { fillColor: quickSwatchColor(theme, 'fill', fill) } : {}),
  };
}
