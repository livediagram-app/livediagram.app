'use client';

import { useId } from 'react';
import { HoverCard } from '@livediagram/ui';
import { ThisBrowserIcon } from '@/components/primitives/explorer-icons';
import { helpArticleHref } from '@/lib/help-articles';
import { trackHelpArticle } from '@/components/primitives/HelpArticleLink';

// The Local only pill (docs/specs/006-document/offline-mode.md#local-only-pill): every row and
// card of a document saved only in this browser carries it. An icon and words, never colour
// alone; what it means on hover, on focus and to a screen reader; and a link to the Offline
// Mode guide. Inside a single control (a search result) it is a plain label carrying the same
// sentence, since a link cannot sit inside a button.

export const LOCAL_ONLY_LABEL = 'Local only';
export const LOCAL_ONLY_DESCRIPTION =
  "Lives only in this browser. Clearing this browser's site data deletes it.";

// Amber, the offline tone: the words meet 4.5:1 on the fill, the ring 3:1 against the row. Shared
// with the editor header's Local only badge.
export const LOCAL_ONLY_TONE =
  'bg-amber-50 text-amber-800 ring-1 ring-amber-600 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400';
const PILL = `optical-edges inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold leading-4 ${LOCAL_ONLY_TONE}`;

export function LocalOnlyPill({
  asLabel = false,
  tabbable = true,
}: {
  // Inside a single control: a label, not a link.
  asLabel?: boolean;
  // False inside a tree, which owns the one tab stop; the row carries the description.
  tabbable?: boolean;
}) {
  const descriptionId = useId();
  const face = (
    <>
      <ThisBrowserIcon size={10} />
      <span className="text-optical-line">{LOCAL_ONLY_LABEL}</span>
    </>
  );
  if (asLabel) {
    return (
      <HoverCard title={LOCAL_ONLY_LABEL} description={LOCAL_ONLY_DESCRIPTION}>
        <span className={PILL}>
          {face}
          <span className="sr-only">{LOCAL_ONLY_DESCRIPTION}</span>
        </span>
      </HoverCard>
    );
  }
  return (
    <HoverCard title={LOCAL_ONLY_LABEL} description={LOCAL_ONLY_DESCRIPTION}>
      <a
        href={helpArticleHref('offlineMode')}
        target="_blank"
        rel="noreferrer noopener"
        tabIndex={tabbable ? undefined : -1}
        aria-describedby={descriptionId}
        onClick={(e) => {
          // The row beneath opens its document; this opens the guide instead.
          e.stopPropagation();
          trackHelpArticle('offlineMode');
        }}
        className={`${PILL} transition hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-amber-500/25`}
      >
        {face}
      </a>
      <span id={descriptionId} className="sr-only">
        {LOCAL_ONLY_DESCRIPTION}
      </span>
    </HoverCard>
  );
}
