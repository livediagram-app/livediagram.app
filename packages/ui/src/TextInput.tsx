import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

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

const SHAPE =
  'w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:bg-slate-900 dark:text-slate-100';
const BORDER = 'border-slate-200 dark:border-slate-700';

// A field with a problem: easy to spot. Exported for composite fields (a chip input's box).
export const FIELD_INVALID =
  'border-rose-400 ring-2 ring-rose-100 dark:border-rose-400/70 dark:ring-rose-500/20';

const fieldClass = (invalid: boolean | undefined, className: string | undefined) =>
  `${SHAPE} ${invalid ? FIELD_INVALID : BORDER}${className ? ` ${className}` : ''}`;

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, invalid, type = 'text', ...rest },
  ref,
) {
  return <input ref={ref} type={type} className={fieldClass(invalid, className)} {...rest} />;
});

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, invalid, ...rest },
  ref,
) {
  return <textarea ref={ref} className={fieldClass(invalid, className)} {...rest} />;
});
