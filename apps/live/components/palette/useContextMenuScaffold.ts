import { useState } from 'react';

import type { EditorContextMenuProps } from './EditorContextMenu.types';

type ColorSetterProps = Pick<
  EditorContextMenuProps,
  | 'onSetTextColor'
  | 'onPreviewTextColor'
  | 'onCommitTextColor'
  | 'onPreviewStyleEnd'
  | 'onSetFillColor'
  | 'onPreviewFillColor'
  | 'onCommitFillColor'
  | 'onSetStrokeColor'
  | 'onPreviewStrokeColor'
  | 'onCommitStrokeColor'
>;

// Shared accordion + colour-row scaffolding for the editor context menu's
// element and multi-selection branches: an at-most-one-open accordion
// (sectionProps), an at-most-one-open colour palette (colorProps), and the
// three hover-preview handler bundles spread into each ColourRow. Lives in a
// hook so the two menu branches share one implementation instead of each
// re-spelling it.
export function useContextMenuScaffold(p: ColorSetterProps) {
  // Which collapsible section is open — at most one at a time (null = all
  // collapsed). Rows sit flush; the MenuGroupSeparator bands are the only rules.
  const [openSection, setOpenSection] = useState<string | null>(null);
  const sectionProps = (id: string) => ({
    open: openSection === id,
    onToggle: () => setOpenSection((s) => (s === id ? null : id)),
    flush: true,
  });
  // Which colour row's inline palette is open — at most one, toggled by
  // re-clicking the row so it never sticks open.
  const [openColor, setOpenColor] = useState<string | null>(null);
  const colorProps = (id: string) => ({
    open: openColor === id,
    onToggle: () => setOpenColor((c) => (c === id ? null : id)),
  });
  // Hover-preview bundles spread into each ColourRow so the swatches
  // preview/commit like the style presets while the custom <input> keeps the
  // debounced onChange. onPreviewEnd is the shared revert (clearStylePreview).
  const textColorHandlers = {
    onChange: p.onSetTextColor,
    onPreview: p.onPreviewTextColor,
    onCommit: p.onCommitTextColor,
    onPreviewEnd: p.onPreviewStyleEnd,
  };
  const fillColorHandlers = {
    onChange: p.onSetFillColor,
    onPreview: p.onPreviewFillColor,
    onCommit: p.onCommitFillColor,
    onPreviewEnd: p.onPreviewStyleEnd,
  };
  const strokeColorHandlers = {
    onChange: p.onSetStrokeColor,
    onPreview: p.onPreviewStrokeColor,
    onCommit: p.onCommitStrokeColor,
    onPreviewEnd: p.onPreviewStyleEnd,
  };
  return { sectionProps, colorProps, textColorHandlers, fillColorHandlers, strokeColorHandlers };
}
