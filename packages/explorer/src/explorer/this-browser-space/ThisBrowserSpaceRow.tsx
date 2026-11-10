'use client';

// This Browser's row in the sidebar's Spaces group (one-explorer.md "This Browser, a Space"): after My Work and the
// teams, shown while this browser holds a live item or a local folder (or while its view is open, so the highlight
// never vanishes), with the count of live items and its folders below it, nested as My Work's are. Each row takes a
// This Browser item dropped on it (the root, or that folder), carries its menu and renames in place.

import { useLayoutEffect } from 'react';
import { localChildren, localPath, type ThisBrowserFolder } from '../../this-browser';
import { FolderSolidIcon } from '../../ui/icons';
import { EllipsisTriggerButton, useRowMenu } from '../../ui/RowMenu';
import { InlineRenameInput } from '../../ui/InlineRenameInput';
import { SIDEBAR_LABELS } from '../../views';
import { useExplorer } from '../context';
import { BrowserIcon } from '../host';
import { SIDEBAR_RENAME_FIELD, SidebarRow } from '../Sidebar';
import { LocalFolderMenu, ThisBrowserSpaceMenu } from './LocalFolderMenu';
import { LOCAL_ROW_KEY, localKey, useRenameLocalFolder, useThisBrowserSpace } from './space';

type Rename = { renamingId: string | null; setRenamingId: (id: string | null) => void };

export function ThisBrowserSpaceRow({
  expanded,
  toggle,
  rename,
}: {
  expanded: ReadonlySet<string>;
  toggle: (key: string) => void;
  rename: Rename;
}) {
  const { view, navigate, expansion } = useExplorer();
  const { live, folders, holds, readable } = useThisBrowserSpace();
  const menu = useRowMenu();
  const onView = view.kind === 'offline';
  const open = onView ? (view.folder ?? null) : null;
  // The current local folder's rows are open: This Browser's, and each folder down to it (itself too).
  const path = localPath(folders, open)
    .map((f) => localKey(f.id))
    .join('\n');
  useLayoutEffect(() => {
    if (onView) expansion.expand(LOCAL_ROW_KEY, ...(path ? path.split('\n') : []));
  }, [onView, path, expansion]);
  if (!readable || (!holds && !onView)) return null;
  const roots = localChildren(folders, null);
  return (
    <SidebarRow
      icon={<BrowserIcon />}
      tone="teal"
      label={SIDEBAR_LABELS.thisBrowser}
      selected={onView && open === null}
      onActivate={() => navigate({ kind: 'offline' })}
      depth={0}
      dropTo={{ local: null }}
      badge={live.length || undefined}
      badgeLabel={`${live.length} in Browser Storage`}
      expandable={roots.length > 0}
      expanded={expanded.has(LOCAL_ROW_KEY)}
      onToggleExpand={() => toggle(LOCAL_ROW_KEY)}
      onContextMenu={menu.onContextMenu}
      trailing={
        <>
          <EllipsisTriggerButton
            {...menu.triggerProps}
            size="md"
            reveal
            tabIndex={-1}
            label={`Menu for ${SIDEBAR_LABELS.thisBrowser}`}
          />
          {menu.open ? (
            <ThisBrowserSpaceMenu
              anchor={menu.triggerRef.current}
              onClose={menu.close}
              onRename={rename.setRenamingId}
            />
          ) : null}
        </>
      }
    >
      {roots.map((f) => (
        <LocalFolderRow
          key={f.id}
          folder={f}
          folders={folders}
          depth={1}
          expanded={expanded}
          toggle={toggle}
          rename={rename}
          open={open}
        />
      ))}
    </SidebarRow>
  );
}

function LocalFolderRow({
  folder,
  folders,
  depth,
  expanded,
  toggle,
  rename,
  open,
}: {
  folder: ThisBrowserFolder;
  folders: readonly ThisBrowserFolder[];
  depth: number;
  expanded: ReadonlySet<string>;
  toggle: (key: string) => void;
  rename: Rename;
  open: string | null;
}) {
  const { navigate } = useExplorer();
  const commit = useRenameLocalFolder();
  const renaming = rename.renamingId === folder.id;
  const menu = useRowMenu({ disabled: renaming });
  const kids = localChildren(folders, folder.id);
  const key = localKey(folder.id);
  return (
    <SidebarRow
      icon={<FolderSolidIcon open={expanded.has(key)} />}
      label={folder.name}
      selected={open === folder.id}
      onActivate={() => navigate({ kind: 'offline', folder: folder.id })}
      depth={depth}
      dropTo={{ local: folder.id }}
      expandable={kids.length > 0}
      expanded={expanded.has(key)}
      onToggleExpand={() => toggle(key)}
      onContextMenu={renaming ? undefined : menu.onContextMenu}
      trailing={
        renaming ? null : (
          <>
            <EllipsisTriggerButton
              {...menu.triggerProps}
              size="md"
              reveal
              tabIndex={-1}
              label={`Menu for ${folder.name}`}
            />
            {menu.open ? (
              <LocalFolderMenu
                folder={folder}
                anchor={menu.triggerRef.current}
                onClose={menu.close}
                onRename={rename.setRenamingId}
              />
            ) : null}
          </>
        )
      }
      renaming={
        renaming ? (
          <InlineRenameInput
            initial={folder.name}
            ariaLabel={`Rename ${folder.name}`}
            onCommit={(name) => {
              rename.setRenamingId(null);
              commit(folder.id, name);
            }}
            onCancel={() => rename.setRenamingId(null)}
            className={SIDEBAR_RENAME_FIELD}
          />
        ) : null
      }
    >
      {kids.map((f) => (
        <LocalFolderRow
          key={f.id}
          folder={f}
          folders={folders}
          depth={depth + 1}
          expanded={expanded}
          toggle={toggle}
          rename={rename}
          open={open}
        />
      ))}
    </SidebarRow>
  );
}
