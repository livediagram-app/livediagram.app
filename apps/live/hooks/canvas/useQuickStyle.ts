'use client';

// The quick style panel's actions (docs/specs/008-canvas/quick-style-panel.md): each choice is one commit
// over the selection (one undo step), recorded into style memory, and counted
// under its own telemetry token so panel use reads apart from menu use.

import { useMemo, useReducer } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { toolCaption, toolPhantom } from '@/lib/quick-style-tool';
import type {
  Element,
  QuickSwatchRole,
  QuickSwatchSlot,
  Tab,
  TextAlignX,
  ThemeDefinition,
} from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { isWhiteboardTab, WHITEBOARD_INK } from '@livediagram/document';
import { onWhiteboard } from '@/lib/quick-style-whiteboard';
import {
  applyPenStyle,
  heldPenStyle,
  INK_CHOICE,
  penWidthPx,
  strokesPenStyle,
  type PenColourChoice,
  type PenWidthId,
} from '@/lib/quick-style-pen';
import type { WhiteboardPen, WhiteboardPenId } from '@/lib/whiteboard-prefs';
import { useAppearance } from '@/hooks/ui/useAppearance';
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
  type QuickSwatchValue,
  type QuickWidth,
} from '@/lib/quick-style';
import { styleKindOf, type StyleKindKey } from '@/lib/style-memory';
import type { StyleMemoryApi } from './useStyleMemory';
import type { SwatchOverridesApi } from './useSwatchOverrides';

export type QuickStyleApi = {
  view: QuickStyleView | null;
  setStroke: (slot: QuickSwatchValue) => void;
  setBackground: (slot: QuickSwatchValue) => void;
  setTextColour: (slot: QuickSwatchValue) => void;
  setWidth: (width: QuickWidth) => void;
  setStrokeStyle: (style: QuickStrokeStyle) => void;
  setTextAlign: (align: TextAlignX) => void;
  setIconAlign: (align: QuickIconAlign) => void;
  // A whiteboard's pen rows: the selected strokes, else the pen in hand.
  setPenColour: (colour: PenColourChoice) => void;
  setPenWidth: (width: PenWidthId) => void;
  clearStyles: () => void;
  // Custom swatches (docs/specs/008-canvas/quick-style-panel.md): edit the palette, style nothing.
  setSwatchOverride: (role: QuickSwatchRole, slot: QuickSwatchSlot, hex: string) => void;
  clearSwatchOverride: (role: QuickSwatchRole, slot: QuickSwatchSlot) => void;
};

export function useQuickStyle(deps: {
  activeTab: Tab;
  theme: ThemeDefinition;
  selectionIds: ReadonlySet<string>;
  editsBlocked: boolean;
  // The live active-tab elements, read at the moment of a choice.
  liveElements: () => Element[];
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  memory: StyleMemoryApi;
  swatchOverrides: SwatchOverridesApi;
  // The whiteboard pen in hand (null when none is), and how its settings change.
  pen?: {
    held: WhiteboardPen | null;
    update: (id: WhiteboardPenId, patch: { colour?: string | null; width?: number }) => void;
  };
  // The draw intent in hand: on a whiteboard, a shape, line, arrow or text tool
  // with nothing selected makes the panel style what it draws next.
  toolIntent?: PendingDraw | null;
}): QuickStyleApi {
  const { activeTab, theme, selectionIds, editsBlocked, liveElements, commit, memory } = deps;
  const { overrides } = deps.swatchOverrides;

  const selected = useMemo(
    () => activeTab.elements.filter((el) => selectionIds.has(el.id)),
    [activeTab.elements, selectionIds],
  );
  // On a whiteboard (docs/specs/023-whiteboard/whiteboard.md "The quick style panel stays") the
  // defaults read as the board's ink, and the style memory is the board's own
  // (useStyleMemory's board scope), never a diagram tab's.
  const whiteboard = isWhiteboardTab(activeTab);
  const { appearance } = useAppearance();
  const ink = WHITEBOARD_INK[appearance];
  const held = deps.pen?.held ?? null;
  // A tool's choices land in memory, not the document: a version to re-read it.
  const [toolVersion, bumpTool] = useReducer((n: number) => n + 1, 0);
  const intent = deps.toolIntent ?? null;
  const phantom = useMemo(() => {
    if (!whiteboard || editsBlocked || selected.length > 0 || !intent) return null;
    const plain = toolPhantom(intent, theme);
    return plain ? memory.styleNewElement(plain) : null;
    // toolVersion: memory changed under the same intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whiteboard, editsBlocked, selected.length, intent, theme, toolVersion]);
  const view = useMemo(() => {
    if (editsBlocked) return null;
    if (phantom && intent) {
      const tool = onWhiteboard(quickStyleView([phantom], theme, overrides), [phantom], ink);
      return tool && { ...tool, caption: toolCaption(intent) };
    }
    const plain = quickStyleView(selected, theme, overrides);
    if (!whiteboard) return plain;
    const board = onWhiteboard(plain, selected, ink);
    // Selected strokes first; with nothing selected, the pen in hand.
    const pen =
      strokesPenStyle(selected, ink) ??
      (selected.length === 0 && held ? heldPenStyle(held, ink) : undefined);
    return pen ? { ...(board ?? { targetIds: [], sections: {} }), pen } : board;
  }, [editsBlocked, selected, theme, overrides, whiteboard, ink, held, phantom, intent]);

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

  return {
    view,
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
      if (phantom) {
        const kind = styleKindOf(phantom, true);
        if (kind) memory.forget([kind]);
        bumpTool();
        track('Element', 'Changed', 'QuickClearStyles');
        return;
      }
      run((el) => clearQuickStyle(el, theme), 'QuickClearStyles');
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
