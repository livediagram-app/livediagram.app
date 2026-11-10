'use client';

// The Explorer's dialogs, one at a time, opened from a menu through the context.

import { lazy, Suspense, useMemo } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import { isWithin } from '../data/useFolders';
import {
  ARCHIVED_PLACEMENT,
  THIS_BROWSER_PLACEMENT,
  type PickerFolder,
  type PickerTeam,
  type PlacementSpace,
} from '../dialogs/PlacementBrowser';
import { ConfirmDialog } from '@liveworkspace/ui';
import { folderDefaultEntries, folderDeleteConfirmation } from '../defaults/entries';
import type { ShareUrl } from '../types';
import {
  DefaultFoldersDialog,
  MoveToFolderDialog,
  ShareDialog,
  UseAsDefaultDialog,
} from './lazy-dialogs';
import { noteSyncPlace, setThisBrowserArchived, thisBrowserDeleteCopy } from '../this-browser';
import { LocalSpaceDialog } from './this-browser-space/LocalDialogs';
import { ArchiveIcon } from '../ui/icons';
import { canArchive } from './menus';
import { kindWords } from '../words';
import { archivedCopy } from './archived-copy';
import type { ShareTelemetry } from '../dialogs/share/types';
import type { ExplorerView } from '../views';
import { useExplorer, type DialogTarget } from './context';
import { BrowserIcon, useHostExtras } from './host';
import { SIDEBAR_LABELS } from '../views';
import { useTeams } from '../teams/context';
import { quoted } from '../quoted';

// History loads when it is first opened: its timeline, runs and chips are only for the one who asks.
const HistoryDialog = lazy(() =>
  import('../library/HistoryDialog').then((m) => ({ default: m.HistoryDialog })),
);

// Webhooks loads when it is first opened: its forms and pickers are only for the few who add one.
const WebhooksDialog = lazy(() =>
  import('../library/WebhooksDialog').then((m) => ({ default: m.WebhooksDialog })),
);

// The Community tab (@liveworkspace/community-ui: its guide, section and publish dialog) loads when an item with a
// Community is first shared, so an Explorer that never shares one never downloads it.
const ShareDialogWithCommunity = lazy(() =>
  import('../dialogs/ShareDialogWithCommunity').then((m) => ({
    default: m.ShareDialogWithCommunity,
  })),
);

const defaultShareUrl: ShareUrl = (link) =>
  typeof window === 'undefined' ? `/s/${link.code}` : `${window.location.origin}/s/${link.code}`;

const pick = (f: Folder): PickerFolder => ({ id: f.id, name: f.name, parentId: f.parentId });

// Change Folder's spaces of their own (one-explorer.md "Archived").
const ARCHIVED_SPACE: PlacementSpace = {
  value: ARCHIVED_PLACEMENT,
  label: SIDEBAR_LABELS.archived,
  sub: 'Out of every list, and closed',
  icon: <ArchiveIcon size={16} />,
};
const THIS_BROWSER_SPACE: PlacementSpace = {
  value: THIS_BROWSER_PLACEMENT,
  label: SIDEBAR_LABELS.thisBrowser,
  sub: 'Kept only in this browser',
  icon: <BrowserIcon size={16} />,
};

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
    case 'move-local-item':
    case 'move-local-folder':
    case 'delete-local-folder':
      return (
        <LocalSpaceDialog
          dialog={dialog}
          personal={personal}
          teams={teamDests}
          createFolder={createFolder}
        />
      );
    case 'move-item': {
      const item = ctx.overlay.apply(dialog.item);
      // Archived is a space of its own, where Move to Archived would be offered, and where the item is now.
      const archived = Boolean(item.archivedAt);
      const spaces = archived || canArchive(item, ctx.viewerId) ? [ARCHIVED_SPACE] : undefined;
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
          spaces={spaces}
          currentSpace={archived ? ARCHIVED_PLACEMENT : null}
          onPickSpace={() => void actions.archive(item)}
          onClose={close}
        />
      );
    }
    case 'archived':
    case 'archived-local': {
      const item = dialog.item;
      return (
        <ConfirmDialog
          open
          // The item's own kind: on All Apps an archived canvas isn't a plan.
          {...archivedCopy(
            item.title,
            dialog.kind === 'archived' ? kindWords(dialog.item.app).lowerOne : ctx.kind.lowerOne,
          )}
          onCancel={close}
          onConfirm={() =>
            openDialog(
              dialog.kind === 'archived'
                ? { kind: 'move-item', item: dialog.item }
                : { kind: 'move-local', item: dialog.item },
            )
          }
        />
      );
    }
    case 'move-local': {
      const item = dialog.item;
      // Into the account goes through Sync, as a This Browser drop on a place does: only where the host syncs.
      const syncs = Boolean(thisBrowser?.sync || thisBrowser?.syncHref?.(item));
      // A place in the account asks to sync next: the dialog closes onto that question.
      let next: DialogTarget = null;
      return (
        <MoveToFolderDialog
          subjectName={item.title || 'Untitled'}
          subjectKind="item"
          personalFolders={syncs ? personal : undefined}
          teams={syncs ? teamDests : []}
          onCreateFolder={syncs ? createFolder : undefined}
          onPick={(to) => void (next = { kind: 'sync-local', item, to, archived: true })}
          spaces={[THIS_BROWSER_SPACE, ARCHIVED_SPACE]}
          currentSpace={ARCHIVED_PLACEMENT}
          onPickSpace={(value) => {
            if (value !== THIS_BROWSER_PLACEMENT) return;
            setThisBrowserArchived(ctx.app, item.id, null);
            toast.show(
              `Moved ${quoted(item.title || 'Untitled')} to ${SIDEBAR_LABELS.thisBrowser}.`,
              {
                tone: 'success',
              },
            );
          }}
          onClose={() => openDialog(next)}
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
      const community = shareHost?.community?.(item);
      const share = {
        client,
        item,
        loadTabs: loadTabs ? () => loadTabs(item) : undefined,
        shareUrl: shareUrl ?? defaultShareUrl,
        handOver: shareHost?.handOver?.(item),
        helpHref: shareHost?.helpHref,
        onTelemetry: shareHost?.onTelemetry
          ? (action: Parameters<ShareTelemetry>[0], type: string) =>
              shareHost.onTelemetry?.(action, type, item)
          : undefined,
        notify: (text: string, tone: 'success' | 'info' | 'error') => toast.show(text, { tone }),
        onClose: close,
      };
      // With a Community for the item's app, its tab sits beside Passes.
      return community ? (
        <Suspense fallback={null}>
          <ShareDialogWithCommunity {...share} community={community} />
        </Suspense>
      ) : (
        <ShareDialog {...share} />
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
          open
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
          open
          title={`Delete ${quoted(item.title || 'Untitled')} for good?`}
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
    case 'webhooks':
      return (
        <Suspense fallback={null}>
          <WebhooksDialog item={dialog.item} onClose={close} />
        </Suspense>
      );
    case 'delete-local': {
      // Nothing else holds it (the index never saw it), so this is for good, as This Browser's Delete always asks, in
      // the words the editor's handed-over Delete uses too.
      const item = dialog.item;
      return (
        <ConfirmDialog
          open
          {...thisBrowserDeleteCopy(ctx.kind.lowerOne, item.title)}
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
          open
          title={`Sync ${quoted(name)} to your account?`}
          message={
            sync
              ? `It’s kept only in this browser. To go into ${place} it moves to your account first, and then it’s on every device you sign in on.`
              : to.folderId || to.teamId
                ? `It’s kept only in this browser. To go into ${place} it moves to your account first: it opens in the editor to sync, and it goes into ${place} the next time you’re here.`
                : `It’s kept only in this browser. It opens in the editor to sync, and goes into ${place} in your account.`
          }
          confirmLabel={sync ? 'Sync and Move' : `Sync ${ctx.kind.one}`}
          onCancel={close}
          onConfirm={() => {
            close();
            // Out of Archived first: the editor opens it to sync, and it opens no archived one.
            if (dialog.archived) setThisBrowserArchived(ctx.app, item.id, null);
            if (!sync) {
              // Where it should land, for the next Explorer here to move it once the index has it (useSyncPlaces).
              noteSyncPlace(ctx.app, item.id, to);
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
          open
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
