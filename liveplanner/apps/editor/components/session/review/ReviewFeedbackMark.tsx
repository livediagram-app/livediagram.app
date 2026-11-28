'use client';

// The Review Feedback chip above a comment left in a Sprint Review session (docs/specs/026-plan/items.md "Review
// Feedback"): drawn wherever a card's thread is, so the feedback reads as such on the card itself. Light: a card
// thread's rows import it, so it holds nothing of the session page's.
import { lucideGlyph } from '@liveplanner/ui';
import { lucidePresentation } from '@liveworkspace/icons/lucide';

const ReviewIcon = lucideGlyph(lucidePresentation, 11);

export function ReviewFeedbackMark() {
  return (
    <span
      data-comment-review=""
      className="mt-0.5 flex w-fit items-center gap-1 rounded-full bg-sky-50 px-1.5 py-px text-[10px] font-medium text-sky-800 dark:bg-sky-500/15 dark:text-sky-200"
    >
      <ReviewIcon aria-hidden />
      <span className="text-optical-line">Review Feedback</span>
    </span>
  );
}
