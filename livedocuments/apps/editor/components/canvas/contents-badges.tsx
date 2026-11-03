// A Contents row's marks of livedocuments' own (docs/specs/007-editor/pages-mode.md "Contents"), after the
// page's name in both of Contents' homes: a card's speaking time (docs/specs/007-editor/flashcards.md "Card
// number and speaking time") and a crossed eye on a page hidden in Slides.
import { lucideEyeOff } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedocuments/ui';
import type { ContentsRow } from '@/lib/page-contents';

const HiddenIcon = lucideGlyph(lucideEyeOff, 12);

export function contentsBadges(row: ContentsRow) {
  if (!row.speakingTime && !row.hiddenInSlides) return null;
  return (
    <>
      {row.speakingTime ? (
        <span
          data-contents-speaking-time=""
          className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400"
        >
          {row.speakingTime}
        </span>
      ) : null}
      {row.hiddenInSlides ? (
        <span
          role="img"
          className="shrink-0 text-slate-400"
          aria-label="Hidden in Slides"
          data-contents-hidden=""
        >
          <HiddenIcon />
        </span>
      ) : null}
    </>
  );
}
