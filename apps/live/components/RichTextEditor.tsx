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
  normalizeRuns,
  runsFromPlainText,
  runsPlainText,
  toggleFormatInRange,
  type BoxedElement,
  type RunBoolKey,
  type RunPatch,
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
  offsetsToDomRange,
  readRunsFromDom,
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
  onCommit: (label: string, runs: TextRun[]) => void;
  onCancel: () => void;
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
  const empty: ActiveFormat = {
    bold: BOOL_DEFAULT.bold(el),
    italic: BOOL_DEFAULT.italic(el),
    underline: BOOL_DEFAULT.underline(el),
    strikethrough: BOOL_DEFAULT.strikethrough(el),
    size: null,
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
  return {
    bold: allBool('bold'),
    italic: allBool('italic'),
    underline: allBool('underline'),
    strikethrough: allBool('strikethrough'),
    size: uniform((r) => r.size, null),
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
  };

  const refreshActive = () => {
    const el = editorRef.current;
    if (!el) return;
    const offsets = domSelectionToOffsets(el);
    if (offsets) selectionRef.current = offsets;
    setActive(computeActiveFormat(runsRef.current, offsets ?? selectionRef.current, element));
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
    return () => document.removeEventListener('selectionchange', onSel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flip the toolbar below the element when it would clip the top edge.
  useLayoutEffect(() => {
    const measure = () => {
      const wrap = toolbarWrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      setPlaceBelow(rect.top < 8);
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

  // Resolve the range to format: the live selection, or the surrounding
  // word when the caret is collapsed. Returns null to no-op.
  const targetRange = (): { start: number; end: number } | null => {
    const el = editorRef.current;
    if (!el) return null;
    const sel = domSelectionToOffsets(el) ?? selectionRef.current;
    if (!sel) return null;
    if (sel.start !== sel.end) return sel;
    return wordRangeAt(runsPlainText(runsRef.current), sel.start);
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

  return (
    <div
      className="pointer-events-none absolute inset-0 flex overflow-visible"
      style={{ alignItems: ALIGN_ITEMS[alignY], padding }}
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
          const el = editorRef.current;
          if (el) runsRef.current = readRunsFromDom(el);
          refreshActive();
        }}
        onBlur={(e) => {
          // Stay editing if focus moved into the toolbar (e.g. the native
          // colour input opening its OS dialog).
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
            // Insert a newline as text (never <br>) to keep the plain-text
            // length === DOM textContent length invariant.
            e.preventDefault();
            document.execCommand('insertText', false, '\n');
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          if (text) document.execCommand('insertText', false, text);
        }}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          const el = editorRef.current;
          if (el) runsRef.current = readRunsFromDom(el);
          refreshActive();
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
        // carries). Button mousedown additionally preventDefaults to keep
        // the text selection; this just keeps the canvas out of it.
        onPointerDown={(e) => e.stopPropagation()}
        className={`pointer-events-auto absolute left-1/2 z-50 ${
          placeBelow ? 'top-full mt-1' : 'bottom-full mb-1'
        }`}
        style={{
          transform: `translateX(-50%) scale(${1 / zoom})`,
          transformOrigin: placeBelow ? 'top center' : 'bottom center',
        }}
      >
        <RichTextToolbar
          active={active}
          onToggle={onToggle}
          onSize={(size) => onPatch({ size })}
          onColor={(color) => onPatch({ color })}
        />
      </div>
    </div>
  );
}
