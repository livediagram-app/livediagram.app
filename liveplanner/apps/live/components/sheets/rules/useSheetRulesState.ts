'use client';

// A Sheet's rule state (docs/specs/029-sheets/data-validation.md, conditional-formatting.md, sheet.md "Paint Format"):
// the dropdown open on a cell, the rule panel open (the Data Validation editor, the Conditional Formatting popover,
// the Custom Number Format popover) and what it is anchored to, a format rule's preview while it is edited, and the
// formats Paint Format holds. The person's own view: nothing here is saved or sent.
import { useMemo, useState } from 'react';
import type { FormatRule, SheetClip } from '@liveplanner/sheets';

// What a panel is anchored to: the control that opened it, or the active cell (a menu row that closed).
export type RuleAnchor = HTMLElement | 'cell';

export type RulePanel =
  // `ruleId` edits that rule; `start` makes a new one of that kind over the selection.
  | { kind: 'validation'; anchor: RuleAnchor; ruleId?: string; start?: 'list' }
  | { kind: 'format'; anchor: RuleAnchor; ruleId?: string; all?: boolean }
  | { kind: 'customFormat'; anchor: RuleAnchor }
  | null;

export type PaintFormat = { clip: SheetClip; keep: boolean } | null;

export type SheetRulesState = {
  dropdown: { r: number; c: number } | null;
  setDropdown: (at: { r: number; c: number } | null) => void;
  panel: RulePanel;
  setPanel: (p: RulePanel) => void;
  // The format rule being edited, drawn for its editor alone (its id replaces the stored rule of that id).
  formatPreview: FormatRule | null;
  setFormatPreview: (r: FormatRule | null) => void;
  paint: PaintFormat;
  setPaint: (p: PaintFormat) => void;
};

export function useSheetRulesState(): SheetRulesState {
  const [dropdown, setDropdown] = useState<{ r: number; c: number } | null>(null);
  const [panel, setPanel] = useState<RulePanel>(null);
  const [formatPreview, setFormatPreview] = useState<FormatRule | null>(null);
  const [paint, setPaint] = useState<PaintFormat>(null);
  return useMemo(
    () => ({
      dropdown,
      setDropdown,
      panel,
      setPanel,
      formatPreview,
      setFormatPreview,
      paint,
      setPaint,
    }),
    [dropdown, panel, formatPreview, paint],
  );
}

// The format rules as drawn: the sheet's, with the one being edited in its place (or last, when new).
export function previewFormatRules(
  stored: readonly FormatRule[] | undefined,
  preview: FormatRule | null,
): readonly FormatRule[] | undefined {
  if (!preview) return stored;
  const list = stored ?? [];
  return list.some((x) => x.id === preview.id)
    ? list.map((x) => (x.id === preview.id ? preview : x))
    : [...list, preview];
}
