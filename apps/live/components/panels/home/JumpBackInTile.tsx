'use client';

// One document of Jump back in (docs/specs/013-workspace/explorer-home.md "Jump back in"): its
// snapshot thumbnail with its name below, one link named by the document (plus Local only for one
// stored here), the full name as its tooltip. Grid and strip draw the same tile at their own size.
// Which half of the set it came from is tracked, never shown (Calm by default). The strip ends in
// the See more tile, the same size as a thumbnail.

import { ChevronRightIcon, Tooltip } from '@livediagram/ui';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { LocalOnlyPill, LOCAL_ONLY_LABEL } from '@/components/primitives/LocalOnlyPill';
import { track } from '@/lib/telemetry';
import { HOME_COPY } from '@/app/explorer/home/home-copy';
import type { JumpBackInGroup, JumpBackInItem } from '@/app/explorer/home/home-model';
import { InAppLink } from './HomeSection';
import { FOCUS_RING, STRIP_THUMB } from './home-styles';

const THUMB_BOX =
  'rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800';

export function JumpBackInTile({
  ownerId,
  item,
  group,
  thumbClassName,
}: {
  ownerId: string;
  item: JumpBackInItem;
  group: JumpBackInGroup;
  /** The thumbnail's size: the grid's share of the width, or the strip's 128 × 80. */
  thumbClassName: string;
}) {
  return (
    <Tooltip label={item.name}>
      <a
        href={item.href}
        aria-label={item.localOnly ? `${item.name}, ${LOCAL_ONLY_LABEL}` : item.name}
        onClick={() =>
          group === 'mostUsed'
            ? track('Home', 'Selected', 'JumpBackIn.MostUsed')
            : track('Home', 'Selected', 'JumpBackIn.Recent')
        }
        className={`group block min-w-0 rounded-md ${FOCUS_RING}`}
      >
        <span className="relative block">
          <DocumentThumbnail
            ownerId={ownerId}
            documentId={item.documentId}
            version={item.savedAt}
            shareCode={item.shareCode}
            offline={item.localOnly}
            empty={item.empty}
            className={`${thumbClassName} ${THUMB_BOX} transition group-hover:border-slate-300 dark:group-hover:border-slate-500`}
          />
          {item.localOnly ? (
            <span className="absolute bottom-1 left-1">
              <LocalOnlyPill asLabel />
            </span>
          ) : null}
        </span>
        <span className="mt-1 block h-4 truncate text-xs leading-4 text-slate-700 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-slate-100">
          {item.name}
        </span>
      </a>
    </Tooltip>
  );
}

/** The phone strip's last tile: a thumbnail-sized way to the Recent page. */
export function SeeMoreTile({ href, onSeeMore }: { href: string; onSeeMore: () => void }) {
  return (
    <InAppLink
      href={href}
      onNavigate={onSeeMore}
      onActivate={() => track('Home', 'Selected', 'JumpBackIn.SeeMore')}
      className={`group block shrink-0 rounded-md ${FOCUS_RING}`}
    >
      <span
        className={`${STRIP_THUMB} flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 text-xs font-medium text-brand-700 transition group-hover:border-slate-400 group-hover:bg-slate-100 dark:border-slate-600 dark:text-brand-300 dark:group-hover:border-slate-500 dark:group-hover:bg-slate-800/70`}
      >
        <ChevronRightIcon size={16} />
        {HOME_COPY.seeMore}
      </span>
    </InAppLink>
  );
}
