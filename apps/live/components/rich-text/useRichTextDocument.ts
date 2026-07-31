// The runs ⇄ contentEditable machine shared by every rich-text surface in
// the editor: the element-label editor (spec/09) and the element-note editor
// (spec/92). It owns the parts that are identical whatever is being edited —
// the runs / selection / composition refs, the imperative paint, the DOM
// read-back, the repaint-and-restore-selection cycle a format apply triggers,
// and the toolbar's active-format state.
//
// It owns NO placement, commit, or focus policy: when to commit, where a
// floating toolbar sits, what a blur means, and how the caret starts out are
// host concerns and stay in the host hook (useRichTextSession for labels,
// useNoteRichTextSession for notes).
//
// The invariant everything rests on is the one rich-text-dom.ts documents:
// runs paint as a flat list of sibling <span>s with literal '\n' text, so
// plain-text length === DOM textContent length and offsets are a string walk.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { normalizeRuns, type TextRun } from '@livediagram/diagram';
import {
  dataAttrsForRun,
  domSelectionToOffsets,
  offsetsToDomRange,
  readRunsFromDom,
  reconcileTrailingNewline,
  selectRange,
} from '@/components/rich-text/rich-text-dom';
import {
  applyCss,
  computeActiveFormat,
  type ActiveFormat,
  type RunDefaults,
} from '@/components/rich-text/rich-text-format';
import { useRichTextFormatActions } from '@/components/rich-text/useRichTextFormatActions';

export function useRichTextDocument({
  initialRuns,
  runStyle,
  defaults,
  collapsedScope,
  trackFormat,
}: {
  initialRuns: TextRun[];
  // Resolve one run to the inline CSS its span is painted with. The host
  // supplies it because a label inherits the element's typography and a note
  // has its own scale.
  runStyle: (run: TextRun) => React.CSSProperties;
  defaults: RunDefaults;
  collapsedScope: 'all' | 'word';
  trackFormat: (command: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const runsRef = useRef<TextRun[]>(normalizeRuns(initialRuns));
  const composingRef = useRef(false);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const skipFirstVersionEffect = useRef(true);
  const [version, setVersion] = useState(0);
  const [active, setActive] = useState<ActiveFormat>(() =>
    computeActiveFormat(runsRef.current, null, defaults),
  );

  // Collapse the selection to the true end of the editor's painted content.
  const placeCaretAtEnd = (el: HTMLElement) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    selectRange(r);
  };

  // Render the current runs into the contentEditable as styled spans.
  const paintRuns = () => {
    const el = editorRef.current;
    if (!el) return;
    el.replaceChildren();
    for (const run of runsRef.current) {
      const span = document.createElement('span');
      applyCss(span.style, runStyle(run));
      for (const [k, v] of Object.entries(dataAttrsForRun(run))) span.setAttribute(k, v);
      span.textContent = run.text;
      el.appendChild(span);
    }
    // Render the empty last line when the text ends in a newline.
    reconcileTrailingNewline(el);
  };

  const refreshActive = () => {
    const el = editorRef.current;
    if (!el) return;
    const offsets = domSelectionToOffsets(el);
    if (offsets) selectionRef.current = offsets;
    setActive(computeActiveFormat(runsRef.current, offsets ?? selectionRef.current, defaults));
  };

  // Read the live DOM back into runs + refresh the toolbar. Used after every
  // edit (input, Enter, paste, IME end) since programmatic inserts don't fire
  // React's onInput.
  const syncFromDom = () => {
    const el = editorRef.current;
    if (el) {
      runsRef.current = readRunsFromDom(el);
      // Keep the trailing-newline sentinel in step: typing past a trailing
      // newline drops it, an Enter at the end adds it.
      reconcileTrailingNewline(el);
    }
    refreshActive();
  };

  // The runs as they stand right now, read from the live DOM when there is
  // one. What a host commits.
  const currentRuns = (): TextRun[] => {
    const el = editorRef.current;
    return el ? readRunsFromDom(el) : runsRef.current;
  };

  // A format apply bumps `version`: re-paint from the new runs and restore
  // the selection (+ focus, in case a toolbar control had stolen it).
  useLayoutEffect(() => {
    if (skipFirstVersionEffect.current) {
      skipFirstVersionEffect.current = false;
      return;
    }
    const el = editorRef.current;
    if (!el) return;
    paintRuns();
    el.focus();
    const sel = pendingSelectionRef.current;
    if (sel) {
      selectRange(offsetsToDomRange(el, sel.start, sel.end));
      pendingSelectionRef.current = null;
    }
    refreshActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // Keep the toolbar active-state in sync as the caret / selection moves.
  useEffect(() => {
    const onSel = () => {
      if (document.activeElement !== editorRef.current) return;
      refreshActive();
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actions = useRichTextFormatActions({
    editorRef,
    runsRef,
    selectionRef,
    pendingSelectionRef,
    bumpVersion: () => setVersion((v) => v + 1),
    defaults,
    collapsedScope,
    trackFormat,
  });

  return {
    editorRef,
    runsRef,
    selectionRef,
    composingRef,
    active,
    paintRuns,
    refreshActive,
    syncFromDom,
    currentRuns,
    placeCaretAtEnd,
    ...actions,
  };
}
