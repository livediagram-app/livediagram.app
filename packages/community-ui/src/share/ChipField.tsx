'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ClipboardEventHandler,
  type ReactNode,
} from 'react';
import { CloseIcon, FIELD_INVALID, isComposingKey } from '@liveworkspace/ui';

// The shared chip field: chips typed into one bordered field, as the Community publish dialog's tags are.
// Enter adds the draft (the caller decides what adding means, and handles a
// comma in `onDraftChange`), Backspace in an empty field takes the last chip back, and each chip has
// its own remove button. A remove (or the caller's `refocus()`, after a commit or a suggestion) puts
// focus back in the field, or on the last chip's remove button while the field is disabled, rather
// than letting it fall out of the dialog with the button that had it.

export type ChipFieldHandle = {
  // Focus the field (or the last remove button) after the next render.
  refocus: () => void;
};

type ChipFieldProps = {
  chips: readonly string[];
  // What a chip reads (Community prefixes `#`); its text by default.
  chipText?: (chip: string) => string;
  removeLabel: (chip: string) => string;
  // A chip that is not what the field takes (a typed-in email address that is not one): drawn in rose, with
  // `invalidChipNote` read after it by a screen reader.
  invalidChip?: (chip: string) => boolean;
  invalidChipNote?: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onRemove: (chip: string) => void;
  onBlur?: () => void;
  // A paste into the field, before the input takes it (an input drops a pasted list's line breaks).
  onPaste?: ClipboardEventHandler<HTMLInputElement>;
  // Read-only (someone who may only view): the chips alone, no remove buttons and no field.
  readOnly?: boolean;
  // Everything is shown but off (a dialog busy submitting).
  disabled?: boolean;
  // Only the typing is off (Community's "That is all five"); chips can still be removed.
  inputDisabled?: boolean;
  invalid?: boolean;
  id?: string;
  placeholder?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  // A datalist of suggestions, rendered as `children`.
  list?: string;
  // Shown in place of the field when it is read-only and holds no chips.
  emptyText?: string;
  children?: ReactNode;
};

export const ChipField = forwardRef<ChipFieldHandle, ChipFieldProps>(function ChipField(
  {
    chips,
    chipText = (c) => c,
    removeLabel,
    invalidChip,
    invalidChipNote = 'not valid',
    draft,
    onDraftChange,
    onCommit,
    onRemove,
    onBlur,
    onPaste,
    readOnly = false,
    disabled = false,
    inputDisabled = false,
    invalid = false,
    id,
    placeholder,
    ariaLabel,
    ariaDescribedBy,
    list,
    emptyText,
    children,
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const refocusing = useRef(false);
  useImperativeHandle(ref, () => ({ refocus: () => (refocusing.current = true) }), []);
  useEffect(() => {
    if (!refocusing.current) return;
    refocusing.current = false;
    const input = inputRef.current;
    if (input && !input.disabled) {
      input.focus();
      return;
    }
    const removers = boxRef.current?.querySelectorAll<HTMLButtonElement>(
      'button[data-remove-chip]',
    );
    removers?.[removers.length - 1]?.focus();
  });

  return (
    <div
      ref={boxRef}
      className={`flex flex-wrap items-center rounded-md border bg-white transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 dark:bg-slate-900 gap-1.5 px-2 py-1.5 text-sm ${
        invalid ? FIELD_INVALID : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      {chips.map((chip) => {
        const bad = invalidChip?.(chip) ?? false;
        return (
          <span
            key={chip}
            data-invalid-chip={bad || undefined}
            className={`inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs font-medium ${
              bad
                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/50'
                : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
            }`}
          >
            {chipText(chip)}
            {bad ? <span className="sr-only">, {invalidChipNote}</span> : null}
            {readOnly ? null : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  refocusing.current = true;
                  onRemove(chip);
                }}
                data-remove-chip
                aria-label={removeLabel(chip)}
                className="flex h-4 w-4 items-center justify-center rounded-full text-brand-700 transition hover:bg-brand-100 hover:text-brand-800 dark:text-brand-300 dark:hover:bg-brand-500/25 dark:hover:text-brand-100"
              >
                <CloseIcon size={10} />
              </button>
            )}
          </span>
        );
      })}
      {readOnly ? (
        chips.length === 0 && emptyText ? (
          <span className="px-1 text-slate-500 dark:text-slate-400">{emptyText}</span>
        ) : null
      ) : (
        <input
          ref={inputRef}
          id={id}
          value={draft}
          list={list}
          disabled={disabled || inputDisabled}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter and Backspace confirm or edit an input method's word first (design-principles.md).
            if (isComposingKey(e)) return;
            if (e.key === 'Enter') {
              // Never submits a surrounding form: Enter here means "add this chip".
              e.preventDefault();
              onCommit();
            } else if (e.key === 'Backspace' && draft === '' && chips.length > 0) {
              e.preventDefault();
              onRemove(chips[chips.length - 1]!);
            }
          }}
          onBlur={onBlur}
          onPaste={onPaste}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          spellCheck={false}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:text-slate-100"
        />
      )}
      {children}
    </div>
  );
});
