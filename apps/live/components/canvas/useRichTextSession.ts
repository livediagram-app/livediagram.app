// The LABEL rich-text editor's session state (spec/09): everything that is
// specific to editing an element's label on the canvas — the element-derived
// run styling, the mount caret policy, the toolbar flip, the focus guards for
// the context menu riding alongside, and the commit-on-blur-or-unmount
// lifecycle. RichTextEditor keeps the JSX and its event handlers and mounts
// what this returns.
//
// The generic runs ⇄ contentEditable machine (paint, read-back, selection
// restore, active format, format commands) lives in useRichTextDocument,
// shared with the note editor (spec/92).

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { runsFromPlainText, runsPlainText, type TextRun } from '@livediagram/diagram';
import {
  effectiveRunStyle,
  elementRunDefaults,
  FIXED_FONT_PX,
  MULTI_FONT_PX,
  MULTI_RUN_PX,
} from './label-style';
import { offsetsToDomRange, selectRange } from '@/components/rich-text/rich-text-dom';
import { useRichTextDocument } from '@/components/rich-text/useRichTextDocument';
import { track } from '@/lib/telemetry';
import type { RichTextEditorProps } from './RichTextEditor.types';

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
  const toolbarWrapRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef(false);
  // True from a pointerdown anywhere in the toolbar until the matching
  // pointerup. The colour <input> must take focus to open its OS picker,
  // which blurs the editor with an unreliable relatedTarget; this flag is
  // the robust "don't commit, we're using the toolbar" signal for onBlur.
  const pointerInToolbarRef = useRef(false);
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

  const doc = useRichTextDocument({
    initialRuns: initialRuns && initialRuns.length ? initialRuns : runsFromPlainText(initialLabel),
    runStyle: (run: TextRun) => effectiveRunStyle(run, element, runSizePx),
    defaults: elementRunDefaults(element),
    // A label is one short string: a command with no selection applies to all
    // of it, as it always has.
    collapsedScope: 'all',
    trackFormat: () => track('Element', 'Changed', 'TextFormat'),
  });
  const {
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
    onToggle,
    onPatch,
    applyList,
    applyHeading,
  } = doc;

  const initialKey = useRef(JSON.stringify(runsRef.current));

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

  useEffect(() => {
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
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('mousedown', onMenuDown, true);
    };
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
    const runs = currentRuns();
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
      const runs = currentRuns();
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
    applyHeading,
    currentRuns,
  };
}
