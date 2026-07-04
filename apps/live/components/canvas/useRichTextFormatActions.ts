import type { RefObject } from 'react';
import {
  applyFormatToRange,
  applyListStyle,
  runsPlainText,
  toggleFormatInRange,
  type ListStyle,
  type RunBoolKey,
  type RunPatch,
  type RunSize,
  type TextRun,
  type TextSize,
  type BoxedElement,
} from '@livediagram/diagram';
import { domSelectionToOffsets } from '@/components/canvas/rich-text-dom';
import { track } from '@/lib/telemetry';
import { BOOL_DEFAULT } from './rich-text-editor-helpers';

// The RichTextEditor's formatting command dispatch (spec/09 rich
// labels), lifted out of the component: resolving the target range,
// the bold / italic / … toggles, run patches, the size dropdown
// (per-range sm/md/lg vs whole-element 'scale'), and the bullet /
// numbered list apply. Everything React-shaped (the refs, the version
// bump that triggers repaint-and-restore) is owned by the editor and
// passed in.
export function useRichTextFormatActions({
  editorRef,
  runsRef,
  selectionRef,
  pendingSelectionRef,
  bumpVersion,
  element,
  onSetTextSize,
}: {
  editorRef: RefObject<HTMLDivElement | null>;
  runsRef: { current: TextRun[] };
  selectionRef: { current: { start: number; end: number } | null };
  pendingSelectionRef: { current: { start: number; end: number } | null };
  // Bumps the editor's `version` state: re-paint from the new runs and
  // restore pendingSelectionRef.
  bumpVersion: () => void;
  element: BoxedElement;
  onSetTextSize?: (size: TextSize) => void;
}) {
  // Resolve the range to format: the live selection, or — when the caret is
  // collapsed (nothing selected) — the WHOLE text, so a format applied with
  // no selection affects everything. Returns null to no-op.
  const targetRange = (): { start: number; end: number } | null => {
    const el = editorRef.current;
    if (!el) return null;
    const sel = domSelectionToOffsets(el) ?? selectionRef.current;
    if (!sel) return null;
    if (sel.start !== sel.end) return sel;
    return { start: 0, end: runsPlainText(runsRef.current).length };
  };

  const applyAndRepaint = (next: TextRun[], range: { start: number; end: number }) => {
    runsRef.current = next;
    pendingSelectionRef.current = range;
    bumpVersion();
    track('Element', 'Changed', 'TextFormat');
  };

  const onToggle = (key: RunBoolKey) => {
    const range = targetRange();
    if (!range) return;
    const next = toggleFormatInRange(
      runsRef.current,
      range.start,
      range.end,
      key,
      BOOL_DEFAULT[key](element),
    );
    applyAndRepaint(next, range);
  };

  const onPatch = (patch: RunPatch) => {
    const range = targetRange();
    if (!range) return;
    applyAndRepaint(applyFormatToRange(runsRef.current, range.start, range.end, patch), range);
  };

  // Size dropdown: sm/md/lg are per-range; 'scale' is whole-element auto-fit
  // (no per-run meaning), so it clears every run's size override and sets the
  // element back to 'scale'.
  const chooseSize = (size: RunSize | 'scale') => {
    if (size === 'scale') {
      const len = runsPlainText(runsRef.current).length;
      runsRef.current = applyFormatToRange(runsRef.current, 0, len, { size: undefined });
      pendingSelectionRef.current = selectionRef.current ?? { start: 0, end: len };
      bumpVersion();
      onSetTextSize?.('scale');
      track('Element', 'Changed', 'TextFormat');
      return;
    }
    onPatch({ size });
  };

  // Bullet / numbered list (prepends line markers, renumbering). Scoped to
  // the selected lines when there's a selection; whole text on a bare caret.
  const applyList = (style: ListStyle) => {
    const el = editorRef.current;
    const sel = (el ? domSelectionToOffsets(el) : null) ?? selectionRef.current;
    const range = sel && sel.start !== sel.end ? sel : undefined;
    const next = applyListStyle(runsRef.current, style, range);
    runsRef.current = next;
    const len = runsPlainText(next).length;
    pendingSelectionRef.current = range ?? { start: len, end: len };
    bumpVersion();
    track('Element', 'Changed', 'TextFormat');
  };

  return { onToggle, onPatch, chooseSize, applyList };
}
