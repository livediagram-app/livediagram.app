// The rich-text editor's session state (spec/09), lifted out of
// RichTextEditor on the usual host + orchestration-hook split: the runs
// / selection / composition refs, the imperative paint + DOM read-back,
// the mount / repaint / selection / toolbar-flip effects, and the
// commit-on-blur-or-unmount lifecycle. RichTextEditor keeps the JSX and
// its event handlers and mounts what this returns.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  normalizeRuns,
  runsFromPlainText,
  runsPlainText,
  type TextRun,
} from '@livediagram/diagram';
import { effectiveRunStyle, FIXED_FONT_PX, MULTI_FONT_PX, MULTI_RUN_PX } from './label-style';
import {
  dataAttrsForRun,
  domSelectionToOffsets,
  offsetsToDomRange,
  readRunsFromDom,
  reconcileTrailingNewline,
  selectRange,
} from '@/components/canvas/rich-text-dom';
import type { ActiveFormat } from '@/components/canvas/RichTextToolbar';
import type { RichTextEditorProps } from './RichTextEditor.types';
import { applyCss, computeActiveFormat } from './rich-text-editor-helpers';
import { useRichTextFormatActions } from './useRichTextFormatActions';

export function useRichTextSession({
  element,
  initialLabel,
  initialRuns,
  textSize,
  multiline,
  cursorAtEnd,
  onCommit,
  onCancel,
}: Pick<
  RichTextEditorProps,
  | 'element'
  | 'initialLabel'
  | 'initialRuns'
  | 'textSize'
  | 'multiline'
  | 'cursorAtEnd'
  | 'onCommit'
  | 'onCancel'
>) {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarWrapRef = useRef<HTMLDivElement>(null);
  const runsRef = useRef<TextRun[]>(
    normalizeRuns(
      initialRuns && initialRuns.length ? initialRuns : runsFromPlainText(initialLabel),
    ),
  );
  const initialKey = useRef(JSON.stringify(runsRef.current));
  const settledRef = useRef(false);
  const composingRef = useRef(false);
  // True from a pointerdown anywhere in the toolbar until the matching
  // pointerup. The colour <input> must take focus to open its OS picker,
  // which blurs the editor with an unreliable relatedTarget; this flag is
  // the robust "don't commit, we're using the toolbar" signal for onBlur.
  const pointerInToolbarRef = useRef(false);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const skipFirstVersionEffect = useRef(true);
  const [version, setVersion] = useState(0);
  const [active, setActive] = useState<ActiveFormat>(() =>
    computeActiveFormat(runsRef.current, null, element),
  );
  const [placeBelow, setPlaceBelow] = useState(false);
  // Type-to-edit sessions must start with the caret at the END; see the
  // mount effect. Consumed by the first beforeinput.
  const needsEndCaretRef = useRef(false);

  const runSizePx = multiline ? MULTI_RUN_PX : FIXED_FONT_PX;
  const basePx = multiline
    ? MULTI_FONT_PX[textSize]
    : textSize === 'scale'
      ? 16
      : FIXED_FONT_PX[textSize];

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
      applyCss(span.style, effectiveRunStyle(run, element, runSizePx));
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
    setActive(computeActiveFormat(runsRef.current, offsets ?? selectionRef.current, element));
  };

  // Read the live DOM back into runs + refresh the toolbar. Used after every
  // edit (input, Enter, paste, IME end) since our programmatic inserts don't
  // fire React's onInput.
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

  // Mount: paint, focus, place the caret (select-all on double-click,
  // caret-at-end on type-to-edit), seed the toolbar state.
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    paintRuns();
    el.focus();
    const len = runsPlainText(runsRef.current).length;
    if (cursorAtEnd) {
      // Type-to-edit: collapse to the true END of the painted content so the
      // seed char stays first and further typing appends. Done against the live
      // DOM (not the computed offset) so a stray empty / desynced run can't drop
      // the caret back to the start — the "Hello" -> "elloH" bug.
      placeCaretAtEnd(el);
      // The first commit around a freshly-opened caption can REMOUNT /
      // MOVE this editor node (observed on icon captions: the wrapper
      // swaps its label subtree as editing begins), and a DOM move
      // silently drops the selection back to the start — the seeded first
      // char then ends up typed AFTER the rest ("LOL" -> "OLL"). The
      // mount-time placement above can't survive that, so `beforeinput`
      // in the host re-asserts the end caret right before the FIRST
      // keystroke applies — the last safe moment, immune to any churn in
      // between. A deliberate click inside the text first cancels it
      // (the host's pointerdown handler).
      needsEndCaretRef.current = true;
    } else {
      // Double-click / Space edit: select all, so the next keystroke replaces.
      selectRange(offsetsToDomRange(el, 0, len));
    }
    selectionRef.current = { start: cursorAtEnd ? len : 0, end: len };
    refreshActive();
    // Mount-only: cursorAtEnd is fixed for an edit session (editor remounts
    // per session). The other reads are refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A format apply bumps `version`: re-paint from the new runs and restore
  // the selection (+ focus, in case the colour input had stolen it).
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
    // Clear the toolbar-interaction flag once the pointer is released, so a
    // later click on the canvas blurs + commits normally.
    const onUp = () => {
      pointerInToolbarRef.current = false;
    };
    document.addEventListener('pointerup', onUp);
    // Focus preservation for the context menu riding alongside the edit
    // session (spec/09): preventDefault on mousedown inside the element
    // context menu (or one of its side flyouts) so clicking a menu control
    // never blurs the editor or drops the live text selection — the same
    // trick as the toolbar's noFocusSteal, applied at the document capture
    // phase because the menu is portalled outside the editor's tree. Form
    // controls are exempt (the colour input needs focus for its OS picker,
    // the opacity slider needs the native drag); the editor's onBlur
    // ignores focus landing inside the menu for exactly those.
    const onMenuDown = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('input,textarea,select')) return;
      if (t.closest('[data-context-menu],[data-menu-flyout]')) e.preventDefault();
    };
    document.addEventListener('mousedown', onMenuDown, true);
    return () => {
      document.removeEventListener('selectionchange', onSel);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('mousedown', onMenuDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flip the toolbar below the element when there isn't room above it. Measure
  // the EDITOR (a fixed reference), not the toolbar — the toolbar moves when
  // it flips, which would otherwise ping-pong. ~52px clears the toolbar +
  // its gap.
  useLayoutEffect(() => {
    const measure = () => {
      const el = editorRef.current;
      if (!el) return;
      setPlaceBelow(el.getBoundingClientRect().top < 52);
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  });

  const commitNow = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    const el = editorRef.current;
    const runs = el ? readRunsFromDom(el) : runsRef.current;
    onCommit(runsPlainText(runs), runs);
  };

  // Unmount safety net (canvas click that skips blur) + StrictMode guard:
  // commit the final value, but skip when nothing changed so the dev
  // mount-unmount-mount cycle doesn't spuriously close the editor.
  useEffect(() => {
    // Intentionally reads the refs at UNMOUNT time (the latest DOM / runs),
    // which is the whole point of the safety net; the exhaustive-deps
    // ref-in-cleanup heuristic is a false positive here.
    /* eslint-disable react-hooks/exhaustive-deps */
    return () => {
      if (settledRef.current) return;
      const el = editorRef.current;
      const runs = el ? readRunsFromDom(el) : runsRef.current;
      if (JSON.stringify(runs) === initialKey.current) return;
      onCommit(runsPlainText(runs), runs);
    };
    /* eslint-enable react-hooks/exhaustive-deps */
    // Mount/unmount-only safety net; onCommit is stable for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = () => {
    settledRef.current = true;
    onCancel();
  };

  // Formatting command dispatch (toggles / patches / lists) lives in
  // useRichTextFormatActions; a bump repaints via the version effect.
  const { onToggle, onPatch, applyList } = useRichTextFormatActions({
    editorRef,
    runsRef,
    selectionRef,
    pendingSelectionRef,
    bumpVersion: () => setVersion((v) => v + 1),
    element,
  });

  return {
    editorRef,
    toolbarWrapRef,
    composingRef,
    pointerInToolbarRef,
    needsEndCaretRef,
    active,
    placeBelow,
    basePx,
    placeCaretAtEnd,
    syncFromDom,
    commitNow,
    handleCancel,
    onToggle,
    onPatch,
    applyList,
  };
}
