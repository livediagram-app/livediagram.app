import {
  forwardRef,
  type AriaAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

// The shared text fields. The blessed focus treatment —
// brand border + a 2px brand ring — was applied inconsistently: some
// inputs (TeamFormModal) had it, others (ShareDialog's link-name field)
// only changed the border and skipped the ring, so focus read
// differently field to field. This bakes the full treatment in once,
// for the single-line input and the textarea alike.
//
// `w-full` is the default because every current call site is a
// block-level field; pass `className` to add layout (mt-…) or override
// width. All native props (value, onChange, placeholder, maxLength,
// ref, …) pass through, so each is a drop-in for the raw element.
// `invalid` swaps the border for the problem treatment (a rose border
// and ring) rather than stacking a second border colour on top.
// `compact` is the denser form rhythm (dense panels and editors): smaller
// padding and 13px type, the same border, focus ring and colours.
// A disabled field reads as one (a quieter fill and text, the not-allowed cursor): a Participant or Viewer meets
// them in panels they may read but not change, where a white field looked editable.
// `invalid` is told to a screen reader too (`aria-invalid`), and `hintId` names the line that says why (or the hint
// under the field): it joins `aria-describedby`, after any ids the caller passed there. A caller's own
// `aria-invalid` still wins (Work Tracker 1171).

const SHAPE =
  'w-full rounded-md border bg-white text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-400';
const PAD = 'px-3 py-2 text-sm';
const PAD_COMPACT = 'px-2 py-1.5 text-[13px]';
const BORDER = 'border-slate-200 dark:border-slate-700';

// A field with a problem: easy to spot. Exported for composite fields (a chip input's box).
export const FIELD_INVALID =
  'border-rose-400 ring-2 ring-rose-100 dark:border-rose-400/70 dark:ring-rose-500/20';

const fieldClass = (
  invalid: boolean | undefined,
  compact: boolean | undefined,
  className: string | undefined,
) =>
  `${SHAPE} ${compact ? PAD_COMPACT : PAD} ${invalid ? FIELD_INVALID : BORDER}${className ? ` ${className}` : ''}`;

type FieldOptions = {
  invalid?: boolean;
  compact?: boolean;
  // The id of the element that says why the value is wrong, or of the hint under the field.
  hintId?: string;
};

// What a field tells a screen reader about its state, spread after the caller's props: the caller's own
// `aria-invalid` wins over `invalid`, and `hintId` joins its `aria-describedby` rather than replacing it.
const fieldAria = (
  invalid: boolean | undefined,
  hintId: string | undefined,
  own: AriaAttributes,
): AriaAttributes => {
  const ids = [own['aria-describedby'], hintId].filter(Boolean).join(' ');
  return {
    'aria-invalid': own['aria-invalid'] ?? (invalid || undefined),
    'aria-describedby': ids || undefined,
  };
};

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & FieldOptions;

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, invalid, compact, hintId, type = 'text', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={fieldClass(invalid, compact, className)}
      {...rest}
      {...fieldAria(invalid, hintId, rest)}
    />
  );
});

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldOptions;

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, invalid, compact, hintId, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={fieldClass(invalid, compact, className)}
      {...rest}
      {...fieldAria(invalid, hintId, rest)}
    />
  );
});
