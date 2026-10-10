'use client';

// The quick style panel's actions (docs/specs/008-canvas/quick-style-panel.md): each choice is one commit
// over the selection (one undo step), recorded into style memory, and counted
// under its own telemetry token so panel use reads apart from menu use.

import { useMemo, useReducer } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { toolCaption, toolPhantom } from '@/lib/quick-style-tool';
import type {
  PenColour,
  Element,
  QuickSwatchRole,
  QuickSwatchSlot,
  Tab,
  TextAlignX,
  ThemeDefinition,
} from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { canvasSurface, PEN_INK } from '@livediagram/document';
import {
  applyBoardStroke,
  applyBoardTextColour,
  applyQuickCorners,
  clearQuickCorners,
  onWhiteboard,
} from '@/lib/quick-style-whiteboard';
import { quickStyleApplicability, quickStyleCaption } from '@/lib/quick-style-applicability';
import {
  applyPenStyle,
  heldPenStyle,
  INK_CHOICE,
  penWidthPx,
  strokesPenStyle,
  tabCustomColours,
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
  type QuickCorners,
  type QuickIconAlign,
  type QuickStrokeStyle,
  type QuickStyleView,
  type QuickColourValue,
  type QuickSwatchValue,
  type QuickWidth,
} from '@/lib/quick-style';
import { styleKindOf, type StyleKindKey } from '@/lib/style-memory';
import { applyFillColorToEl, applyStrokeColorToEl, applyTextColorToEl } from '@/lib/style-presets';
import type { StyleMemoryApi } from './useStyleMemory';
import type { SwatchOverridesApi } from './useSwatchOverrides';

export type QuickStyleApi = {
  view: QuickStyleView | null;
  setStroke: (slot: QuickColourValue) => void;
  setBackground: (slot: QuickSwatchValue) => void;
  setTextColour: (slot: QuickColourValue) => void;
  setWidth: (width: QuickWidth) => void;
  setStrokeStyle: (style: QuickStrokeStyle) => void;
  setTextAlign: (align: TextAlignX) => void;
  setIconAlign: (align: QuickIconAlign) => void;
  // A whiteboard's Corners row (docs/specs/008-canvas/corner-radius.md).
  setCorners: (corners: QuickCorners) => void;
  // A whiteboard's Stroke and Text colour rows: the whiteboard's colours.
  setBoardStroke: (colour: PenColourChoice) => void;
  setBoardTextColour: (colour: PenColourChoice) => void;
  // A whiteboard's pen rows: the selected strokes, else the pen in hand.
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
  // The viewer works in Draw mode (docs/specs/007-editor/editor-modes.md): the board rows show.
  drawMode: boolean;
  theme: ThemeDefinition;
  editsBlocked: boolean;
  // The live active-tab elements, read at the moment of a choice.
  liveElements: () => Element[];
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  memory: StyleMemoryApi;
  swatchOverrides: SwatchOverridesApi;
  // The whiteboard pen in hand (null when none is), and how its settings change.
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
  // The draw intent in hand: on a whiteboard, a shape, line, arrow or text tool
  // with nothing selected makes the panel style what it draws next.
  toolIntent?: PendingDraw | null;
};

export function useQuickStyle(
  deps: QuickStyleDeps & { selectionIds: ReadonlySet<string> },
): QuickStyleApi {
  const { activeTab, theme, selectionIds, editsBlocked, liveElements, commit, memory } = deps;
  const { overrides } = deps.swatchOverrides;

  const selected = useMemo(
    () => activeTab.elements.filter((el) => selectionIds.has(el.id)),
    [activeTab.elements, selectionIds],
  );
  // In Draw mode (docs/specs/023-draw-mode/draw-mode.md "The quick style panel stays") the
  // defaults read as the board's ink, and the style memory is Draw mode's own
  // (useStyleMemory's board scope), never Diagram mode's.
  const whiteboard = deps.drawMode;
  // The stock colours in their version for the canvas the tab paints
  // (docs/specs/007-editor/editor-modes.md "One look"): the viewer's appearance on the Default
  // theme, the theme's own canvas otherwise.
  const { appearance } = useAppearance();
  const board = canvasSurface(resolveTabBackdrop(activeTab, appearance).backgroundColor);
  const ink = PEN_INK[board];
  const held = deps.pen?.held ?? null;
  // The custom colours used on this tab, the Marker colour row's second section.
  const palette = useMemo(
    () => ({
      board,
      ink,
      custom: whiteboard ? tabCustomColours(activeTab.elements) : [],
    }),
    [board, ink, whiteboard, activeTab.elements],
  );
  // A tool's choices land in memory, not the document: a version to re-read it.
  const [toolVersion, bumpTool] = useReducer((n: number) => n + 1, 0);
  const intent = deps.toolIntent ?? null;
  const phantom = useMemo(() => {
    if (!whiteboard || editsBlocked || selected.length > 0 || !intent) return null;
    const plain = toolPhantom(intent, theme);
    return plain ? memory.styleNewElement(plain) : null;
    // toolVersion: memory changed under the same intent. memory.scope: another document's (or
    // tab kind's) memory, whose style must never show as this one's next mark.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whiteboard, editsBlocked, selected.length, intent, theme, toolVersion, memory.scope]);
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
    if (phantom && intent) {
      const tool = onWhiteboard(
        quickStyleView([phantom], theme, overrides, palette.ink),
        [phantom],
        palette,
      );
      return tool && { ...tool, caption: toolCaption(intent) };
    }
    const plain = quickStyleView(selected, theme, overrides, palette.ink);
    if (!whiteboard) return plain;
    const board = onWhiteboard(plain, selected, palette);
    // Selected strokes first; with nothing selected, the pen in hand.
    const pen =
      strokesPenStyle(selected, palette) ??
      (selected.length === 0 && held ? heldPenStyle(held, palette) : undefined);
    // A mixed selection's caption counts what the rows style (docs/specs/008-canvas/quick-style-panel.md
    // "Multi-selection"); strokes alone keep the pen rows' own name.
    const caption = quickStyleCaption(quickStyleApplicability(selected));
    return pen
      ? { ...(board ?? { targetIds: [], sections: {} }), pen, ...(caption ? { caption } : {}) }
      : board;
  }, [editsBlocked, selected, theme, overrides, whiteboard, held, phantom, intent, palette]);
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
    if (phantom) {
      // The tool's next mark: remembered for its kind, nothing on the board changes.
      memory.recordEdit([phantom], [apply(phantom)]);
      bumpTool();
      track('Element', 'Changed', telemetryType);
      return;
    }
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
      const pen = view!.pen!;
      if (patch.colour !== undefined && patch.colour === pen.colour.value) return;
      if (patch.width !== undefined && patch.width === pen.width.value) return;
      // The pen's own setting, as its dock flyout sets it (and tracks it).
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
    setCorners: (corners) => run((el) => applyQuickCorners(el, corners), 'QuickCorners'),
    setBoardStroke: (colour) => run((el) => applyBoardStroke(el, colour), 'QuickStroke'),
    setBoardTextColour: (colour) =>
      run((el) => applyBoardTextColour(el, colour), 'QuickTextColour'),
    clearStyles: () => {
      if (!view) return;
      if (phantom) {
        const kind = styleKindOf(phantom, true);
        if (kind) memory.forget([kind]);
        bumpTool();
        track('Element', 'Changed', 'QuickClearStyles');
        return;
      }
      // On a whiteboard the corners are a quick-style field too (the Corners row).
      run(
        (el) =>
          whiteboard ? clearQuickCorners(clearQuickStyle(el, theme)) : clearQuickStyle(el, theme),
        'QuickClearStyles',
      );
      // Forget every kind the selection styles, not only the ones that
      // changed: a shape already at the default can have a memory waiting.
      const targets = new Set(view.targetIds);
      const kinds = new Set<StyleKindKey>();
      for (const el of selected) {
        const kind = targets.has(el.id) ? styleKindOf(el, whiteboard) : null;
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
