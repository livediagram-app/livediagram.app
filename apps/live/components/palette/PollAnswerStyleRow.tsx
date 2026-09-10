'use client';

// How a Session button's poll asks its question (spec/105, spec/88): Yes / No,
// + Abstain, the answers you write, a 1-5 rating, or free text.
//
// Its own component because BOTH places you can configure a poll button need
// it — the right-click menu's Session section and the button's own `…` menu —
// and they must offer the same five answers in the same words, or the same
// button would describe itself two ways depending on how you opened it.
//
// Each row shows the style's name AND the answers it produces, following the
// estimate card's scale picker: the name of a shape is not the thing being
// chosen between, "Yes  No  Abstain" is. `choice` is the exception — its
// answers are the list you write underneath, so it says so instead of
// previewing whatever is in the box at that moment.

import {
  POLL_STYLES,
  POLL_STYLE_LABEL,
  pollStyleTokens,
  type PollStyle,
} from '@livediagram/diagram';

const PREVIEW: Record<PollStyle, string> = {
  yesNo: pollStyleTokens('yesNo').join('  '),
  yesNoAbstain: pollStyleTokens('yesNoAbstain').join('  '),
  choice: 'The answers you write',
  rating: pollStyleTokens('rating').join('  '),
  text: 'Whatever people type',
};

export function PollAnswerStyleRow({
  style,
  onChange,
}: {
  style: PollStyle;
  onChange: (next: PollStyle) => void;
}) {
  return (
    <div className="flex flex-col gap-1 px-3 pt-2">
      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Answers</span>
      {POLL_STYLES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={style === option}
          className={`flex cursor-pointer flex-col items-start rounded-md border px-2 py-1 text-left transition ${
            style === option
              ? 'border-brand-400 bg-brand-50 dark:border-brand-500/60 dark:bg-brand-500/15'
              : 'border-slate-200 bg-white hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800'
          }`}
        >
          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
            {POLL_STYLE_LABEL[option]}
          </span>
          <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">
            {PREVIEW[option]}
          </span>
        </button>
      ))}
    </div>
  );
}
