// The runs ⇄ contentEditable machine shared by every rich-text surface in
// the editor: the element-label editor (docs/specs/008-canvas/canvas-and-palette.md) and the element-note editor
// (docs/specs/009-elements/rich-text-notes.md). It owns the parts that are identical whatever is being edited —
// the runs / selection / composition refs, the imperative paint, the DOM
// read-back, the repaint-and-restore-selection cycle a format apply triggers,
// and the toolbar's active-format state.
//
// It owns NO placement, commit, or focus policy: when to commit, where a
// floating toolbar sits, what a blur means, and how the caret starts out are
// host concerns and stay in the host hook (useRichTextSession for labels,
// each editor's useNoteRichTextSession for notes).
//
// The invariant everything rests on is the one rich-text-dom.ts documents:
// runs paint as <span>s with literal '\n' text, so plain-text length ===
// DOM textContent length and offsets are a string walk. A label's text whose
// lines read in different directions paints a line at a time
// (`isolateLines`, rich-text-lines.ts).

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { normalizeRuns, type TextRun, runsPlainText } from '@liveworkspace/model-core/rich-text';
import { labelEditorBidi } from '../../lib/label-bidi';
import {
  dataAttrsForRun,
  domSelectionToOffsets,
  offsetsToDomRange,
  readRunsFromDom,
  reassertSelection,
  reconcileTrailingNewline,
  selectRange,
} from './rich-text-dom';
import {
  applyCss,
  computeActiveFormat,
  sameActiveFormat,
  type ActiveFormat,
  type RunDefaults,
} from './rich-text-format';
import { linesStillApart, paintRunLines } from './rich-text-lines';
import { useRichTextFormatActions } from './useRichTextFormatActions';

export function useRichTextRuns({
  initialRuns,
  runStyle,
  defaults,
  collapsedScope,
  trackFormat,
  isolateLines = false,
}: {
  initialRuns: TextRun[];
  // Resolve one run to the inline CSS its span is painted with. The host
  // supplies it because a label inherits the element's typography and a note
  // has its own scale.
  runStyle: (run: TextRun) => React.CSSProperties;
  defaults: RunDefaults;
  collapsedScope: 'all' | 'word';
  trackFormat: (command: string) => void;
  // Paint a text whose lines could read in different directions a line at a time, each line isolated in its own
  // direction, instead of leaving it to `unicode-bidi: plaintext` (a label's editor; label-bidi.ts says when).
  isolateLines?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  // The runs the editor opens with, normalised once.
  const [openingRuns] = useState(() => normalizeRuns(initialRuns));
  const runsRef = useRef<TextRun[]>(openingRuns);
  const composingRef = useRef(false);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const skipFirstVersionEffect = useRef(true);
  const [version, setVersion] = useState(0);
  const [active, setActive] = useState<ActiveFormat>(() =>
    computeActiveFormat(openingRuns, null, defaults),
  );
  // The plain text as it stands, as state: every change to the runs ends in refreshActive, which updates
  // it, so render reads this rather than the contentEditable (react-state-and-effects.md).
  const [liveText, setLiveText] = useState(() => runsPlainText(openingRuns));
  // Whether the editor is painted a line at a time right now.
  const linesPaintedRef = useRef(false);

  // Collapse the selection to the true end of the editor's painted content.
  const placeCaretAtEnd = (el: HTMLElement) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    selectRange(r);
  };

  // One run as the styled span it paints as.
  const spanFor = (run: TextRun): HTMLSpanElement => {
    const span = document.createElement('span');
    applyCss(span.style, runStyle(run));
    for (const [k, v] of Object.entries(dataAttrsForRun(run))) span.setAttribute(k, v);
    span.textContent = run.text;
    return span;
  };

  // Whether these runs paint a line at a time.
  const paintsByLine = (text: string): boolean =>
    isolateLines && labelEditorBidi(text) === 'plaintext';

  // Render the current runs into the contentEditable as styled spans.
  const paintRuns = () => {
    const el = editorRef.current;
    if (!el) return;
    const runs = runsRef.current;
    linesPaintedRef.current = paintsByLine(runsPlainText(runs));
    if (linesPaintedRef.current) paintRunLines(el, runs, spanFor);
    else {
      el.replaceChildren();
      for (const run of runs) el.appendChild(spanFor(run));
    }
    // Render the empty last line when the text ends in a newline.
    reconcileTrailingNewline(el);
  };

  // A text painted a line at a time whose lines ran together (a new line, a joined one, a paste, a character typed
  // beside a newline), or whose answer changed (a first right-to-left letter, the last newline gone), paints again
  // with the selection where it was. Typing within a line keeps its lines apart and paints nothing.
  const keepLinesApart = (el: HTMLElement, text: string) => {
    const byLine = paintsByLine(text);
    if (byLine === linesPaintedRef.current && (!byLine || linesStillApart(el, text))) return;
    const at = domSelectionToOffsets(el);
    paintRuns();
    if (at) selectRange(offsetsToDomRange(el, at.start, at.end));
  };

  const refreshActive = () => {
    const el = editorRef.current;
    if (!el) return;
    const offsets = domSelectionToOffsets(el);
    if (offsets) selectionRef.current = offsets;
    // The previous object while nothing changed, so the second refresh a keystroke brings (input, then the
    // caret's selectionchange) renders nothing: it rendered the editor and its toolbar twice per keystroke.
    const next = computeActiveFormat(runsRef.current, offsets ?? selectionRef.current, defaults);
    setActive((prev) => (sameActiveFormat(prev, next) ? prev : next));
    setLiveText(runsPlainText(runsRef.current));
  };

  // Read the live DOM back into runs + refresh the toolbar. Used after every
  // edit (input, Enter, paste, IME end) since programmatic inserts don't fire
  // React's onInput.
  const syncFromDom = () => {
    const el = editorRef.current;
    if (el) {
      runsRef.current = readRunsFromDom(el);
      if (isolateLines) keepLinesApart(el, runsPlainText(runsRef.current));
      // Keep the trailing-newline sentinel in step: typing past a trailing
      // newline drops it, an Enter at the end adds it. When it adds it, the
      // caret is re-set: WebKit settled a caret after a newline at the very
      // end back before it (there was no empty line yet), so the next
      // keystroke landed on the line above.
      if (reconcileTrailingNewline(el)) reassertSelection();
    }
    refreshActive();
  };

  // The runs as they stand right now, read from the live DOM when there is
  // one. What a host commits (outside render: render reads `liveText`).
  const currentRuns = (): TextRun[] => {
    const el = editorRef.current;
    return el ? readRunsFromDom(el) : runsRef.current;
  };

  // A format apply bumps `version`: re-paint from the new runs and restore
  // the selection (+ focus, in case a toolbar control had stolen it). The repaint is an effect event,
  // so it paints with the newest run style and defaults while only a version bump triggers it.
  const repaint = useEffectEvent(() => {
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
  });
  useLayoutEffect(() => {
    if (skipFirstVersionEffect.current) {
      skipFirstVersionEffect.current = false;
      return;
    }
    repaint();
  }, [version]);

  // Keep the toolbar active-state in sync as the caret / selection moves.
  const onSelectionChange = useEffectEvent(() => {
    if (document.activeElement !== editorRef.current) return;
    refreshActive();
  });
  useEffect(() => {
    const onSel = () => onSelectionChange();
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
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
    liveText,
    paintRuns,
    refreshActive,
    syncFromDom,
    currentRuns,
    placeCaretAtEnd,
    ...actions,
  };
}
