'use client';

// The quick style panel's actions (docs/specs/008-canvas/quick-style-panel.md): each choice is one commit
// over the selection (one undo step), recorded into style memory, and counted
// under its own telemetry token so panel use reads apart from menu use.

import { useMemo } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import type {
  PenColour,
  Element,
  QuickSwatchRole,
  QuickSwatchSlot,
  Tab,
  TextAlignX,
  ThemeDefinition,
} from '@livedesign/design';
import { track } from '@/lib/telemetry';
import { canvasSurface, PEN_INK } from '@livedesign/design';
import { quickStyleApplicability, quickStyleCaption } from '@/lib/quick-style-applicability';
import {
  applyPenStyle,
  heldPenStyle,
  INK_CHOICE,
  penWidthPx,
  strokesPenStyle,
  type PenColourChoice,
  type PenWidthId,
} from '@/lib/quick-style-pen';
import {
  applyHighlighterStyle,
  strokesHighlighterStyle,
  toolHighlighterStyle,
} from '@/lib/quick-style-highlighter';
import { highlighterWidthPx, type HighlighterWidthId } from '@/lib/highlighter-config';
import type { WhiteboardPen, WhiteboardPenId } from '@/lib/whiteboard-prefs';
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
  // The marker rows: the selected marker strokes, else the marker in hand.
  setPenColour: (colour: PenColourChoice) => void;
  setPenWidth: (width: PenWidthId) => void;
  // The Highlighter rows (docs/specs/008-canvas/highlighter.md "Settings"): the selected
  // highlights, else the armed tile's next stroke.
  setHighlighterColour: (colour: string) => void;
  setHighlighterWidth: (width: HighlighterWidthId) => void;
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
  // The marker in hand (null when none is), and how its settings change.
  pen?: {
    held: WhiteboardPen | null;
    update: (id: WhiteboardPenId, patch: { colour?: PenColour | null; width?: number }) => void;
  };
  // The highlighter's settings for the next stroke (useShapeDrawing), which the Highlighter rows
  // show and set while its tile is armed with nothing selected.
  highlighter?: {
    colour: string;
    width: number;
    setColour: (colour: string) => void;
    setWidth: (width: number) => void;
  };
  // The draw intent in hand: the armed Highlighter's rows show with nothing selected.
  toolIntent?: PendingDraw | null;
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
  const board = canvasSurface(resolveTabBackdrop(activeTab, appearance).backgroundColor);
  const ink = PEN_INK[board];
  const held = deps.pen?.held ?? null;
  const palette = useMemo(() => ({ board, ink }), [board, ink]);
  const intent = deps.toolIntent ?? null;
  // The Highlighter rows: the selected highlights first; with nothing selected, the armed tile.
  const hlColour = deps.highlighter?.colour;
  const hlWidth = deps.highlighter?.width;
  const highlighter = useMemo(() => {
    if (editsBlocked) return undefined;
    const strokes = strokesHighlighterStyle(selected);
    if (strokes) return strokes;
    const armed = intent?.type === 'freehand' && intent.variant === 'highlighter';
    return selected.length === 0 && armed && hlColour !== undefined && hlWidth !== undefined
      ? toolHighlighterStyle(hlColour, hlWidth)
      : undefined;
  }, [editsBlocked, selected, intent, hlColour, hlWidth]);
  const baseView = useMemo(() => {
    if (editsBlocked) return null;
    const plain = quickStyleView(selected, theme, overrides, palette.ink);
    // The marker rows: the selected marker strokes first; with nothing selected, the marker in hand.
    const pen =
      strokesPenStyle(selected, palette) ??
      (selected.length === 0 && held ? heldPenStyle(held, palette) : undefined);
    if (!pen) return plain;
    // A mixed selection's caption counts what the rows style (docs/specs/008-canvas/quick-style-panel.md
    // "Multi-selection"); strokes alone keep the pen rows' own name.
    const caption = quickStyleCaption(quickStyleApplicability(selected));
    return { ...(plain ?? { targetIds: [], sections: {} }), pen, ...(caption ? { caption } : {}) };
  }, [editsBlocked, selected, theme, overrides, held, palette]);
  // The Highlighter rows join whatever else the panel shows; alone, they are the whole panel. A
  // mixed selection's caption counts every styled element, highlights included.
  const view = useMemo((): QuickStyleView | null => {
    if (!highlighter) return baseView;
    const styled =
      (baseView?.targetIds.length ?? 0) +
      (baseView?.pen?.subject.kind === 'strokes' ? baseView.pen.subject.ids.length : 0);
    const caption =
      highlighter.subject.kind === 'strokes' && styled > 0
        ? `${styled + highlighter.subject.ids.length} elements`
        : baseView?.caption;
    return {
      ...(baseView ?? { targetIds: [], sections: {} }),
      highlighter,
      ...(caption ? { caption } : {}),
    };
  }, [baseView, highlighter]);

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

  const runPen = (
    patch: { colour?: PenColourChoice; width?: PenWidthId },
    telemetryType: string,
  ) => {
    const subject = view?.pen?.subject;
    if (!subject || editsBlocked) return;
    if (subject.kind === 'pen') {
      // Choosing what the pen already has changes (and reports) nothing.
      const pen = view.pen!;
      if (patch.colour !== undefined && patch.colour === pen.colour.value) return;
      if (patch.width !== undefined && patch.width === pen.width.value) return;
      // The marker's own setting, as its flyout sets it (and tracks it).
      deps.pen?.update(subject.id, {
        ...(patch.colour !== undefined
          ? { colour: patch.colour === INK_CHOICE ? null : patch.colour }
          : {}),
        ...(patch.width !== undefined ? { width: penWidthPx(patch.width) } : {}),
      });
      return;
    }
    const ids = new Set(subject.ids);
    commit((els) => els.map((el) => (ids.has(el.id) ? applyPenStyle(el, patch) : el)));
    track('Element', 'Changed', telemetryType);
  };

  const runHighlighter = (patch: { colour?: string; width?: HighlighterWidthId }) => {
    const style = view?.highlighter;
    if (!style || editsBlocked) return;
    if (style.subject.kind === 'tool') {
      // The next stroke's setting, not a change to the board.
      if (patch.colour !== undefined && patch.colour !== style.colour.value) {
        track('UI', 'Changed', 'HighlighterColour');
        deps.highlighter?.setColour(patch.colour);
      }
      if (patch.width !== undefined && patch.width !== style.width.value) {
        track('UI', 'Changed', 'HighlighterWidth');
        deps.highlighter?.setWidth(highlighterWidthPx(patch.width));
      }
      return;
    }
    const ids = new Set(style.subject.ids);
    commit((els) => els.map((el) => (ids.has(el.id) ? applyHighlighterStyle(el, patch) : el)));
    track('Element', 'Changed', patch.colour !== undefined ? 'QuickStroke' : 'QuickStrokeWidth');
  };

  return {
    view,
    setHighlighterColour: (colour) => runHighlighter({ colour }),
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
    setHighlighterWidth: (width) => runHighlighter({ width }),
    setPenColour: (colour) => runPen({ colour }, 'QuickStroke'),
    setPenWidth: (width) => runPen({ width }, 'QuickStrokeWidth'),
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
