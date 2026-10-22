'use client';

// The quick style panel's actions (docs/specs/008-canvas/quick-style-panel.md): each choice is one commit
// over the selection (one undo step), recorded into style memory, and counted
// under its own telemetry token so panel use reads apart from menu use.

import { useMemo } from 'react';
import type {
  Element,
  QuickSwatchRole,
  QuickSwatchSlot,
  Tab,
  TextAlignX,
  ThemeDefinition,
} from '@livedocuments/document';
import { track } from '@/lib/telemetry';
import { canvasSurface, PEN_INK } from '@livedocuments/document';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { resolveTabBackdrop } from '@/lib/themes';
import {
  applyQuickFill,
  applyQuickIconAlign,
  applyQuickStroke,
  applyQuickStrokeStyle,
  applyQuickTextAlign,
  applyQuickTextColour,
  applyQuickWidth,
  clearQuickStyle,
  quickStyleView,
  type QuickIconAlign,
  type QuickStrokeStyle,
  type QuickStyleView,
  type QuickColourValue,
  type QuickFillValue,
  type QuickWidth,
} from '@/lib/quick-style';
import { styleKindOf, type StyleKindKey } from '@/lib/style-memory';
import { applyFillColorToEl, applyStrokeColorToEl, applyTextColorToEl } from '@/lib/style-presets';
import type { StyleMemoryApi } from './useStyleMemory';
import type { SwatchOverridesApi } from './useSwatchOverrides';

export type QuickStyleApi = {
  view: QuickStyleView | null;
  setStroke: (slot: QuickColourValue) => void;
  setBackground: (slot: QuickFillValue) => void;
  setTextColour: (slot: QuickColourValue) => void;
  setWidth: (width: QuickWidth) => void;
  setStrokeStyle: (style: QuickStrokeStyle) => void;
  setTextAlign: (align: TextAlignX) => void;
  setIconAlign: (align: QuickIconAlign) => void;
  // A row's More colours (docs/specs/004-interface-design/colour-picker.md "Skins"): any colour
  // from the full picker, a standard one by name on a line or text.
  setColour: (role: QuickSwatchRole, colour: string) => void;
  clearStyles: () => void;
  // Custom swatches (docs/specs/008-canvas/quick-style-panel.md): edit the palette, style nothing.
  setSwatchOverride: (role: QuickSwatchRole, slot: QuickSwatchSlot, hex: string) => void;
  clearSwatchOverride: (role: QuickSwatchRole, slot: QuickSwatchSlot) => void;
};

// Everything the Quick Style view is built from but the selection, which its host reads from the store.
export type QuickStyleDeps = {
  activeTab: Tab;
  theme: ThemeDefinition;
  editsBlocked: boolean;
  // A Participant styles only what it may recolour (docs/specs/013-workspace/share-roles.md); absent for an Editor.
  canStyle?: (el: Element) => boolean;
  // The live active-tab elements, read at the moment of a choice.
  liveElements: () => Element[];
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  memory: StyleMemoryApi;
  swatchOverrides: SwatchOverridesApi;
};

export function useQuickStyle(
  deps: QuickStyleDeps & { selectionIds: ReadonlySet<string> },
): QuickStyleApi {
  const { activeTab, theme, selectionIds, liveElements, commit, memory, canStyle } = deps;
  const { overrides } = deps.swatchOverrides;

  const selected = useMemo(
    () => activeTab.elements.filter((el) => selectionIds.has(el.id)),
    [activeTab.elements, selectionIds],
  );
  const editsBlocked = deps.editsBlocked || (!!canStyle && selected.some((el) => !canStyle(el)));
  // The stock colours in their version for the canvas the tab paints
  // (docs/specs/008-canvas/canvas-and-palette.md): the viewer's appearance on the Default
  // theme, the theme's own canvas otherwise.
  const { appearance } = useAppearance();
  const ink = PEN_INK[canvasSurface(resolveTabBackdrop(activeTab, appearance).backgroundColor)];
  const view = useMemo(
    () => (editsBlocked ? null : quickStyleView(selected, theme, overrides, ink)),
    [editsBlocked, selected, theme, overrides, ink],
  );

  // Map the view's targets through `apply`, as one commit, then remember it.
  const run = (apply: (el: Element) => Element, telemetryType: string) => {
    if (!view || editsBlocked) return;
    const ids = new Set(view.targetIds);
    const before = liveElements();
    const map = (els: Element[]) => els.map((el) => (ids.has(el.id) ? apply(el) : el));
    const after = map(before);
    commit(map);
    memory.recordEdit(before, after);
    track('Element', 'Changed', telemetryType);
  };

  return {
    view,
    setColour: (role, colour) =>
      run(
        (el) =>
          role === 'stroke'
            ? applyStrokeColorToEl(el, colour)
            : role === 'fill'
              ? applyFillColorToEl(el, colour)
              : applyTextColorToEl(el, colour),
        role === 'stroke' ? 'QuickStroke' : role === 'fill' ? 'QuickBackground' : 'QuickTextColour',
      ),
    setStroke: (slot) => run((el) => applyQuickStroke(el, theme, slot, overrides), 'QuickStroke'),
    setBackground: (slot) =>
      run((el) => applyQuickFill(el, theme, slot, overrides), 'QuickBackground'),
    setTextColour: (slot) =>
      run((el) => applyQuickTextColour(el, theme, slot, overrides), 'QuickTextColour'),
    setWidth: (width) => run((el) => applyQuickWidth(el, width), 'QuickStrokeWidth'),
    setStrokeStyle: (style) => run((el) => applyQuickStrokeStyle(el, style), 'QuickStrokeStyle'),
    setTextAlign: (align) => run((el) => applyQuickTextAlign(el, align), 'QuickTextAlign'),
    setIconAlign: (align) => run((el) => applyQuickIconAlign(el, align), 'QuickIconAlign'),
    clearStyles: () => {
      if (!view) return;
      run((el) => clearQuickStyle(el, theme), 'QuickClearStyles');
      // Forget every kind the selection styles, not only the ones that
      // changed: a shape already at the default can have a memory waiting.
      const targets = new Set(view.targetIds);
      const kinds = new Set<StyleKindKey>();
      for (const el of selected) {
        const kind = targets.has(el.id) ? styleKindOf(el) : null;
        if (kind) kinds.add(kind);
      }
      memory.forget([...kinds]);
    },
    setSwatchOverride: (role, slot, hex) => {
      track('UI', 'Changed', 'QuickSwatchCustom');
      deps.swatchOverrides.setOverride(role, slot, hex);
    },
    clearSwatchOverride: (role, slot) => {
      track('UI', 'Changed', 'QuickSwatchReset');
      deps.swatchOverrides.clearOverride(role, slot);
    },
  };
}
