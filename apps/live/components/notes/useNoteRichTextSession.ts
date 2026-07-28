// Session state for the note rich-text editor (spec/92). Thin next to the
// label editor's useRichTextSession because a note has no canvas to fight:
// no zoom counter-scale, no toolbar flip, no context menu riding alongside,
// and no commit-on-blur (the popover owns the commit, on outside click or
// Cmd-Enter). All this adds over the shared useRichTextDocument is the mount
// paint + caret, and reporting every edit up so the popover always holds the
// current value.

import { useLayoutEffect } from 'react';
import {
  runsPlainText,
  type ListStyle,
  type RunBoolKey,
  type RunHeading,
  type TextRun,
} from '@livediagram/diagram';
import { PLAIN_RUN_DEFAULTS } from '@/components/rich-text/rich-text-format';
import { useRichTextDocument } from '@/components/rich-text/useRichTextDocument';
import { track } from '@/lib/telemetry';
import { noteRunStyle } from './note-run-style';

export function useNoteRichTextSession({
  initialRuns,
  onChange,
}: {
  initialRuns: TextRun[];
  // Fired after every edit and every format apply with the note's current
  // plain-text mirror + runs, so the popover can commit without reaching
  // into the editor's DOM.
  onChange: (plain: string, runs: TextRun[]) => void;
}) {
  const doc = useRichTextDocument({
    initialRuns,
    runStyle: noteRunStyle,
    // A note has no whole-element typography to inherit.
    defaults: PLAIN_RUN_DEFAULTS,
    // A note is a document, not a one-line label: a command with no selection
    // acts on the word (inline) or the line (block) under the caret, never on
    // the whole note.
    collapsedScope: 'word',
    trackFormat: (command) => track('Note', 'Used', command),
  });
  const { editorRef, runsRef, paintRuns, placeCaretAtEnd, refreshActive, syncFromDom } = doc;

  // Report the current value up. Every mutation path — typing, a format
  // apply — leaves `runsRef` authoritative before this runs (syncFromDom
  // reads the DOM back into it; a format action assigns it synchronously
  // and only the repaint is deferred), so there's no DOM read here.
  const report = () => onChange(runsPlainText(runsRef.current), runsRef.current);

  const handleInput = () => {
    syncFromDom();
    report();
  };

  // Format commands mutate the runs and schedule a repaint; the popover has
  // to hear about the new value in the same tick or an immediate commit
  // (outside click straight after clicking Bold) would persist the old one.
  const onToggle = (key: RunBoolKey) => {
    doc.onToggle(key);
    report();
  };
  const applyList = (style: ListStyle) => {
    doc.applyList(style);
    report();
  };
  const applyHeading = (level: RunHeading | null) => {
    doc.applyHeading(level);
    report();
  };
  const applyLink = (url: string | null) => {
    doc.applyLink(url);
    report();
  };

  // Mount: paint the initial runs, focus, and park the caret at the END so
  // reopening a note continues it rather than replacing it on the next
  // keystroke (a note is a document; the label editor's select-all would put
  // a paragraph one keypress away from being wiped).
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    paintRuns();
    el.focus();
    placeCaretAtEnd(el);
    refreshActive();
    // Mount-only; every read is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...doc, handleInput, onToggle, applyList, applyHeading, applyLink };
}
