'use client';

import { useEffect, useRef, useState } from 'react';
import { PAGE_HEADING_MAX, type ShapeElement } from '@livediagram/diagram';

// A Page's fixed masthead (spec/100): a heading and a subtitle above the body,
// separated by a hairline rule.
//
// They are their own fields rather than the first two lines of the body,
// because a page's title is STRUCTURE, not prose. Kept apart, the body can be
// reordered, reformatted or emptied without the heading moving or vanishing,
// and the masthead can be styled as a masthead rather than as whatever the
// first line of the rich text happens to be.
//
// "Fixed" means always present: an empty heading renders its placeholder
// rather than collapsing, so the shape of a page is the same before and after
// anyone writes in it, and the body never creeps up into the title's space.
//
// Editing is deliberately NOT the shared label editor. That editor owns one
// field per element (`label` + its runs) and threading a second and third
// target through it would complicate every element to serve one. These are
// single-line plain strings, so a contentEditable span that commits on blur is
// the whole requirement.

export function PageMasthead({
  element,
  readOnly,
  onSetHeading,
  fontFamily,
  zoom,
}: {
  element: ShapeElement;
  readOnly: boolean;
  onSetHeading: (elementId: string, field: 'pageTitle' | 'pageSubtitle', value: string) => void;
  fontFamily: string | undefined;
  zoom: number;
}) {
  return (
    <div
      // Not pointer-events-none as a whole: the two lines are editable. The
      // gap between and around them stays inert so a press there still drags
      // the page (the canvas owns press-drag on an element).
      className="pointer-events-none flex shrink-0 flex-col gap-0.5 border-b pb-2"
      style={{
        borderColor: element.strokeColor ?? '#d4d4d8',
        fontFamily,
      }}
    >
      <MastheadLine
        value={element.pageTitle ?? ''}
        placeholder="Title"
        readOnly={readOnly}
        onCommit={(next) => onSetHeading(element.id, 'pageTitle', next)}
        zoom={zoom}
        className="text-[19px] font-semibold leading-tight text-slate-900"
        ariaLabel="Page title"
      />
      <MastheadLine
        value={element.pageSubtitle ?? ''}
        placeholder="Subtitle"
        readOnly={readOnly}
        onCommit={(next) => onSetHeading(element.id, 'pageSubtitle', next)}
        zoom={zoom}
        className="text-[12px] font-medium leading-snug text-slate-500"
        ariaLabel="Page subtitle"
      />
    </div>
  );
}

function MastheadLine({
  value,
  placeholder,
  readOnly,
  onCommit,
  zoom,
  className,
  ariaLabel,
}: {
  value: string;
  placeholder: string;
  readOnly: boolean;
  onCommit: (next: string) => void;
  zoom: number;
  className: string;
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
    const next = (ref.current?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, PAGE_HEADING_MAX);
    if (next !== value) onCommit(next);
    if (ref.current) ref.current.textContent = next;
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        // Editable in place. `plaintext-only` keeps pasted rich text from
        // arriving as markup this field has nowhere to store.
        contentEditable={readOnly ? false : 'plaintext-only'}
        suppressContentEditableWarning
        role="textbox"
        aria-label={ariaLabel}
        tabIndex={readOnly ? -1 : 0}
        onFocus={() => setEditing(true)}
        onBlur={commit}
        // The canvas would otherwise read a press here as the start of a drag
        // and never give the caret to this field.
        onPointerDown={(e) => {
          if (!readOnly) e.stopPropagation();
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
        className={`${readOnly ? 'pointer-events-none' : 'pointer-events-auto'} w-full cursor-text truncate rounded-sm outline-none focus:bg-brand-50/60 ${className}`}
        style={{
          // Selection chrome scales with the canvas everywhere else; a focus
          // ring drawn in element space would thicken as you zoom in.
          outlineWidth: 1 / zoom,
        }}
      />
      {value.length === 0 && !editing ? (
        // A placeholder rather than a collapsed line: the masthead is fixed,
        // so an unwritten page has the same shape as a written one.
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 truncate opacity-40 ${className}`}
        >
          {placeholder}
        </span>
      ) : null}
    </div>
  );
}
