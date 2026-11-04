'use client';

// The plan's name and description, edited where they stand on the Overview (docs/specs/026-plan/plan-overview.md
// "Editing in place"). Idle, the text is drawn as itself with a transparent button over it, so the heading keeps the
// plan's name as its own and the button carries "Rename" / "Edit Description". Editing, a text box in the same box
// and type takes its place, so the page does not move.
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { PencilIcon, Tooltip } from '@liveplanner/ui';
import { useAutoHeight } from '@liveworkspace/workbench/hooks/ui/useAutoHeight';
import { useCommitOnLeave } from '@liveworkspace/workbench/hooks/ui/useCommitOnLeave';

// The description's count shows once it passes this (blueprint DEFAULTS D83).
export const DESCRIPTION_COUNT_FROM = 400;

// How tall each box grows before it scrolls.
const NAME_LINES = 4;
const DESCRIPTION_LINES = 14;

// The box the text sits in, idle and editing alike: the padding is pulled back out with the margin, so the text
// lines up with the eyebrow and dates while the hover wash and the editing ring get room around it.
const BOX = '-mx-2 rounded-lg px-2 py-0.5';

export type EditInPlaceProps = {
  // 'name' is one line (Enter saves); 'description' takes new lines (Cmd or Ctrl + Enter saves).
  kind: 'name' | 'description';
  value: string;
  // The text's own element and classes (type size, weight, colour), used for the text and for the box alike.
  as: 'h1' | 'p';
  id?: string | undefined;
  textClass: string;
  // The idle button's name and tooltip: "Rename", "Edit Description".
  label: string;
  // The text box's name: "Plan Name", "Description".
  fieldLabel: string;
  placeholder?: string | undefined;
  maxLength: number;
  editing: boolean;
  onStart: () => void;
  // Called once per edit, after any save.
  onEnd: () => void;
  // Handed only a changed, trimmed value; never an empty name.
  onSave: (next: string) => void;
  // Marks the idle text (tests and the page read it).
  textData?: Record<string, string> | undefined;
};

export function EditInPlace(props: EditInPlaceProps) {
  const { as: Tag, id, textClass, value, label, editing, onStart, textData } = props;
  const button = useRef<HTMLButtonElement>(null);
  // Set when an edit ends by a key, so focus goes back to the button it started from.
  const refocus = useRef(false);
  useEffect(() => {
    if (!editing && refocus.current) {
      refocus.current = false;
      button.current?.focus();
    }
  }, [editing]);

  if (editing)
    return (
      <EditInPlaceField
        {...props}
        onKeyEnd={() => {
          refocus.current = true;
        }}
      />
    );

  const startByKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== 'F2') return;
    e.preventDefault();
    e.stopPropagation();
    onStart();
  };
  return (
    <div
      className={`group relative w-fit max-w-[calc(100%+1rem)] ${BOX} ${Tag === 'h1' ? 'pr-8' : 'pr-6'} transition-colors duration-150 hover:bg-brand-100/70 has-[button:focus-visible]:bg-brand-100/70 dark:hover:bg-brand-900/50 dark:has-[button:focus-visible]:bg-brand-900/50`}
    >
      <Tag id={id} className={textClass} {...textData}>
        {value}
        {/* Zero wide, so the pencil never wraps onto a line of its own; it draws into the box's right padding. */}
        <span className="inline-block w-0 align-baseline">
          <PencilIcon
            size={Tag === 'h1' ? 18 : 13}
            className="ml-2 inline-block max-w-none text-brand-700 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-has-[button:focus-visible]:opacity-100 pointer-coarse:opacity-60 dark:text-brand-300"
          />
        </span>
      </Tag>
      <Tooltip label={label}>
        <button
          ref={button}
          type="button"
          aria-label={label}
          onClick={onStart}
          onKeyDown={startByKey}
          className="absolute inset-0 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        />
      </Tooltip>
    </div>
  );
}

// The open edit: mounted afresh for each one, so its draft starts from the value as it is now.
function EditInPlaceField({
  kind,
  value,
  as: Tag,
  id,
  textClass,
  fieldLabel,
  placeholder,
  maxLength,
  onEnd,
  onSave,
  onKeyEnd,
}: EditInPlaceProps & { onKeyEnd: () => void }) {
  const [draft, setDraft] = useState(value);
  const field = useRef<HTMLTextAreaElement>(null);
  const countId = useId();
  // Set once the edit has finished, so the blur that follows Enter or Escape cannot save again.
  const closed = useRef(false);
  const isName = kind === 'name';
  useAutoHeight(field, draft, { lines: isName ? NAME_LINES : DESCRIPTION_LINES });

  useLayoutEffect(() => {
    const node = field.current;
    if (!node) return;
    node.focus();
    if (isName) node.select();
    else node.setSelectionRange(node.value.length, node.value.length);
  }, [isName]);

  const finish = (save: boolean) => {
    if (closed.current) return;
    closed.current = true;
    const next = draft.trim();
    if (save && next !== value.trim() && (next || !isName)) onSave(next);
    onEnd();
  };
  useCommitOnLeave(true, () => finish(true));

  const showCount = !isName && draft.length > DESCRIPTION_COUNT_FROM;
  const box = (
    <textarea
      ref={field}
      rows={1}
      value={draft}
      maxLength={maxLength}
      aria-label={fieldLabel}
      aria-describedby={showCount ? countId : undefined}
      placeholder={placeholder}
      // A name is one line: new lines typed or pasted become spaces.
      onChange={(e) => setDraft(isName ? e.target.value.replace(/[\r\n]+/g, ' ') : e.target.value)}
      onKeyDown={(e) => {
        // Every key stays off the editor's shortcuts.
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          onKeyEnd();
          finish(false);
        } else if (e.key === 'Enter' && (isName || e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onKeyEnd();
          finish(true);
        }
      }}
      onBlur={() => finish(true)}
      // Font, spacing and colour are inherited (the base styles), so the box reads as the text it replaces.
      className="block w-full resize-none overflow-hidden bg-transparent p-0 outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400"
    />
  );
  return (
    <div className={`${BOX} bg-white ring-2 ring-brand-400 dark:bg-slate-900 dark:ring-brand-500`}>
      {/* The box stays inside the text's own element (the name inside its h1), so the type is the text's. */}
      <Tag id={id} className={textClass}>
        {box}
      </Tag>
      {showCount ? (
        <span
          id={countId}
          aria-live="polite"
          className="mt-1 block text-right text-xs tabular-nums text-slate-500 dark:text-slate-400"
        >
          {draft.length} / {maxLength}
        </span>
      ) : null}
    </div>
  );
}
