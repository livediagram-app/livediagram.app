'use client';

// One document of Jump Back In on a desktop or tablet (docs/specs/013-workspace/explorer-home.md "Jump Back In"): a
// card with its snapshot thumbnail, its name and the quiet line that says why it is there. Large for a most used
// document (the thumbnail over the words), compact for a recent one (the thumbnail beside them). One link named by
// the document (plus Local Only for one stored here), the quiet line its description. No tooltip: the name is
// already written under the picture.
// The phone's strip keeps JumpBackInTile.

import { useId } from 'react';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { LocalOnlyPill, LOCAL_ONLY_LABEL } from '@/components/primitives/LocalOnlyPill';
import { track } from '@/lib/telemetry';
import {
  jumpBackInLine,
  type JumpBackInGroup,
  type JumpBackInItem,
} from '@/app/explorer/home/home-model';
import {
  CARD_SURFACE,
  COMPACT_CARD,
  COMPACT_THUMB,
  FOCUS_RING,
  LARGE_CARD,
  LARGE_THUMB,
  MUTED,
} from './home-styles';

const THUMB_EDGE = 'border border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-900';

export function JumpBackInCard({
  ownerId,
  item,
  group,
  now,
}: {
  ownerId: string;
  item: JumpBackInItem;
  /** Most Used draws a large card, recent a compact one. */
  group: JumpBackInGroup;
  /** The page's shared instant, so every card's relative time agrees. */
  now: number;
}) {
  const lineId = useId();
  const large = group === 'mostUsed';
  const thumb = (
    <span className={`relative block ${large ? 'w-full' : 'shrink-0'}`}>
      <DocumentThumbnail
        ownerId={ownerId}
        documentId={item.documentId}
        version={item.savedAt}
        shareCode={item.shareCode}
        offline={item.localOnly}
        empty={item.empty}
        className={`${large ? `${LARGE_THUMB} rounded-xl` : `${COMPACT_THUMB} rounded-lg`} ${THUMB_EDGE}`}
      />
      {item.localOnly ? (
        <span className="absolute bottom-1 left-1">
          <LocalOnlyPill asLabel />
        </span>
      ) : null}
    </span>
  );
  const words = (
    <span className={`flex min-w-0 flex-col gap-0.5 ${large ? 'px-1' : ''}`}>
      <span
        className={`block truncate font-semibold text-[#17153a] dark:text-slate-100 ${
          large ? 'text-[15px] leading-5' : 'text-sm leading-5'
        }`}
      >
        {item.name}
      </span>
      <span
        id={lineId}
        className={`block truncate leading-[18px] ${large ? 'text-[12.5px]' : 'text-xs'} ${MUTED}`}
      >
        {jumpBackInLine(item, group, now)}
      </span>
    </span>
  );
  return (
    <a
      href={item.href}
      aria-label={item.localOnly ? `${item.name}, ${LOCAL_ONLY_LABEL}` : item.name}
      aria-describedby={lineId}
      data-jump-back-in-card={large ? 'large' : 'compact'}
      onClick={() =>
        large
          ? track('Home', 'Selected', 'JumpBackIn.MostUsed')
          : track('Home', 'Selected', 'JumpBackIn.Recent')
      }
      className={`flex min-w-0 ${
        large
          ? `${LARGE_CARD} flex-col gap-2.5 rounded-[18px] p-2 pb-3`
          : `${COMPACT_CARD} items-center gap-3 rounded-[14px] p-2`
      } ${CARD_SURFACE} ${FOCUS_RING}`}
    >
      {thumb}
      {words}
    </a>
  );
}
