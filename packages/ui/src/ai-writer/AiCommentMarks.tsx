'use client';

// The marks an assistant's comment wears beside its name, the same in the Inbox and in every app's own thread
// (liveworkspace/docs/specs/004-index/inbox-reading.md "AI comments"): an AI chip, "for <person>" when it wrote for
// someone, and "Asks for a response" when it flagged needsResponse. The name beside them is the assistant's.
import type { HTMLAttributes } from 'react';
import { Glyph } from '../icons/Glyph';
import { Tooltip } from '../Tooltip';

type DataProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'className' | 'title'>;

/** A speech bubble with a question mark (lucide message-circle-question): an ask for an answer. */
export function AskGlyph({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <Glyph size={size} units={24} className={className}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </Glyph>
  );
}

/** The AI chip; `forYou` adds "for you" (the Inbox, when the assistant wrote for the reader). */
export function AiChip({ forYou = false, ...rest }: { forYou?: boolean } & DataProps) {
  return (
    <Tooltip label={forYou ? 'Written by an AI assistant for you' : 'Written by an AI assistant'}>
      <span
        data-ai-chip=""
        {...rest}
        className="inline-flex shrink-0 items-center gap-1 self-center rounded-md bg-violet-50 px-1.5 text-[10px] font-semibold leading-4 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-500/30"
      >
        AI
        {forYou ? <span className="font-medium">for you</span> : null}
      </span>
    </Tooltip>
  );
}

/** "Asks for a response", on a comment its assistant flagged needsResponse. */
export function AsksForResponse(rest: DataProps) {
  return (
    <span
      data-ai-asks=""
      {...rest}
      className="inline-flex shrink-0 items-center gap-1 font-medium text-violet-700 dark:text-violet-300"
    >
      <AskGlyph size={12} />
      Asks for a response
    </span>
  );
}

/** The marks after an assistant's name in a thread: the chip, whom it wrote for, and its ask. */
export function AiCommentMarks({
  forName,
  needsResponse,
}: {
  /** The person the assistant wrote for (the token's owner); left out when it is the reader. */
  forName?: string;
  needsResponse?: boolean;
}) {
  return (
    <>
      <AiChip />
      {forName ? (
        <span className="min-w-0 truncate text-slate-500 dark:text-slate-400">for {forName}</span>
      ) : null}
      {needsResponse ? <AsksForResponse /> : null}
    </>
  );
}
