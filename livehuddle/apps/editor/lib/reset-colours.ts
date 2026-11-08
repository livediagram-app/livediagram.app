// "Reset to Theme" for one element (docs/specs/008-canvas/canvas-and-palette.md, the Colours
// category): every colour override goes, so the element falls back to what the tab's theme
// dictates. A theme with its own element colours writes them, since `addBoxed` is what normally
// writes them on create; the brand default (all null) just deletes the overrides. Bindings go
// with the colours they bound, and so does a whiteboard stock colour stored by name
// (docs/specs/023-draw-mode/draw-mode.md "Imported and pasted content"), which would otherwise
// show again the moment the explicit colour is cleared.
import { isRetiredElement, type Element, type ThemeDefinition } from '@livehuddle/document';

export function resetElementColours(el: Element, theme: ThemeDefinition): Element {
  // A retired element, a deleted shape kind included, keeps what it holds
  // (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements"): a selection-wide reset skips it.
  if (isRetiredElement(el)) return el;
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
    return rest;
  }
  // A stored arrow, like every retired element, keeps what it holds
  // (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine").
  return el;
}
