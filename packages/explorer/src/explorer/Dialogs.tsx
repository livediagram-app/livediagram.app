'use client';

// The Explorer's dialogs, one at a time, opened from a menu through the context.

import { lazy, Suspense, useMemo } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import { isWithin } from '../data/useFolders';
import { MoveToFolderDialog } from '../dialogs/MoveToFolderDialog';
import type { PickerFolder, PickerTeam } from '../dialogs/PlacementBrowser';
import { ShareDialog } from '../dialogs/ShareDialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { DefaultFoldersDialog } from '../defaults/DefaultFolders';
import { folderDefaultEntries, folderDeleteConfirmation } from '../defaults/entries';
import { UseAsDefaultDialog } from '../defaults/UseAsDefaultDialog';
import type { ShareUrl } from '../types';
import type { ExplorerView } from '../views';
import { useExplorer } from './context';
import { useHostExtras } from './host';
import { SIDEBAR_LABELS } from '../views';
import { useTeams } from '../teams/context';

// History loads when it is first opened: its timeline, runs and chips are only for the one who asks.
const HistoryDialog = lazy(() =>
  import('../library/HistoryDialog').then((m) => ({ default: m.HistoryDialog })),
);

const defaultShareUrl: ShareUrl = (link) =>
  typeof window === 'undefined' ? `/s/${link.code}` : `${window.location.origin}/s/${link.code}`;

const pick = (f: Folder): PickerFolder => ({ id: f.id, name: f.name, parentId: f.parentId });

export function ExplorerDialogs() {
  const ctx = useExplorer();
  const teamsCtx = useTeams();
  // New Team in Move, name only: the same `create` as the sidebar's, the item then filed into it.
  const onCreateTeam = teamsCtx.canRun
    ? async (name: string) => {
        const made = await teamsCtx.create({ name });
        return made.ok ? made.value : null;
      }
    : undefined;
  const {
    dialog,
    openDialog,
    folders,
    teams,
    actions,
    client,
    shareUrl,
    shareHost,
    toast,
    view,
    navigate,
  } = ctx;
  const { thisBrowser } = useHostExtras();
  const close = () => openDialog(null);

  const personal = useMemo(
    () => folders.folders.filter((f) => f.teamId === null).map(pick),
    [folders.folders],
  );
  const teamDests = useMemo<PickerTeam[]>(
    () =>
      teams.map((t) => ({
        id: t.id,
        name: t.name,
        folders: folders.folders.filter((f) => f.teamId === t.id).map(pick),
      })),
    [teams, folders.folders],
  );
  const createFolder = async (name: string, parentId: string | null, teamId: string | null) => {
    const made = await folders.create({ name, parentId, teamId });
    return made ? pick(made) : null;
  };

  if (!dialog) return null;
  switch (dialog.kind) {
    case 'move-item': {
      const item = ctx.overlay.apply(dialog.item);
      return (
        <MoveToFolderDialog
          subjectName={item.title || 'Untitled'}
          subjectKind="item"
          personalFolders={personal}
          teams={teamDests}
          currentTeamId={item.teamId}
          currentFolderId={item.folderId}
          onCreateFolder={createFolder}
          // New Team, as livediagram's Move dialog has it: a team made on the spot, the item filed into it.
          onCreateTeam={onCreateTeam}
          onPick={(dest) => void actions.move(item, dest)}
          onClose={close}
        />
      );
    }
    case 'move-folder': {
      const folder = folders.byId.get(dialog.folderId);
      if (!folder) return null;
      // A folder moves within its own scope, and never into itself or below itself.
      const scope = folders.folders
        .filter((f) => f.teamId === folder.teamId && !isWithin(folders.byId, f.id, folder.id))
        .map(pick);
      const team = folder.teamId ? teams.find((t) => t.id === folder.teamId) : undefined;
      return (
        <MoveToFolderDialog
          subjectName={folder.name}
          subjectKind="folder"
          personalFolders={folder.teamId ? undefined : scope}
          teams={
            folder.teamId ? [{ id: folder.teamId, name: team?.name ?? 'Team', folders: scope }] : []
          }
          currentTeamId={folder.teamId}
          currentFolderId={folder.parentId}
          onPick={(dest) => void folders.move(folder.id, dest.folderId)}
          onClose={close}
        />
      );
    }
    case 'share': {
      const item = dialog.item;
      const loadTabs = shareHost?.loadTabs;
      return (
        <ShareDialog
          client={client}
          item={item}
          loadTabs={loadTabs ? () => loadTabs(item) : undefined}
          shareUrl={shareUrl ?? defaultShareUrl}
          handOver={shareHost?.handOver?.(item)}
          helpHref={shareHost?.helpHref}
          onTelemetry={
            shareHost?.onTelemetry
              ? (action, type) => shareHost.onTelemetry?.(action, type, item)
              : undefined
          }
          notify={(text, tone) => toast.show(text, { tone })}
          onClose={close}
        />
      );
    }
    case 'delete-folder': {
      const folder = folders.byId.get(dialog.folderId);
      if (!folder) return null;
      const parent = folder.parentId ? folders.byId.get(folder.parentId) : undefined;
      const confirm = folderDeleteConfirmation({
        name: folder.name,
        parentName: parent?.name ?? null,
        teamName: ctx.teamName(folder.teamId),
        kind: ctx.kind,
        held: folderDefaultEntries(folder.id, ctx.defaults.defaults, ctx.defaultEntries),
      });
      return (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          onCancel={close}
          onConfirm={() => {
            close();
            const leaveTo = afterFolderDelete(view, folders.byId, folder);
            void folders.remove(folder.id).then((removed) => {
              if (!removed) return;
              // The index drops the folder's defaults with it.
              ctx.defaults.forgetFolder(folder.id);
              if (leaveTo) navigate(leaveTo);
            });
          }}
        />
      );
    }
    case 'purge-item': {
      const item = dialog.item;
      return (
        <ConfirmDialog
          title={`Delete “${item.title || 'Untitled'}” for good?`}
          message="This cannot be undone."
          confirmLabel="Delete permanently"
          onCancel={close}
          onConfirm={() => {
            close();
            void actions.purge(item);
          }}
        />
      );
    }
    case 'history':
      return (
        <Suspense fallback={null}>
          <HistoryDialog item={dialog.item} onClose={close} />
        </Suspense>
      );
    case 'delete-local': {
      // Nothing else holds it (the index never saw it), so this is for good, as This Browser's Delete always asks.
      const item = dialog.item;
      return (
        <ConfirmDialog
          title={`Delete this ${ctx.kind.lowerOne}?`}
          message={`“${item.title || 'Untitled'}” is kept only in this browser, so deleting it removes it for good.`}
          confirmLabel="Delete"
          onCancel={close}
          onConfirm={() => {
            close();
            thisBrowser?.remove?.(item);
          }}
        />
      );
    }
    case 'sync-local': {
      const { item, to } = dialog;
      const name = item.title || 'Untitled';
      const place = to.folderId
        ? (folders.byId.get(to.folderId)?.name ?? 'the folder')
        : to.teamId
          ? (ctx.teamName(to.teamId) ?? 'the team')
          : SIDEBAR_LABELS.myWork;
      const sync = thisBrowser?.sync;
      const syncHref = thisBrowser?.syncHref?.(item);
      if (!sync && !syncHref) return null;
      return (
        <ConfirmDialog
          title={`Sync “${name}” to your account?`}
          message={
            sync
              ? `It’s kept only in this browser. To go into ${place} it moves to your account first, and then it’s on every device you sign in on.`
              : `It’s kept only in this browser. To go into ${place} it moves to your account first: it opens in the editor to sync, and then you can move it there.`
          }
          confirmLabel={sync ? 'Sync and Move' : `Sync ${ctx.kind.one}`}
          onCancel={close}
          onConfirm={() => {
            close();
            if (!sync) {
              window.location.assign(syncHref!);
              return;
            }
            // In place (the editor's panel): once it's in the account, under the same id, it moves where it was dropped.
            void Promise.resolve(sync(item))
              .then(() => client.getItem(item.id))
              .then(({ item: synced }) =>
                synced.folderId === to.folderId && synced.teamId === to.teamId
                  ? true
                  : actions.move(synced, to),
              )
              .catch(() => false)
              .finally(ctx.reloadLists);
          }}
        />
      );
    }
    case 'use-as-default':
      return <UseAsDefaultDialog folderId={dialog.folderId} onClose={close} />;
    case 'default-folders':
      return <DefaultFoldersDialog onClose={close} />;
    case 'empty-trash':
      return (
        <ConfirmDialog
          title="Empty the Trash?"
          message={emptyTrashMessage(dialog, ctx.filter === 'app' ? ctx.words.lowerOne : null)}
          confirmLabel="Empty Trash"
          onCancel={close}
          onConfirm={() => {
            close();
            void actions.emptyTrash({
              teamId: dialog.teamId,
              app: ctx.filter === 'app' ? ctx.app : null,
            });
          }}
        />
      );
  }
}

/** What emptying this Trash deletes: whose, and of which kind when the Explorer shows one app's. */
export function emptyTrashMessage(
  target: { teamId: string | null; title: string },
  // The one app's kind ("plan") while the Explorer shows one app's items; null for every app's.
  kind: string | null,
): string {
  const what = kind ? `Every ${kind} in` : 'Everything in';
  if (target.teamId) {
    return `${what} ${target.title}’s Trash is deleted for good, for the whole team. This can’t be undone.`;
  }
  return `${what} your Trash is deleted for good. This can’t be undone.`;
}

/**
 * Where to go once a folder is deleted: deleting the folder on screen, or one holding it, leaves for its space's
 * root (My Work, or the team's library); anywhere else stays put (null).
 */
export function afterFolderDelete(
  view: ExplorerView,
  byId: Map<string, Folder>,
  folder: Folder,
): ExplorerView | null {
  const open =
    view.kind === 'folder' ? view.id : view.kind === 'team' ? (view.folderId ?? null) : null;
  if (open === null || !isWithin(byId, open, folder.id)) return null;
  return folder.teamId ? { kind: 'team', id: folder.teamId } : { kind: 'all' };
}
