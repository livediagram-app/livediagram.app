'use client';

import { Tooltip } from '@livediagram/ui';
import { useFolderDefaultKeys } from '@/hooks/persistence/usePlacementDefaults';
import { defaultFolderDescription } from '@/lib/placement-defaults/default-key-entries';
import { DefaultKeyIcon } from './default-key-icons';

// The default marker (docs/specs/013-workspace/default-folders.md "The default marker"): after a
// folder's name, the icons of the keys it is the reader's default for, two at most, then "+N". Its
// words ("Default folder for new whiteboards") are its tooltip and, unless the host carries them
// itself (a tree row's description), a visually hidden line, so the meaning is never colour or
// shape alone. It takes space the row already holds (after a truncating name), so its arrival once
// the defaults load moves nothing.

export const MARKER_MAX_ICONS = 2;

/** The marker's words for a folder, or '' when it is no default: a tree row's description. */
export function useDefaultFolderDescription(folderId: string): string {
  return defaultFolderDescription(useFolderDefaultKeys(folderId));
}

export function DefaultFolderMarker({
  folderId,
  withWords = true,
}: {
  folderId: string;
  /** False where the host announces the words itself (SidebarRow's description). */
  withWords?: boolean;
}) {
  const keys = useFolderDefaultKeys(folderId);
  if (keys.length === 0) return null;
  const description = defaultFolderDescription(keys);
  const shown = keys.slice(0, MARKER_MAX_ICONS);
  const more = keys.length - shown.length;
  return (
    <>
      <Tooltip label={description}>
        <span
          data-default-marker=""
          aria-hidden
          aria-label={description}
          className="inline-flex shrink-0 items-center gap-0.5 text-slate-500 dark:text-slate-400"
        >
          {shown.map((key) => (
            <DefaultKeyIcon key={key} entryKey={key} size={12} />
          ))}
          {more > 0 ? (
            <span className="text-[10px] font-semibold leading-none">+{more}</span>
          ) : null}
        </span>
      </Tooltip>
      {withWords ? <span className="sr-only">{description}</span> : null}
    </>
  );
}
