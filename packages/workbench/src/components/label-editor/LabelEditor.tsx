// The in-place rich-text editor (docs/specs/008-canvas/canvas-and-palette.md). Replaces the plain <textarea>
// label editors for shape / text / sticky: a single contentEditable that
// renders the label's runs as styled <span>s and shows a floating toolbar
// for per-range bold / italic / underline / strikethrough / lists / colour.
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
//
// The session state (runs / selection refs, paint + read-back, the
// commit lifecycle) lives in useRichTextSession; this file keeps the
// JSX and its event handlers.
//
// One copy for livediagram, livedesign and livedocuments
// (liveworkspace/docs/specs/011-workbench/label-editor.md): each binds it once
// with `createLabelEditor`, in its components/canvas/RichTextEditor.tsx, handing
// in its toolbar, its telemetry and any keys of its own.

import type { KeyboardEvent } from 'react';
import type { BoxedElement } from '@liveworkspace/element-model/element';
import { useCanvasZoom } from '../canvas/CanvasZoomContext';
import { fitInsertion } from '../../lib/text-cap';
import { listStyleOfText } from './block-type';
import type { LabelEditorBinding, LabelEditorProps } from './LabelEditor.types';
import {
  ALIGN_ITEMS,
  labelTypographyClass,
  TEXT_ALIGN,
  wordmarkTextCss,
  wordmarkTextStyle,
} from './label-style';
import { insertTextAtCaret } from './rich-text-dom';
import { formatShortcut } from './rich-text-format';
import { useRichTextSession } from './useRichTextSession';

// A binding without keys of its own handles none.
const NO_KEYS = (_e: KeyboardEvent<HTMLDivElement>) => false;
const useNoKeys = () => NO_KEYS;
const commitOnEscape = (commitNow: () => void) => commitNow();

/** The label editor bound to an editor's toolbar, telemetry and keys: call once, at module scope. */
export function createLabelEditor<E extends BoxedElement>({
  Toolbar,
  trackFormat,
  runStyle,
  useKeyDown = useNoKeys,
  onEscape = commitOnEscape,
}: LabelEditorBinding<E>) {
  return function LabelEditor(props: LabelEditorProps<E>) {
    return (
      <LabelEditorView
        {...props}
        Toolbar={Toolbar}
        trackFormat={trackFormat}
        runStyle={runStyle}
        useKeyDown={useKeyDown}
        onEscape={onEscape}
      />
    );
  };
}

function LabelEditorView<E extends BoxedElement>({
  element,
  initialLabel,
  initialRuns,
  placeholder,
  textSize,
  fitBox,
  alignX,
  alignY,
  padding,
  textScale,
  onLiveText,
  fontFamily,
  multiline,
  uppercase,
  cursorAtEnd,
  textClassName = '',
  onCommit,
  onCancel,
  onSetAlign,
  inline = false,
  maxLength,
  Toolbar,
  trackFormat,
  runStyle,
  useKeyDown,
  onEscape,
}: LabelEditorProps<E> &
  Required<Omit<LabelEditorBinding<E>, 'runStyle'>> &
  Pick<LabelEditorBinding<E>, 'runStyle'>) {
  const zoom = useCanvasZoom();
  const {
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
    applyTitleCaptionPreset,
    liveText,
  } = useRichTextSession({
    element,
    initialLabel,
    initialRuns,
    textSize,
    textScale,
    onLiveText,
    fitBox,
    multiline,
    uppercase,
    fontFamily,
    cursorAtEnd,
    onCommit,
    onCancel,
    trackFormat,
    runStyle,
  });
  // The part of an insertion the label's cap leaves room for (a badge's 24, a step's 3: badge.md "The element"),
  // counting what the selection it replaces frees.
  const fitting = (text: string): string => fitInsertion(editorRef.current, text, maxLength);
  const wordmark = wordmarkTextStyle(element);
  // The binding's own keys (livediagram's mind node: Tab and Enter commit and grow the next node).
  const onBindingKeyDown = useKeyDown({
    element,
    initialLabel,
    editorRef,
    syncFromDom,
    commitNow,
    handleCancel,
  });

  return (
    <div
      // Marks the whole editing session (editor + floating toolbar) so the
      // context menu's outside-click dismiss ignores clicks in here, the
      // menu rides alongside the editor while a label is edited (docs/specs/008-canvas/canvas-and-palette.md).
      data-rich-text-session=""
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
        // Right-to-left text reads right to left (label-bidi.css).
        dir="auto"
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
            toolbarWrapRef.current.contains(e.relatedTarget)
          ) {
            return;
          }
          // Same for the context menu riding alongside the edit session
          // (docs/specs/008-canvas/canvas-and-palette.md): its buttons preserve focus via the capture listener
          // in useRichTextSession, but its form controls (the opacity slider)
          // legitimately take focus, that's a menu interaction, not a
          // click-away. And for the toolbar's colour picker, which opens in a
          // popover outside the toolbar and focuses its swatches
          // (docs/specs/004-interface-design/colour-picker.md).
          if (
            e.relatedTarget instanceof Element &&
            e.relatedTarget.closest(
              '[data-context-menu],[data-menu-flyout],[data-anchored-popover]',
            )
          ) {
            return;
          }
          commitNow();
        }}
        onKeyDown={(e) => {
          // The binding's keys first (livediagram's mind node: Tab and Enter COMMIT this label and
          // grow the next node, so a whole branch is typed without leaving the
          // editor). Handled here rather than in the global shortcut handler
          // because the label has to be committed first, the global one would
          // move the edit to the new node and lose what was just typed.
          if (onBindingKeyDown(e)) return;
          // Escape keeps what was typed and leaves (docs/specs/008-canvas/canvas-and-palette.md "Labels"), as a click
          // away does: it is how people finish typing on a canvas, so a cancel lost the label they had just written.
          // Undo takes it back.
          // The binding may do more (livediagram: out of the editor a placement opened, it leaves the selection too).
          if (e.key === 'Escape') {
            e.preventDefault();
            onEscape(commitNow);
            return;
          }
          // Cmd/Ctrl+B/I/U drive the toolbar's run toggle, never the browser's execCommand.
          const format = formatShortcut(e);
          if (format) {
            e.preventDefault();
            onToggle(format);
            return;
          }
          if (e.key === 'Enter') {
            // Insert a newline as a real '\n' text node (never <br>/<div>)
            // so it survives read-back and keeps plain-text length == DOM
            // textContent length.
            e.preventDefault();
            if (fitting('\n') === '') return;
            insertTextAtCaret('\n');
            syncFromDom();
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = fitting(e.clipboardData.getData('text/plain'));
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
        onBeforeInput={(e) => {
          // A typed character past the label's cap is not taken (a paste is cut in onPaste).
          const typed = (e as unknown as { data?: string | null }).data;
          if (!composingRef.current && typed && fitting(typed) !== typed) {
            e.preventDefault();
            return;
          }
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
          // A deliberate click inside the text places its own caret, the
          // pending type-to-edit end caret must not override it.
          needsEndCaretRef.current = false;
          e.stopPropagation();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        style={{
          fontSize: `${basePx}px`,
          textAlign: TEXT_ALIGN[alignX],
          // One isolated run, never `plaintext` (canvas-performance.md "Typing in a long label stays light"): that
          // costs the square of a line's length. Lines that could read in different directions are each painted in
          // an isolate of their own (rich-text-lines.ts).
          unicodeBidi: 'isolate',
          fontFamily,
          // Wordmark type (a text box's tracking, weight and case): what the
          // committed label wears, so editing never shifts the text.
          ...wordmarkTextCss(wordmark),
          // Same capitals the committed label wears: the typed text is stored
          // as written, it just reads as the label will.
          textTransform:
            uppercase || wordmark.uppercase
              ? 'uppercase'
              : wordmark.lowercase
                ? 'lowercase'
                : undefined,
        }}
        // Same typography rule as the display label (label-style): a
        // mismatch here shifts the text the instant editing starts.
        className={`pointer-events-auto w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent outline-none ${labelTypographyClass(
          multiline,
        )} ${textClassName}`}
      />
      {/* Counter-scale by 1/zoom so the toolbar stays constant on-screen
          size despite the canvas world transform; flip below near the top. */}
      <div
        ref={toolbarWrapRef}
        // The edit-mode element menu opens clear of this (useEditModeContextMenu).
        data-rich-text-toolbar
        // Stop pointer events reaching the canvas, otherwise a click on a
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
          className={`inline-flex items-center pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-700 dark:text-white dark:ring-0 ${
            placeBelow ? 'top-full mt-1' : 'bottom-full mb-1'
          }`}
        >
          <span className="text-optical-line text-optical-caps">Selected Text</span>
        </span>
        <Toolbar
          active={active}
          alignX={alignX}
          alignY={alignY}
          onToggle={onToggle}
          onPatch={onPatch}
          onApplyList={applyList}
          onApplyHeading={applyHeading}
          onApplyTitleCaption={applyTitleCaptionPreset}
          listStyle={listStyleOfText(liveText)}
          onSetAlign={(x, y) => onSetAlign?.(x, y)}
          element={element}
        />
      </div>
    </div>
  );
}
