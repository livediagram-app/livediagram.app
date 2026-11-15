import { useState } from 'react';

// The colour callbacks of each editor's context menu props (components/palette/EditorContextMenu.types.ts)
// the colour rows spread: set, hover-preview and commit for each colour, plus the shared preview revert.
type ColourSetter = (color: string) => void;
type ColorSetterProps = {
  onSetTextColor: ColourSetter;
  onPreviewTextColor: ColourSetter;
  onCommitTextColor: ColourSetter;
  onPreviewStyleEnd: () => void;
  onSetFillColor: ColourSetter;
  onPreviewFillColor: ColourSetter;
  onCommitFillColor: ColourSetter;
  onSetArrowheadColor: ColourSetter;
  onPreviewArrowheadColor: ColourSetter;
  onCommitArrowheadColor: ColourSetter;
  onSetLabelFill: ColourSetter;
  onPreviewLabelFill: ColourSetter;
  onCommitLabelFill: ColourSetter;
  onSetHeaderFill: ColourSetter;
  onPreviewHeaderFill: ColourSetter;
  onCommitHeaderFill: ColourSetter;
  onSetStrokeColor: ColourSetter;
  onPreviewStrokeColor: ColourSetter;
  onCommitStrokeColor: ColourSetter;
};

/**
 * The open side flyouts of a menu as a path, outermost first (docs/specs/008-canvas/canvas-and-palette.md "A flyout
 * can hold a flyout"). `flyoutProps(id)` is spread onto a MenuFlyoutSection, whose onToggle says how many flyouts
 * it sits inside: opening one keeps the flyouts it sits in and replaces whatever was open at its level and below,
 * so Tools > Mind Map keeps Tools open while Style and Tools still replace each other; closing one closes every
 * flyout inside it. It used to keep ONE id, and opening the Mind Map inside Tools closed Tools, which unmounted
 * both: the click did nothing.
 */
export function useFlyoutPath() {
  const [path, setPath] = useState<readonly string[]>([]);
  return (id: string) => ({
    open: path.includes(id),
    onToggle: (depth = 0) =>
      setPath((p) => {
        const at = p.indexOf(id);
        // Open: close it and everything inside it. Closed: open it at its own level, below its parents.
        return at >= 0 ? p.slice(0, at) : [...p.slice(0, depth), id];
      }),
    flush: true,
  });
}

// Shared accordion + colour-row scaffolding for the editor context menu's
// element and multi-selection branches: an at-most-one-open accordion
// (sectionProps), an at-most-one-open colour palette (colorProps), and the
// four hover-preview handler bundles spread into each ColourRow. Lives in a
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
  // Which side-flyout rows (Style / Text / Tools) are open: one per level, SEPARATE from openSection so a
  // flyout and an inline accordion (or a sub-accordion inside the flyout, which shares openSection's pool) can
  // coexist. Lifted here rather than kept in MenuFlyoutSection's local state so the open flyout survives the
  // menu retargeting to another element (conditional sibling sections can remount the flyout row, which wiped
  // local state and collapsed the category mid-workflow).
  const flyoutProps = useFlyoutPath();
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
  const arrowheadColorHandlers = {
    onChange: p.onSetArrowheadColor,
    onPreview: p.onPreviewArrowheadColor,
    onCommit: p.onCommitArrowheadColor,
    onPreviewEnd: p.onPreviewStyleEnd,
  };
  const labelFillHandlers = {
    onChange: p.onSetLabelFill,
    onPreview: p.onPreviewLabelFill,
    onCommit: p.onCommitLabelFill,
    onPreviewEnd: p.onPreviewStyleEnd,
  };
  const headerFillHandlers = {
    onChange: p.onSetHeaderFill,
    onPreview: p.onPreviewHeaderFill,
    onCommit: p.onCommitHeaderFill,
    onPreviewEnd: p.onPreviewStyleEnd,
  };
  const strokeColorHandlers = {
    onChange: p.onSetStrokeColor,
    onPreview: p.onPreviewStrokeColor,
    onCommit: p.onCommitStrokeColor,
    onPreviewEnd: p.onPreviewStyleEnd,
  };
  return {
    sectionProps,
    flyoutProps,
    colorProps,
    textColorHandlers,
    fillColorHandlers,
    arrowheadColorHandlers,
    headerFillHandlers,
    labelFillHandlers,
    strokeColorHandlers,
  };
}
