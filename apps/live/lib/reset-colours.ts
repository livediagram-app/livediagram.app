// "Reset to theme" for one element (docs/specs/008-canvas/canvas-and-palette.md, the Colours
// category): every colour override goes, so the element falls back to what the tab's theme
// dictates. A theme with its own element colours writes them, since `addBoxed` is what normally
// writes them on create; the brand default (all null) just deletes the overrides. Bindings go
// with the colours they bound, and so does a whiteboard stock colour stored by name
// (docs/specs/023-draw-mode/draw-mode.md "Imported and pasted content"), which would otherwise
// show again the moment the explicit colour is cleared.
import type { Element, ThemeDefinition } from '@livediagram/document';

export function resetElementColours(el: Element, theme: ThemeDefinition): Element {
  if (el.type === 'shape') {
    return {
      ...el,
      ...(theme.elementFill !== null ? { fillColor: theme.elementFill } : { fillColor: undefined }),
      ...(theme.elementStroke !== null
        ? { strokeColor: theme.elementStroke }
        : { strokeColor: undefined }),
      ...(theme.elementText !== null ? { textColor: theme.elementText } : { textColor: undefined }),
      // Reset-to-theme also drops any colour-preset binding (docs/specs/010-palette/style-presets.md)
      // and any quick-swatch binding (docs/specs/008-canvas/quick-style-panel.md).
      colorPreset: undefined,
      strokeSwatch: undefined,
      fillSwatch: undefined,
      penColour: undefined,
      penTextColour: undefined,
    };
  }
  if (el.type === 'text') {
    return {
      ...el,
      ...(theme.elementText !== null ? { textColor: theme.elementText } : { textColor: undefined }),
      fillColor: undefined,
      strokeColor: undefined,
      textSwatch: undefined,
      penTextColour: undefined,
    };
  }
  if (el.type === 'sticky') {
    // A sticky's amber palette is its identity: wipe any user overrides,
    // but never apply theme colours.
    const { fillColor: _f, strokeColor: _s, textColor: _t, ...rest } = el;
    return rest as typeof el;
  }
  if (el.type === 'table') {
    // Reset to theme grid + text; clear cell fill + header overrides.
    return {
      ...el,
      ...(theme.elementStroke !== null
        ? { strokeColor: theme.elementStroke }
        : { strokeColor: undefined }),
      ...(theme.elementText !== null ? { textColor: theme.elementText } : { textColor: undefined }),
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
      ...(theme.elementStroke !== null
        ? { strokeColor: theme.elementStroke }
        : { strokeColor: undefined }),
      strokeSwatch: undefined,
      penColour: undefined,
    };
  }
  return el;
}
