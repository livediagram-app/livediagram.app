'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useCommitOnLeave } from '../../hooks/ui/useCommitOnLeave';
import { isDragTravel } from '../../lib/press-gestures';

// One line of plain text, edited in place on the canvas: a page's masthead
// (docs/specs/009-elements/page-element.md), and every secondary line of the web components (docs/specs/009-elements/web-components-and-no-groups.md) — a
// banner's subtitle, a stat's value, a process step, a nav link, a hero's
// caption.
//
// Deliberately NOT the shared label editor. That editor owns one field per
// element (`label` + its runs), and threading more targets through it would
// complicate every element to serve a few. These are single-line plain
// strings, so a contentEditable that commits on blur is the whole requirement.
//
// `editable` false renders the same text inert, so a press on it falls
// through to the element (select / drag). The web components pass
// "selected and not read-only", which gives the rule the timeline rail uses:
// the first click selects, the next one edits. Even then a press that moves is
// the element's (it drags it, as a press anywhere on it would): only a press
// that lets go where it started puts the caret here (web-components-and-no-groups.md).
// Pressing, holding and editing never recolour the face: the line being edited
// shows a thin outline, nothing else.

/** Where a click put the caret in a line: the text position under the point, where the browser can say. */
function caretAt(node: HTMLElement, x: number, y: number): void {
  const doc = node.ownerDocument;
  const sel = doc.getSelection();
  if (!sel) return;
  const pos = (
    doc as Document & {
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
    }
  ).caretPositionFromPoint?.(x, y);
  const range = pos
    ? (() => {
        const r = doc.createRange();
        r.setStart(pos.offsetNode, pos.offset);
        return r;
      })()
    : (doc.caretRangeFromPoint?.(x, y) ?? null);
  if (!range || !node.contains(range.startContainer)) return;
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function InlineTextLine({
  value,
  placeholder,
  editable,
  onCommit,
  zoom,
  maxLength,
  className = '',
  style,
  ariaLabel,
  animated,
}: {
  value: string;
  placeholder: string;
  editable: boolean;
  onCommit: (next: string) => void;
  zoom: number;
  maxLength: number;
  className?: string;
  style?: CSSProperties;
  ariaLabel: string;
  // The line's words split for a Text animation (docs/specs/028-animation/element-animations.md),
  // drawn over the line while it is not being edited; the editable line stays beneath, unseen,
  // to take the click that edits it.
  animated?: { node: ReactNode; className: string; style: CSSProperties };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const showAnimated = animated !== undefined && !editing && value.length > 0;

  // The DOM is the truth while editing, so the value is only written in when
  // NOT editing. Without the guard, every keystroke would re-render the same
  // text back into the node and send the caret to the start.
  useEffect(() => {
    if (!editing && ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value;
    }
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const next = (ref.current?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
    if (next !== value) onCommit(next);
    if (ref.current) ref.current.textContent = next;
  };
  // The page going fires no blur: commit what was typed before the unload flush reads it.
  useCommitOnLeave(editing, commit);

  return (
    <div className="relative min-w-0">
      <div
        ref={ref}
        // Editable in place. `plaintext-only` keeps pasted rich text from
        // arriving as markup this field has nowhere to store.
        contentEditable={editable ? 'plaintext-only' : false}
        suppressContentEditableWarning
        // Right-to-left text reads right to left (label-bidi.css).
        dir="auto"
        role="textbox"
        aria-label={ariaLabel}
        // Not focusable at all while inert: the element around it is one `img`, and a focusable
        // line inside it (even at -1) is a control nested in another (axe nested-interactive).
        tabIndex={editable ? 0 : undefined}
        onFocus={() => setEditing(true)}
        onBlur={commit}
        // While editing, a press is the field's (the caret, a selection of its words). Before that, a press is
        // the element's: it reaches the element (which drags it if it moves), and the browser neither focuses
        // the line nor starts a text selection, so nothing changes colour under the pointer. Only a release where
        // it started (a click) then edits, with the caret where it was pressed.
        onPointerDown={(e) => {
          if (!editable) return;
          if (editing) {
            e.stopPropagation();
            return;
          }
          if (e.button !== 0) return;
          e.preventDefault();
          const node = ref.current;
          const start = { x: e.clientX, y: e.clientY, id: e.pointerId };
          const win = node?.ownerDocument.defaultView;
          if (!node || !win) return;
          const done = () => {
            win.removeEventListener('pointerup', onUp, true);
            win.removeEventListener('pointercancel', done, true);
          };
          const onUp = (up: PointerEvent) => {
            if (up.pointerId !== start.id) return;
            done();
            if (isDragTravel(up.clientX - start.x, up.clientY - start.y)) return;
            node.focus();
            caretAt(node, up.clientX, up.clientY);
          };
          win.addEventListener('pointerup', onUp, true);
          win.addEventListener('pointercancel', done, true);
        }}
        // The mouse's own default (focus, a text selection) waits for the click too.
        onMouseDown={(e) => {
          if (editable && !editing) e.preventDefault();
        }}
        // A double-click here means "edit this line", not the element's label.
        onDoubleClick={(e) => {
          if (editable) e.stopPropagation();
        }}
        onKeyDown={(e) => {
          // Every key is kept off the canvas: unstopped, typing "d" here would
          // also run the editor's add-a-diamond shortcut.
          e.stopPropagation();
          if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            // Enter commits, Escape restores — a one-line field has nothing to
            // do with a newline either way.
            if (e.key === 'Escape' && ref.current) ref.current.textContent = value;
            ref.current?.blur();
          }
        }}
        className={`${editable ? 'pointer-events-auto cursor-text' : 'pointer-events-none'} w-full truncate rounded-sm outline-none focus:outline-solid focus:outline-brand-500/70 ${className} ${showAnimated ? 'opacity-0' : ''}`}
        style={{
          ...style,
          // Selection chrome scales with the canvas everywhere else; a focus
          // ring drawn in element space would thicken as you zoom in.
          outlineWidth: 1 / zoom,
        }}
      />
      {animated && showAnimated ? (
        <div
          key={animated.className}
          aria-hidden
          className={`pointer-events-none absolute inset-0 truncate ${className} ${animated.className}`}
          style={{ ...style, ...animated.style }}
        >
          {animated.node}
        </div>
      ) : null}
      {value.length === 0 && !editing ? (
        // A placeholder rather than a collapsed line, so an unwritten element
        // has the same shape as a written one.
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 truncate opacity-40 ${className}`}
          style={style}
        >
          {placeholder}
        </span>
      ) : null}
    </div>
  );
}
