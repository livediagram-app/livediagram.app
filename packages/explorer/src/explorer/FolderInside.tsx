'use client';

// What a folder holds, at a glance (liveworkspace/docs/specs/004-index/one-explorer.md "What a folder holds, at a
// glance", Work Tracker 1517): a small stack of the apps' logos with items anywhere inside it, a stacked glyph when
// it holds folders, and a muted outline when it holds nothing at all. One part for the Explorer's cards, its list
// and Details rows and the editors' panel, so they never drift. The counts are the index's (`apps` on the folder
// previews the cards already ask for), counted for folders the person reaches, so nothing hints at what they can't open.

import { useMemo, type CSSProperties } from 'react';
import { BrandGlyph } from '@liveworkspace/brand';
import { APPS, FOLDER_PREVIEW_COUNT_CAP, type App, type Folder } from '@liveworkspace/index-client';
import { HoverCard } from '@liveworkspace/ui';
import type { ShownFolderPreview } from '../data/useFolderPreviews';
import { FolderOutlineIcon, FolderSolidIcon, FolderLayersIcon } from '../ui/icons';
import { kindWords, siteOf } from '../words';
import { useExplorer } from './context';

// Three logos, then "+N": past three a stack stops being read at a glance.
const SHOWN = 3;

export type FolderInsideCounts = {
  // Each app with items anywhere inside, the host's first, then by count; empty while unknown.
  apps: [App, number][];
  // Items inside at any depth, every app's (or this app's and the other apps' own, from an index without `apps`).
  items: number;
  // Folders directly inside.
  folders: number;
  // The count reached the index's cap: "at least".
  capped: boolean;
  // Nothing inside at all; null until the index has said.
  empty: boolean | null;
};

/** What a folder holds, from its preview and its subfolders. */
export function folderInside(
  preview: ShownFolderPreview | undefined,
  folders: number,
  host: App,
): FolderInsideCounts {
  if (!preview)
    return { apps: [], items: 0, folders, capped: false, empty: folders ? false : null };
  const apps: [App, number][] = preview.apps
    ? (Object.entries(preview.apps) as [App, number][])
        .filter(([, n]) => n > 0)
        .sort(
          ([a, n], [b, m]) =>
            Number(b === host) - Number(a === host) || m - n || APPS.indexOf(a) - APPS.indexOf(b),
        )
    : [];
  // An index from before `apps` says only what is directly inside: what the filter shows, and the other apps' own.
  const items = preview.apps
    ? apps.reduce((sum, [, n]) => sum + n, 0)
    : preview.itemCount + (preview.elsewhere?.itemCount ?? 0);
  return {
    apps,
    items,
    folders,
    capped: items >= FOLDER_PREVIEW_COUNT_CAP,
    empty: items === 0 && folders === 0,
  };
}

/** What this folder holds, its subfolders from the folders already loaded, the host's logo first. */
export function useFolderInside(folder: Folder, preview: ShownFolderPreview | undefined) {
  const { folders, app } = useExplorer();
  const sub = folders.childrenOf(folder.id, folder.teamId).length;
  return useMemo(() => folderInside(preview, sub, app), [preview, sub, app]);
}

/** "3 canvases, 1 document and 2 folders"; "at least …" once the count reaches the cap; "Empty". */
export function insidePhrase(inside: FolderInsideCounts): string {
  const parts = inside.apps.map(([app, n]) => {
    const w = kindWords(app);
    return `${n} ${n === 1 ? w.lowerOne : w.lowerMany}`;
  });
  if (inside.folders)
    parts.push(`${inside.folders} ${inside.folders === 1 ? 'folder' : 'folders'}`);
  if (!parts.length) return 'Empty';
  const list =
    parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]!;
  return inside.capped ? `At least ${list}` : list;
}

// The disc sizes: a card's, the panel card's, a row's. The glyph fills most of its disc, so it reads at a glance.
const DISC = {
  card: 'size-[22px] [&_svg]:size-3.5',
  pane: 'size-[18px] [&_svg]:size-3',
  row: 'size-[18px] [&_svg]:size-3',
} as const;
const MORE = {
  card: 'h-[22px] min-w-[26px] pl-2 pr-1.5 text-[10px]',
  pane: 'h-[18px] min-w-[22px] pl-1.5 pr-1 text-[9px]',
  row: 'h-[18px] min-w-[22px] pl-1.5 pr-1 text-[9px]',
} as const;
// On a card or the panel's card the stack sits over the picture, so it rides on a small pill of the card's own colour;
// in a row it sits on the row itself.
const TRAY = {
  card: 'rounded-full bg-white/95 p-[3px] shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800/95 dark:ring-slate-600/70',
  pane: 'rounded-full bg-white/95 p-0.5 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800/95 dark:ring-slate-600/70',
  row: '',
} as const;
// A thin ring the colour of the card behind, so overlapping discs read as separate coins.
const RING = 'ring-[1.5px] ring-white dark:ring-slate-800';

export type BadgeSize = keyof typeof DISC;

/** The apps' logos, overlapping, three at most then "+N", naming what is inside on hover, focus or a long press. */
export function FolderAppBadges({
  inside,
  size,
  className,
}: {
  inside: FolderInsideCounts;
  size: BadgeSize;
  className?: string;
}) {
  if (!inside.apps.length) return null;
  const shown = inside.apps.slice(0, SHOWN);
  const more = inside.apps.length - shown.length;
  const phrase = insidePhrase(inside);
  return (
    <HoverCard
      title={phrase}
      description={inside.folders ? 'Counted through every folder inside.' : undefined}
      pressWithText
      className={className}
    >
      <span
        role="img"
        aria-label={phrase}
        data-folder-apps={inside.apps.map(([app]) => app).join(' ')}
        className={`flex items-center ${TRAY[size]}`}
      >
        {shown.map(([app], i) => (
          <span
            key={app}
            data-folder-app={app}
            style={{ color: siteOf(app).accent, zIndex: SHOWN - i } as CSSProperties}
            className={`relative flex shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900 ${RING} ${DISC[size]} ${i ? '-ml-1.5' : ''}`}
          >
            <BrandGlyph />
          </span>
        ))}
        {more > 0 ? (
          <span
            data-folder-apps-more={more}
            className={`relative -ml-1.5 flex shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold tabular-nums leading-none text-slate-700 dark:bg-slate-700 dark:text-slate-200 ${RING} ${MORE[size]}`}
          >
            {`+${more}`}
          </span>
        ) : null}
      </span>
    </HoverCard>
  );
}

/** The folder's glyph: stacked when it holds folders, a muted outline when it holds nothing, else the solid one. */
export function FolderGlyph({
  inside,
  size = 13,
  tone = 'text-amber-500',
}: {
  inside: Pick<FolderInsideCounts, 'folders' | 'empty'>;
  size?: number;
  // The colour of a folder with something in it (the panel's card wears its brand).
  tone?: string;
}) {
  if (inside.folders > 0)
    return (
      <span data-folder-glyph="stack" className={`inline-flex ${tone}`}>
        <FolderLayersIcon size={size} />
      </span>
    );
  if (inside.empty)
    return (
      <span data-folder-glyph="empty" className="inline-flex text-slate-400 dark:text-slate-500">
        <FolderOutlineIcon size={size} />
      </span>
    );
  return (
    <span data-folder-glyph="folder" className={`inline-flex ${tone}`}>
      <FolderSolidIcon size={size} />
    </span>
  );
}

/** A card's picture for a folder with nothing in it: the outline, muted, and a quiet "Empty". */
export function FolderEmpty({ compact = false }: { compact?: boolean }) {
  return (
    <span
      data-folder-empty=""
      className="flex flex-col items-center justify-center gap-1.5 text-slate-300 dark:text-slate-600"
    >
      <FolderOutlineIcon size={compact ? 28 : 44} />
      <span
        className={`font-medium text-slate-500 dark:text-slate-400 ${compact ? 'text-[10px]' : 'text-xs'}`}
      >
        Empty
      </span>
    </span>
  );
}
