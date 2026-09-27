'use client';

// The quick style panel's actions (docs/specs/008-canvas/quick-style-panel.md): each choice is one commit
// over the selection (one undo step), recorded into style memory, and counted
// under its own telemetry token so panel use reads apart from menu use.

import { useMemo } from 'react';
import type { Element, Tab, TextAlignX, ThemeDefinition } from '@livediagram/diagram';
import { track } from '@/lib/telemetry';
import {
  applyQuickFill,
  applyQuickIconAlign,
  applyQuickStroke,
  applyQuickStrokeStyle,
  applyQuickTextAlign,
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

export type QuickStyleApi = {
  view: QuickStyleView | null;
  setStroke: (slot: QuickSwatchValue) => void;
  setBackground: (slot: QuickSwatchValue) => void;
  setWidth: (width: QuickWidth) => void;
  setStrokeStyle: (style: QuickStrokeStyle) => void;
  setTextAlign: (align: TextAlignX) => void;
  setIconAlign: (align: QuickIconAlign) => void;
  clearStyles: () => void;
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
}): QuickStyleApi {
  const { activeTab, theme, selectionIds, editsBlocked, liveElements, commit, memory } = deps;

  const selected = useMemo(
    () => activeTab.elements.filter((el) => selectionIds.has(el.id)),
    [activeTab.elements, selectionIds],
  );
  const view = useMemo(
    () => (editsBlocked ? null : quickStyleView(selected, theme)),
    [editsBlocked, selected, theme],
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
    setStroke: (slot) => run((el) => applyQuickStroke(el, theme, slot), 'QuickStroke'),
    setBackground: (slot) => run((el) => applyQuickFill(el, theme, slot), 'QuickBackground'),
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
  };
}
