'use client';

// Sprint Review's feedback box above the action bar (docs/specs/026-plan/session-tabs.md "Sprint Review"): one text
// box and Add Feedback, saving the text as a Review Feedback comment on the real card, with how many the card holds
// beside it. Enter adds, Shift+Enter a new line. For whoever may comment; a Viewer sees the count alone. Stand-up's
// comment strip is the same strip in its own words, with no count (a Viewer then sees nothing).
import { useRef, useState } from 'react';
import { useAutoHeight } from '@liveworkspace/workbench/hooks/ui/useAutoHeight';
import { THREAD_COMMENT_TEXT_MAX } from '@liveplanner/project';

const HEADING =
  'shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
// The box grows with its text up to about four lines.
const BOX_MAX_PX = 96;

// What the strip says: its heading, the box's hint ({ref} the card's number) and name, and its button (in full, and
// short on a phone).
export type StripWords = {
  heading: string;
  placeholder: string;
  name: string;
  add: string;
  addShort: string;
};
const FEEDBACK_WORDS: StripWords = {
  heading: 'Feedback',
  placeholder: 'What did the room think?',
  name: 'Feedback on',
  add: 'Add Feedback',
  addShort: 'Add',
};

export function FeedbackStrip({
  cardRef,
  count,
  canAdd,
  onAdd,
  words = FEEDBACK_WORDS,
}: {
  // The card's number as people see it ("WI-47"), for the box's name.
  cardRef: string;
  // How many Review Feedback comments the card holds; absent: no count.
  count?: number;
  words?: StripWords;
  canAdd: boolean;
  // Saves the text; whether it was kept (the box empties only then).
  onAdd: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  useAutoHeight(box, text, { px: BOX_MAX_PX });
  const countWords = count ? `${count} so far` : 'None yet';
  const add = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const kept = await onAdd(text);
    setBusy(false);
    if (kept) setText('');
  };
  if (!canAdd && count === undefined) return null;
  return (
    <div
      data-feedback-strip=""
      data-strip-words={words.heading}
      className="flex shrink-0 items-start gap-3 border-t border-slate-200 bg-white px-4 py-2.5 sm:px-6 xl:pr-[20rem] dark:border-slate-800 dark:bg-slate-900"
    >
      {canAdd ? (
        <>
          <span className={`${HEADING} mt-2.5 max-sm:hidden`}>{words.heading}</span>
          <textarea
            ref={box}
            rows={1}
            value={text}
            maxLength={THREAD_COMMENT_TEXT_MAX}
            aria-label={`${words.name} ${cardRef}`}
            placeholder={words.placeholder.replace('{ref}', cardRef)}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void add();
              }
            }}
            className="min-h-9 min-w-0 flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-500 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={!text.trim() || busy}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-default disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="max-sm:hidden">{words.add}</span>
            <span className="sm:hidden">{words.addShort}</span>
          </button>
        </>
      ) : null}
      {count === undefined ? null : (
        <span
          role="status"
          data-feedback-count={count}
          className={`shrink-0 text-[12px] text-slate-500 dark:text-slate-400 ${canAdd ? 'mt-2.5' : 'py-1'}`}
        >
          {canAdd ? countWords : `Feedback: ${countWords.toLowerCase()}`}
        </span>
      )}
    </div>
  );
}
