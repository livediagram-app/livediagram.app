// A text answer's box as respondents see it (docs/specs/030-forms/forms.md "Question types"): its classes, settled
// and when the answer is wrong. QuestionControl and its choice and range answers draw with them.

export const FIELD =
  'form-box w-full rounded-lg border bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--form-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--form-accent)_30%,transparent)] disabled:cursor-not-allowed disabled:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:disabled:bg-slate-900/60';
export const FIELD_OK = 'form-ink border-slate-300 dark:border-slate-600';
// A text answer's box as respondents see it, for the builder's placeholder field to wear the same.
export const ANSWER_FIELD = `${FIELD} ${FIELD_OK}`;
export const FIELD_BAD = 'border-red-500 dark:border-red-400';
