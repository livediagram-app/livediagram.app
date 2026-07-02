// The in-place rich-text editor (spec/09). Replaces the plain <textarea>
// label editors for shape / text / sticky: a single contentEditable that
// renders the label's runs as styled <span>s and shows a floating toolbar
// for per-range bold / italic / underline / strikethrough / size / colour.
//
// Design notes:
// - The contentEditable DOM is managed IMPERATIVELY (paintRuns), not via
//   React children, so React never reconciles - and never clobbers - the
//   text the browser is editing. React only re-paints on entry and on a
//   format apply (the `version` bump), restoring the selection afterwards.
// - Newlines are literal '\n' text (never <br>), so the plain-text length
//   matches the runs' length and the offset mapping in rich-text-dom.ts
//   stays a simple string walk.
// - Typed text is committed on BLUR (like the old textarea), so a typing
//   burst causes no realtime-sync thrash. Format applies mutate the DOM +
//   runs in place and only persist on the same blur commit.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  applyFormatToRange,
  applyListStyle,
  defaultPadding,
  normalizeRuns,
  runsFromPlainText,
  runsPlainText,
  toggleFormatInRange,
  type ListStyle,
  type RunBoolKey,
  type RunPatch,
  type RunSize,
  type TextRun,
} from '@livediagram/diagram';
import {
  ALIGN_ITEMS,
  effectiveRunStyle,
  FIXED_FONT_PX,
  MULTI_FONT_PX,
  MULTI_RUN_PX,
  TEXT_ALIGN,
} from '@/components/canvas/label-style';
import {
  dataAttrsForRun,
  domSelectionToOffsets,
  insertTextAtCaret,
  offsetsToDomRange,
  readRunsFromDom,
  reconcileTrailingNewline,
  selectRange,
} from '@/components/canvas/rich-text-dom';
import { RichTextToolbar, type ActiveFormat } from '@/components/canvas/RichTextToolbar';
import { track } from '@/lib/telemetry';
import type { RichTextEditorProps } from './RichTextEditor.types';
import { applyCss, BOOL_DEFAULT, computeActiveFormat } from './rich-text-editor-helpers';

// Apply a React.CSSProperties object onto a live DOM style declaration,
// skipping undefined so we don't write the string "undefined".
export function RichTextEditor({
  element,
  initialLabel,
  initialRuns,
  placeholder,
  textSize,
  alignX,
  alignY,
  padding,
  fontFamily,
  multiline,
  cursorAtEnd,
  zoom,
  textClassName = '',
  onCommit,
  onCancel,
  onSetAlign,
  onSetPadding,
  onSetFont,
  onSetTextSize,
  currentFont = null,
  inline = false,
}: RichTextEditorProps) {
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
      // below re-asserts the end caret right before the FIRST keystroke
      // applies — the last safe moment, immune to any churn in between. A
      // deliberate click inside the text first cancels it (pointerdown
      // handler below).
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
    return () => {
      document.removeEventListener('selectionchange', onSel);
      document.removeEventListener('pointerup', onUp);
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
    setVersion((v) => v + 1);
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
      setVersion((v) => v + 1);
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
    setVersion((v) => v + 1);
    track('Element', 'Changed', 'TextFormat');
  };

  return (
    <div
      className={`pointer-events-none flex overflow-visible ${
        // Inline: a content-sized flex child (NOT flex-1), so the icon + editor
        // centre together as a group per the element's alignment, mirroring the
        // static display layout. flex-1 would fill the space after the icon and
        // pin the icon to the far edge. min-w-0 lets long text wrap.
        inline ? 'relative min-w-0' : 'absolute inset-0'
      }`}
      style={{ alignItems: ALIGN_ITEMS[alignY], padding: inline ? 0 : padding }}
    >
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={multiline}
        aria-label="Edit text"
        data-rt-placeholder={placeholder}
        spellCheck={false}
        onInput={() => {
          if (composingRef.current) return;
          syncFromDom();
        }}
        onBlur={(e) => {
          // Stay editing if the blur is part of a toolbar interaction: a
          // pointer is down in the toolbar (e.g. the colour input grabbing
          // focus for its OS dialog), or focus landed inside the toolbar.
          if (pointerInToolbarRef.current) return;
          if (
            toolbarWrapRef.current &&
            e.relatedTarget &&
            toolbarWrapRef.current.contains(e.relatedTarget as Node)
          ) {
            return;
          }
          commitNow();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
            return;
          }
          // Cmd/Ctrl+B/I/U must drive the SAME run-based toggle as the toolbar
          // buttons. Left to the browser, contentEditable runs its native
          // execCommand('bold'…), which wraps the DOM in <b>/<i>/<u> tags the
          // run model never sees — so the formatting vanished on commit. We
          // intercept and preventDefault so the native command never fires.
          if ((e.metaKey || e.ctrlKey) && !e.altKey) {
            const shortcut: Record<string, RunBoolKey> = {
              b: 'bold',
              i: 'italic',
              u: 'underline',
            };
            const key = shortcut[e.key.toLowerCase()];
            if (key) {
              e.preventDefault();
              onToggle(key);
              return;
            }
          }
          if (e.key === 'Enter') {
            // Insert a newline as a real '\n' text node (never <br>/<div>)
            // so it survives read-back and keeps plain-text length == DOM
            // textContent length.
            e.preventDefault();
            insertTextAtCaret('\n');
            syncFromDom();
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          if (text) {
            insertTextAtCaret(text);
            syncFromDom();
          }
        }}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          syncFromDom();
        }}
        onBeforeInput={() => {
          // Type-to-edit's end caret, re-asserted at the last safe moment
          // (see the mount effect): the first keystroke lands at the end
          // no matter what remounted / moved this node since mount.
          if (needsEndCaretRef.current) {
            needsEndCaretRef.current = false;
            const el = editorRef.current;
            if (el) placeCaretAtEnd(el);
          }
        }}
        onPointerDown={(e) => {
          // A deliberate click inside the text places its own caret — the
          // pending type-to-edit end caret must not override it.
          needsEndCaretRef.current = false;
          e.stopPropagation();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        style={{
          fontSize: `${basePx}px`,
          textAlign: TEXT_ALIGN[alignX],
          fontFamily,
        }}
        className={`pointer-events-auto w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent leading-tight outline-none ${
          multiline ? '' : 'font-medium'
        } ${textClassName}`}
      />
      {/* Counter-scale by 1/zoom so the toolbar stays constant on-screen
          size despite the canvas world transform; flip below near the top. */}
      <div
        ref={toolbarWrapRef}
        // Stop pointer events reaching the canvas — otherwise a click on a
        // toolbar button reads as a click-off the editing element and the
        // canvas commits + exits edit mode (the same guard the editable div
        // carries). Also flag the interaction so the editor's onBlur doesn't
        // commit when the colour input grabs focus. Button mousedown
        // additionally preventDefaults to keep the text selection.
        onPointerDown={(e) => {
          pointerInToolbarRef.current = true;
          e.stopPropagation();
        }}
        className={`pointer-events-auto absolute left-1/2 z-[var(--z-modal)] ${
          placeBelow ? 'top-full mt-2.5' : 'bottom-full mb-2.5'
        }`}
        style={{
          transform: `translateX(-50%) scale(${1 / zoom})`,
          transformOrigin: placeBelow ? 'top center' : 'bottom center',
        }}
      >
        {/* Title line on the far side from the element (above the bar when the
            bar sits above the element, below it when below), matching every
            other floating toolbar's caption. */}
        <span
          className={`pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-700 dark:text-white dark:ring-0 ${
            placeBelow ? 'top-full mt-1' : 'bottom-full mb-1'
          }`}
        >
          Selected Text
        </span>
        <RichTextToolbar
          active={active}
          alignX={alignX}
          alignY={alignY}
          padding={element.padding ?? defaultPadding(element)}
          currentFont={currentFont}
          onToggle={onToggle}
          onApplyList={applyList}
          onSize={chooseSize}
          onColor={(color) => onPatch({ color })}
          onSetAlign={(x, y) => onSetAlign?.(x, y)}
          onSetPadding={(p) => onSetPadding?.(p)}
          onSetFont={(f) => onSetFont?.(f)}
        />
      </div>
    </div>
  );
}
