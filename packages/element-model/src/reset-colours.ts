// "Reset to Theme" for one element (each product's docs/specs/008-canvas/canvas-and-palette.md, the Colours
// category), every canvas editor's one copy: every colour override goes, so the element falls back to what the
// tab's theme dictates. A theme with its own element colours writes them, since `addBoxed` is what normally writes
// them on create; the brand default (all null) just deletes the overrides. Bindings go with the colours they bound,
// and so does a stock colour stored by name, which would otherwise show again the moment the explicit colour is
// cleared. An arrow's Pointer colour sits in the same Colours section, so it goes too and the heads follow the line.
//
// Overrides are cleared by writing `undefined` (not by deleting the key) so a commit's diff sees the field cleared.
import type { Element } from './element';
import type { ThemeDefinition } from './themes';

export type ResetTheme = Pick<ThemeDefinition, 'elementFill' | 'elementStroke' | 'elementText'>;

export type ResetColoursOptions<E> = {
  /** An element the product keeps exactly as stored (livehuddle's retired kinds): a reset skips it. */
  keep?: (el: E) => boolean;
};

export function resetElementColours<E extends Element>(
  el: E,
  theme: ResetTheme,
  options: ResetColoursOptions<E> = {},
): E {
  if (options.keep?.(el)) return el;
  const stroke = { strokeColor: theme.elementStroke ?? undefined };
  const text = { textColor: theme.elementText ?? undefined };
  if (el.type === 'shape') {
    return {
      ...el,
      fillColor: theme.elementFill ?? undefined,
      ...stroke,
      ...text,
      // Reset-to-theme also drops any colour-preset binding (docs/specs/010-palette/style-presets.md)
      // and any quick-swatch binding (docs/specs/008-canvas/quick-style-panel.md).
      colorPreset: undefined,
      strokeSwatch: undefined,
      fillSwatch: undefined,
      penColour: undefined,
      penTextColour: undefined,
      // A chart's palette is its colours (docs/specs/009-elements/pie-chart.md): Reset to Default under its
      // Presets grid hands it back to the theme's ramp.
      chartPalette: undefined,
    };
  }
  if (el.type === 'text') {
    return {
      ...el,
      ...text,
      fillColor: undefined,
      strokeColor: undefined,
      textSwatch: undefined,
      penTextColour: undefined,
    };
  }
  if (el.type === 'sticky') {
    // A sticky's amber palette is its identity: wipe any user overrides (its named text colour too),
    // but never apply theme colours.
    const {
      fillColor: _f,
      strokeColor: _s,
      textColor: _t,
      penTextColour: _p,
      ...rest
    } = el as E & {
      fillColor?: unknown;
      strokeColor?: unknown;
      textColor?: unknown;
      penTextColour?: unknown;
    };
    return rest as E;
  }
  if (el.type === 'table') {
    // Grid + text from the theme; cell fill and header overrides cleared.
    return {
      ...el,
      ...stroke,
      ...text,
      fillColor: undefined,
      headerFill: undefined,
      headerTextColor: undefined,
      // The look goes with the colours it painted: this is the
      // "back to plain theme colours" button, not "this theme's Banded".
      tablePreset: undefined,
    };
  }
  if (el.type === 'arrow') {
    return {
      ...el,
      ...stroke,
      strokeSwatch: undefined,
      penColour: undefined,
      // The Pointer row beside the Line row: unset, the heads take the line's colour again.
      arrowheadColor: undefined,
    };
  }
  return el;
}
