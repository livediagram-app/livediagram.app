'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { CloseIcon, FIELD_INVALID } from '@livediagram/ui';

// The shared chip field: chips typed into one bordered field, the Community publish dialog's tags and
// a Plan card's labels. Enter adds the draft (the caller decides what adding means, and handles a
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
  // A chip's own colours (Plan's label swatches); brand chips by default.
  chipStyle?: (chip: string) => CSSProperties;
  removeLabel: (chip: string) => string;
  draft: string;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onRemove: (chip: string) => void;
  onBlur?: () => void;
  // Read-only (someone who may only view): the chips alone, no remove buttons and no field.
  readOnly?: boolean;
  // Everything is shown but off (a dialog busy submitting).
  disabled?: boolean;
  // Only the typing is off (Community's "That is all five"); chips can still be removed.
  inputDisabled?: boolean;
  invalid?: boolean;
  // The denser form rhythm (Plan's item panel), as TextInput's `compact`.
  compact?: boolean;
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
    chipStyle,
    removeLabel,
    draft,
    onDraftChange,
    onCommit,
    onRemove,
    onBlur,
    readOnly = false,
    disabled = false,
    inputDisabled = false,
    invalid = false,
    compact = false,
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

  const box = compact
    ? 'min-h-[34px] gap-1.5 px-1.5 py-1 text-[13px]'
    : 'gap-1.5 px-2 py-1.5 text-sm';
  const chipSize = compact ? 'pl-2 text-[12px]' : 'pl-2.5 text-xs';
  return (
    <div
      ref={boxRef}
      className={`flex flex-wrap items-center rounded-md border bg-white transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 dark:bg-slate-900 ${box} ${
        invalid ? FIELD_INVALID : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      {chips.map((chip) => (
        <span
          key={chip}
          className={`inline-flex items-center gap-1 rounded-full py-0.5 pr-1 font-medium ${chipSize} ${
            chipStyle ? '' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
          }`}
          style={chipStyle?.(chip)}
        >
          {chipText(chip)}
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
              className={`flex h-4 w-4 items-center justify-center rounded-full transition ${
                chipStyle
                  ? 'hover:bg-black/10 dark:hover:bg-white/15'
                  : 'text-brand-500 hover:bg-brand-100 hover:text-brand-700 dark:text-brand-300 dark:hover:bg-brand-500/25 dark:hover:text-brand-100'
              }`}
            >
              <CloseIcon size={10} />
            </button>
          )}
        </span>
      ))}
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
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          spellCheck={false}
          className={`flex-1 bg-transparent px-1 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:text-slate-100 ${
            compact ? 'min-w-20' : 'min-w-[8rem] py-0.5'
          }`}
        />
      )}
      {children}
    </div>
  );
});
