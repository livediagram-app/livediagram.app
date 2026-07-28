import type { RefObject } from 'react';
import {
  applyFormatToRange,
  applyHeadingToLines,
  applyListStyle,
  expandRangeToLines,
  runsPlainText,
  toggleFormatInRange,
  type ListStyle,
  type RunBoolKey,
  type RunHeading,
  type RunPatch,
  type TextRun,
} from '@livediagram/diagram';
import { domSelectionToOffsets } from '@/components/rich-text/rich-text-dom';
import { wordRangeAt, type RunDefaults } from '@/components/rich-text/rich-text-format';

// Formatting command dispatch for a runs-backed contentEditable — the bold /
// italic / … toggles, run patches, the bullet / numbered list apply, and
// (spec/92) headings + links. Everything React-shaped (the refs, the version
// bump that triggers repaint-and-restore) is owned by the host editor and
// passed in, so this hook is the same for element labels (spec/09) and
// element notes.
//
// `collapsedScope` decides what a command with NO selection acts on:
//   'all'  — the whole text. Right for a label, which is one short string.
//   'word' — the word under the caret for inline commands, the line under it
//            for block commands. Right for a note, which is a document.
export function useRichTextFormatActions({
  editorRef,
  runsRef,
  selectionRef,
  pendingSelectionRef,
  bumpVersion,
  defaults,
  collapsedScope,
  trackFormat,
}: {
  editorRef: RefObject<HTMLDivElement | null>;
  runsRef: { current: TextRun[] };
  selectionRef: { current: { start: number; end: number } | null };
  pendingSelectionRef: { current: { start: number; end: number } | null };
  // Bumps the editor's `version` state: re-paint from the new runs and
  // restore pendingSelectionRef.
  bumpVersion: () => void;
  defaults: RunDefaults;
  collapsedScope: 'all' | 'word';
  // Emitted once per applied command (spec/22); the host owns the category.
  trackFormat: (command: string) => void;
}) {
  // The live selection, falling back to the last one we saw.
  const liveSelection = (): { start: number; end: number } | null => {
    const el = editorRef.current;
    return (el ? domSelectionToOffsets(el) : null) ?? selectionRef.current;
  };

  // Resolve the range an INLINE command formats. A real selection is used as
  // is; a collapsed caret widens per `collapsedScope`. Returns null to no-op.
  const targetRange = (): { start: number; end: number } | null => {
    const sel = liveSelection();
    if (!sel) return null;
    if (sel.start !== sel.end) return sel;
    const text = runsPlainText(runsRef.current);
    if (collapsedScope === 'all') return { start: 0, end: text.length };
    return wordRangeAt(text, sel.start);
  };

  // Resolve the range a BLOCK command (heading / list) acts on: the selected
  // lines, or — for a collapsed caret — the whole text for a label and the
  // caret's own line for a note. `undefined` means "the whole text", which is
  // what applyListStyle / applyHeadingToLines take for an unscoped apply.
  const targetLineRange = (): { start: number; end: number } | undefined => {
    const sel = liveSelection();
    if (!sel) return undefined;
    if (sel.start === sel.end && collapsedScope === 'all') return undefined;
    return expandRangeToLines(runsPlainText(runsRef.current), sel);
  };

  const applyAndRepaint = (
    next: TextRun[],
    range: { start: number; end: number },
    command: string,
  ) => {
    runsRef.current = next;
    pendingSelectionRef.current = range;
    bumpVersion();
    trackFormat(command);
  };

  // A block command keeps the caret / selection where it was when it can, and
  // otherwise parks it at the end (the runs may have grown a list marker).
  const applyBlock = (next: TextRun[], range: { start: number; end: number } | undefined) => {
    runsRef.current = next;
    const len = runsPlainText(next).length;
    pendingSelectionRef.current = range ?? { start: len, end: len };
    bumpVersion();
  };

  const onToggle = (key: RunBoolKey) => {
    const range = targetRange();
    if (!range) return;
    const next = toggleFormatInRange(runsRef.current, range.start, range.end, key, defaults[key]);
    applyAndRepaint(next, range, key[0]!.toUpperCase() + key.slice(1));
  };

  const onPatch = (patch: RunPatch, command = 'Colour') => {
    const range = targetRange();
    if (!range) return;
    applyAndRepaint(
      applyFormatToRange(runsRef.current, range.start, range.end, patch),
      range,
      command,
    );
  };

  // Bullet / numbered list (prepends line markers, renumbering). Scoped to
  // the selected lines when there's a selection; see targetLineRange.
  const applyList = (style: ListStyle) => {
    const range = targetLineRange();
    applyBlock(applyListStyle(runsRef.current, style, range), range);
    trackFormat('List');
  };

  // Heading / subheading across the touched lines; `null` clears (spec/92).
  const applyHeading = (level: RunHeading | null) => {
    const range = targetLineRange();
    applyBlock(applyHeadingToLines(runsRef.current, level, range), range);
    trackFormat('Heading');
  };

  // Set / clear a link over the target range (spec/92). The URL must already
  // have been through `normaliseUrl`; `null` unlinks.
  const applyLink = (url: string | null) => {
    const range = targetRange();
    if (!range) return;
    applyAndRepaint(
      applyFormatToRange(runsRef.current, range.start, range.end, { link: url ?? undefined }),
      range,
      'Link',
    );
  };

  return { onToggle, onPatch, applyList, applyHeading, applyLink };
}
