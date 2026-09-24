'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

// One line of plain text, edited in place on the canvas: a page's masthead
// (spec/100), and every secondary line of the web components (spec/146) — a
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
// the first click selects, the next one edits.

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
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);

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

  return (
    <div className="relative min-w-0">
      <div
        ref={ref}
        // Editable in place. `plaintext-only` keeps pasted rich text from
        // arriving as markup this field has nowhere to store.
        contentEditable={editable ? 'plaintext-only' : false}
        suppressContentEditableWarning
        role="textbox"
        aria-label={ariaLabel}
        tabIndex={editable ? 0 : -1}
        onFocus={() => setEditing(true)}
        onBlur={commit}
        // The canvas would otherwise read a press here as the start of a drag
        // and never give the caret to this field.
        onPointerDown={(e) => {
          if (editable) e.stopPropagation();
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
        className={`${editable ? 'pointer-events-auto cursor-text' : 'pointer-events-none'} w-full truncate rounded-sm outline-none focus:bg-brand-50/60 focus:text-slate-900 ${className}`}
        style={{
          ...style,
          // Selection chrome scales with the canvas everywhere else; a focus
          // ring drawn in element space would thicken as you zoom in.
          outlineWidth: 1 / zoom,
        }}
      />
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
