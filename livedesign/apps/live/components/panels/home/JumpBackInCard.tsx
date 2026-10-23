'use client';

// One design of Jump Back In on a desktop or tablet (docs/specs/013-workspace/explorer-home.md "Jump Back In"): a
// card with its snapshot thumbnail, its name and the quiet line that says why it is there. Large for a most used
// design (the thumbnail over the words), compact for a recent one (the thumbnail beside them). One link named by
// the design (plus This Browser for one stored here), the quiet line its description. No tooltip: the name is
// already written under the picture. Beside the link, the design's ⋯ menu (JumpBackInMenu) when the Explorer has it.
// The phone's strip keeps JumpBackInTile.

import { useId } from 'react';
import { DesignThumbnail } from '@/components/panels/DesignThumbnail';
import { ThisBrowserPill, THIS_BROWSER_LABEL } from '@/components/primitives/ThisBrowserPill';
import { track } from '@/lib/telemetry';
import type { DesignEntryProps } from '@/app/explorer/explorer-view-props';
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
import { JumpBackInMenu, JumpBackInRename } from './JumpBackInMenu';

const THUMB_EDGE = 'border border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-900';
const RENAME_INPUT =
  'w-full min-w-0 rounded border border-brand-300 bg-white px-1 py-0 font-semibold text-slate-900 dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100';

export function JumpBackInCard({
  ownerId,
  item,
  group,
  now,
  entry = null,
}: {
  ownerId: string;
  item: JumpBackInItem;
  /** Most Used draws a large card, recent a compact one. */
  group: JumpBackInGroup;
  /** The page's shared instant, so every card's relative time agrees. */
  now: number;
  /** The design's Explorer menu, or null when the Explorer has not loaded it (no ⋯). */
  entry?: DesignEntryProps | null;
}) {
  const lineId = useId();
  const large = group === 'mostUsed';
  // The Explorer's own name once it has the design, so a rename from the menu shows at once.
  const name = entry?.design.name ?? item.name;
  const renaming = entry?.renaming === true;
  const thumb = (
    <span className={`relative block ${large ? 'w-full' : 'shrink-0'}`}>
      <DesignThumbnail
        ownerId={ownerId}
        designId={item.designId}
        version={item.savedAt}
        shareCode={item.shareCode}
        offline={item.localOnly}
        empty={item.empty}
        className={`${large ? `${LARGE_THUMB} rounded-xl` : `${COMPACT_THUMB} rounded-lg`} ${THUMB_EDGE}`}
      />
      {item.localOnly ? (
        <span className="absolute bottom-1 left-1">
          <ThisBrowserPill asLabel />
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
        {renaming && entry ? (
          <JumpBackInRename
            entry={entry}
            className={`${RENAME_INPUT} ${large ? 'text-[15px] leading-5' : 'text-sm leading-5'}`}
          />
        ) : (
          name
        )}
      </span>
      <span
        id={lineId}
        className={`block truncate leading-[18px] ${large ? 'text-[12.5px]' : 'text-xs'} ${MUTED}`}
      >
        {jumpBackInLine(item, group, now)}
      </span>
    </span>
  );
  const cardClass = `flex min-w-0 ${
    large
      ? `${LARGE_CARD} flex-col gap-2.5 rounded-[18px] p-2 pb-3`
      : `${COMPACT_CARD} items-center gap-3 rounded-[14px] p-2 ${entry ? 'pr-11' : ''}`
  } ${CARD_SURFACE} ${FOCUS_RING}`;
  return (
    <JumpBackInMenu
      entry={entry}
      name={name}
      buttonClassName={large ? 'right-3.5 top-3.5' : 'right-2.5 top-1/2 -translate-y-1/2'}
    >
      {renaming ? (
        // While renaming the card doesn't open: the field keeps its focus and its clicks.
        <div data-jump-back-in-card={large ? 'large' : 'compact'} className={cardClass}>
          {thumb}
          {words}
        </div>
      ) : (
        <a
          href={item.href}
          aria-label={item.localOnly ? `${name}, ${THIS_BROWSER_LABEL}` : name}
          aria-describedby={lineId}
          data-jump-back-in-card={large ? 'large' : 'compact'}
          onClick={() =>
            large
              ? track('Home', 'Selected', 'JumpBackIn.MostUsed')
              : track('Home', 'Selected', 'JumpBackIn.Recent')
          }
          className={cardClass}
        >
          {thumb}
          {words}
        </a>
      )}
    </JumpBackInMenu>
  );
}
