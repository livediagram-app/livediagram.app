'use client';

// The default marker: after a folder's name, a pin when the folder is one of the reader's default folders, with
// how many entries it holds when more than one. Its words ("Default folder for new plans") are its tooltip and a
// visually hidden line, so the meaning is never the shape alone. It sits after a truncating name, in space the row
// already holds, so its arrival once the defaults load moves nothing.

import { memo } from 'react';
import { DefaultPinIcon } from '../ui/icons';
import { useOptionalExplorer } from '../explorer/context';
import { defaultFolderDescription, folderDefaultEntries } from './entries';

export const DefaultFolderMarker = memo(function DefaultFolderMarker({
  folderId,
}: {
  folderId: string;
}) {
  const ctx = useOptionalExplorer();
  if (!ctx) return null;
  const held = folderDefaultEntries(folderId, ctx.defaults.defaults, ctx.defaultEntries);
  if (held.length === 0) return null;
  const description = defaultFolderDescription(held);
  return (
    <span
      data-default-marker=""
      title={description}
      className="inline-flex shrink-0 items-center gap-0.5 text-slate-500 dark:text-slate-400"
    >
      <span aria-hidden className="inline-flex items-center gap-0.5">
        <DefaultPinIcon size={12} />
        {held.length > 1 ? (
          <span className="text-[10px] font-semibold leading-none">{held.length}</span>
        ) : null}
      </span>
      <span className="sr-only">{description}</span>
    </span>
  );
});
