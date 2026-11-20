// How much of a text answer's limit is used (docs/specs/030-forms/forms.md "Filling in a form", The limit on a text
// answer): nothing until the answer nears it, then the count, and at the limit a line saying nothing more is kept,
// since the box stops taking keys there and cuts a paste short without a word.

// The share of its limit an answer reaches before the count shows. Safe range 0.5..0.95.
export const COUNT_FROM = 0.8;

const count = (n: number) => n.toLocaleString('en-GB');

// The line under the box: null while the answer is well short of its limit.
export function characterCountText(length: number, max: number): string | null {
  if (length < Math.ceil(max * COUNT_FROM)) return null;
  return length >= max
    ? `${count(max)} of ${count(max)} characters: nothing more is kept`
    : `${count(length)} of ${count(max)} characters`;
}

export function CharacterCount({ length, max }: { length: number; max: number }) {
  const text = characterCountText(length, max);
  const full = length >= max;
  return (
    <>
      {text ? (
        <p
          aria-hidden
          className={`mt-1.5 text-right text-[13px] tabular-nums ${
            full
              ? 'font-medium text-amber-700 dark:text-amber-300'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {text}
        </p>
      ) : null}
      {/* Read out once, at the limit: a count spoken at every key would talk over the typing. Always in the page, so
          the words arriving are an update a screen reader hears. */}
      <p role="status" className="sr-only">
        {full ? `Character limit reached: ${count(max)} characters. Nothing more is kept.` : ''}
      </p>
    </>
  );
}
