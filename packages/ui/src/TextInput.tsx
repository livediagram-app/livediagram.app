import { forwardRef, type InputHTMLAttributes } from 'react';

// The shared single-line text input. The blessed focus treatment —
// brand border + a 2px brand ring — was applied inconsistently: some
// inputs (TeamFormModal) had it, others (ShareDialog's link-name field)
// only changed the border and skipped the ring, so focus read
// differently field to field. This bakes the full treatment in once.
//
// `w-full` is the default because every current call site is a
// block-level field; pass `className` to add layout (mt-…) or override
// width. All native input props (value, onChange, placeholder,
// maxLength, ref, …) pass through, so it's a drop-in for a raw <input>.

const BASE =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, type = 'text', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={`${BASE}${className ? ` ${className}` : ''}`}
      {...rest}
    />
  );
});
