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
  type BoxedElement,
  type ListStyle,
  type Padding,
  type RunBoolKey,
  type RunPatch,
  type RunSize,
  type TextAlignX,
  type TextAlignY,
  type TextRun,
  type TextSize,
} from '@livediagram/diagram';
import {
  ALIGN_ITEMS,
  effectiveRunStyle,
  FIXED_FONT_PX,
  MULTI_FONT_PX,
  MULTI_RUN_PX,
  TEXT_ALIGN,
} from './label-style';
import {
  dataAttrsForRun,
  domSelectionToOffsets,
  insertTextAtCaret,
  offsetsToDomRange,
  readRunsFromDom,
  reconcileTrailingNewline,
  selectRange,
} from './rich-text-dom';
import { RichTextToolbar, type ActiveFormat } from './RichTextToolbar';
import { track } from '@/lib/telemetry';

type Props = {
  // The element being edited — its whole-element text* fields are the
  // defaults each run's unset attrs inherit (for effective styling +
  // toggle computation).
  element: BoxedElement;
  initialLabel: string;
  initialRuns?: TextRun[];
  placeholder: string;
  textSize: TextSize;
  alignX: TextAlignX;
  alignY: TextAlignY;
  padding: number;
  fontFamily?: string;
  multiline: boolean;
  cursorAtEnd: boolean;
  zoom: number;
  textClassName?: string;
  // When true, the editor lays out as a flex CHILD (it fills the slot it's
  // given) instead of an `absolute inset-0` fill of the whole element, and
  // drops its own padding (the surrounding layout owns the inset). Used by
  // the inline-icon shape layout so the icon stays visible beside the editor
  // while typing; positioning + padding are handled by that flex group.
  inline?: boolean;
  onCommit: (label: string, runs: TextRun[]) => void;
  onCancel: () => void;
  // Whole-element controls surfaced in the edit toolbar (they operate on the
  // current selection = the editing element).
  onSetAlign?: (x: TextAlignX, y: TextAlignY) => void;
  onSetPadding?: (padding: Padding) => void;
  onSetFont?: (font: string | null) => void;
  onSetTextSize?: (size: TextSize) => void;
  currentFont?: string | null;
};

// Apply a React.CSSProperties object onto a live DOM style declaration,
// skipping undefined so we don't write the string "undefined".
function applyCss(target: CSSStyleDeclaration, props: React.CSSProperties): void {
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    (target as unknown as Record<string, string>)[k] = typeof v === 'number' ? String(v) : v;
  }
}

// Expand a collapsed caret to the word it sits in (or just left of), so a
// toolbar click with no selection formats the surrounding word. Returns
// null when there's no word to act on (whitespace / empty).
function wordRangeAt(text: string, pos: number): { start: number; end: number } | null {
  const n = text.length;
  if (n === 0) return null;
  const ws = (i: number) => i < 0 || i >= n || /\s/.test(text[i]!);
  let i = Math.max(0, Math.min(pos, n));
  if (ws(i)) i -= 1; // caret at end of / after a word -> use the char to the left
  if (i < 0 || ws(i)) return null;
  let start = i;
  let end = i + 1;
  while (start > 0 && !ws(start - 1)) start--;
  while (end < n && !ws(end)) end++;
  return { start, end };
}

const BOOL_DEFAULT: Record<RunBoolKey, (el: BoxedElement) => boolean> = {
  bold: (el) => !!el.textBold,
  italic: (el) => !!el.textItalic,
  underline: (el) => !!el.textUnderline,
  strikethrough: (el) => !!el.textStrikethrough,
};

// The slice of runs covering [start, end) as effective attrs, used to
// decide toolbar active-state. Walks runs accumulating offsets.
function computeActiveFormat(
  runs: TextRun[],
  range: { start: number; end: number } | null,
  el: BoxedElement,
): ActiveFormat {
  // A run with no size override inherits the element's textSize; reflect
  // that as the active size so the toolbar highlights the current size by
  // default ('scale' is a first-class option now).
  const sizeFallback: RunSize | 'scale' = el.textSize ?? 'scale';
  const empty: ActiveFormat = {
    bold: BOOL_DEFAULT.bold(el),
    italic: BOOL_DEFAULT.italic(el),
    underline: BOOL_DEFAULT.underline(el),
    strikethrough: BOOL_DEFAULT.strikethrough(el),
    size: sizeFallback,
    color: el.textColor ?? null,
  };
  if (!range) return empty;
  let { start, end } = range;
  if (start === end) {
    // Reflect the run just left of the caret so the toolbar reads sensibly.
    const w = wordRangeAt(runsPlainText(runs), start);
    if (!w) return empty;
    start = w.start;
    end = w.end;
  }
  const covered: TextRun[] = [];
  let pos = 0;
  for (const run of runs) {
    const runEnd = pos + run.text.length;
    if (pos < end && runEnd > start) covered.push(run);
    pos = runEnd;
  }
  if (covered.length === 0) return empty;
  const allBool = (key: RunBoolKey) =>
    covered.every((r) => (r[key] ?? BOOL_DEFAULT[key](el)) === true);
  const uniform = <T,>(pick: (r: TextRun) => T | undefined, fallback: T | null): T | null => {
    const vals = covered.map((r) => pick(r) ?? fallback);
    return vals.every((v) => v === vals[0]) ? (vals[0] as T | null) : null;
  };
  // Size resolves to each run's override or the element default ('scale'
  // included), uniform across the selection or null when mixed.
  const sizeVals = covered.map((r): RunSize | 'scale' => r.size ?? sizeFallback);
  const size = sizeVals.every((v) => v === sizeVals[0]) ? (sizeVals[0] ?? null) : null;
  return {
    bold: allBool('bold'),
    italic: allBool('italic'),
    underline: allBool('underline'),
    strikethrough: allBool('strikethrough'),
    size,
    color: uniform((r) => r.color, el.textColor ?? null),
  };
}

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
}: Props) {
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

  const runSizePx = multiline ? MULTI_RUN_PX : FIXED_FONT_PX;
  const basePx = multiline
    ? MULTI_FONT_PX[textSize]
    : textSize === 'scale'
      ? 16
      : FIXED_FONT_PX[textSize];

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
    selectRange(offsetsToDomRange(el, cursorAtEnd ? len : 0, len));
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
        inline ? 'relative min-w-0 flex-1 self-stretch' : 'absolute inset-0'
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
        onPointerDown={(e) => e.stopPropagation()}
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
        className={`pointer-events-auto absolute left-1/2 z-50 ${
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
