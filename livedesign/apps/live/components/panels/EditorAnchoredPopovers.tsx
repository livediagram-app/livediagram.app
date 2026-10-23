'use client';

import { useCloseVanishedDialogs } from '@/components/dialogs/useCloseVanishedDialogs';
import dynamic from 'next/dynamic';
import { apiSetDesignFolder } from '@/lib/api-client';
import { isBoxed } from '@livedesign/design';

import { track } from '@/lib/telemetry';
import { canonicalNote, noteFieldsEqual } from '@/lib/note-value';
import { commentPersisters } from '@/lib/comment-persistence';
import { useEditorContext } from '@/app/design/[id]/EditorContext';

const CommentThreadPopover = dynamic(
  () => import('@/components/panels/CommentThreadPopover').then((m) => m.CommentThreadPopover),
  { ssr: false },
);
const NotePopover = dynamic(
  () => import('@/components/notes/NotePopover').then((m) => m.NotePopover),
  { ssr: false },
);
const ActionPopover = dynamic(
  () => import('@/components/panels/ActionPopover').then((m) => m.ActionPopover),
  { ssr: false },
);
const AssignActionDialog = dynamic(
  () => import('@/components/dialogs/AssignActionDialog').then((m) => m.AssignActionDialog),
  { ssr: false },
);

// Popovers anchored to a specific canvas element: the comment thread and
// the per-element note editor. Each resolves its target off the active tab
// and reads everything from EditorContext, so EditorView just renders
// <EditorAnchoredPopovers />. Both bypass the autosave path for view-role
// visitors, persisting directly through the dedicated comment endpoints.
export function EditorAnchoredPopovers() {
  const {
    commentThreadOpenId,
    activeTab,
    addComment,
    isReadOnly,
    can,
    designId,
    selfParticipant,
    sessionShareCode,
    deleteComment,
    resolveThread,
    unresolveThread,
    closeComments,
    noteOpenId,
    setNote,
    closeNote,
    actionPopoverOpenId,
    closeActionPopover,
    assignActionFor,
    assignActionId,
    openAssignActionDialog,
    closeAssignActionDialog,
    saveAction,
    completeAction,
    reopenAction,
    wontDoAction,
    deleteAction,
    teams,
    accountUserId,
    setDesignTeamId,
    accountDisplayName,
    designTeamId,
    emailEnabled,
  } = useEditorContext();

  // The assigner/viewer identity for actions (docs/specs/012-collaboration/assigned-actions.md): the
  // account, or the guest participant identity — guests can self-assign.
  const actionSelfId = accountUserId ?? selfParticipant.id;
  const actionSelfName = accountDisplayName ?? selfParticipant.name;
  // A read-only session has no autosave, so its comment changes go through the comment endpoints; an editor's ride
  // the room and its save (lib/comment-persistence.ts, shared with the Comment panel).
  const persist = commentPersisters({
    readOnly: isReadOnly,
    designId,
    tabId: activeTab.id,
    selfId: selfParticipant.id,
    shareCode: sessionShareCode,
  });

  // Each popover closes once its element can no longer hold it (deleted, an undo, another tab), rather than staying
  // hidden with its id set and reopening by itself when the element comes back (useCloseVanishedDialogs).
  useCloseVanishedDialogs(activeTab.elements, [
    [commentThreadOpenId, closeComments, isBoxed],
    [actionPopoverOpenId, closeActionPopover, (el) => isBoxed(el) && !!el.action],
    [assignActionFor, closeAssignActionDialog, isBoxed],
    [noteOpenId, closeNote, isBoxed],
  ]);

  return (
    <>
      {commentThreadOpenId !== null
        ? (() => {
            const target = activeTab.elements.find(
              (el) => el.id === commentThreadOpenId && isBoxed(el),
            );
            if (!target || !isBoxed(target)) return null;
            const thread = target.commentThread;
            return (
              <CommentThreadPopover
                elementId={target.id}
                thread={thread}
                onAddComment={(text, mentions) =>
                  // The hook adopts the server-minted id when the add went through the endpoint, and counts the
                  // add once the server accepted it.
                  addComment(target.id, text, persist.add(target.id, text, mentions), mentions)
                }
                // The server re-checks authorId === caller, so a read-only session can only land its own deletes.
                onDeleteComment={(cid) => deleteComment(target.id, cid, persist.remove(cid))}
                // A session that may comment but not edit resolves and reopens through the comment endpoints, as it
                // adds (docs/specs/024-agents/agent-presence.md "Comments"); the thread is named by its first comment.
                onResolve={() => resolveThread(target.id, persist.threadState(thread, true))}
                onUnresolve={() => unresolveThread(target.id, persist.threadState(thread, false))}
                onClose={closeComments}
                readOnly={isReadOnly}
                canComment={can.takePart}
                selfId={selfParticipant.id}
              />
            );
          })()
        : null}
      {/* Assigned-action popover (docs/specs/012-collaboration/assigned-actions.md): read for everyone, mutations
          gated on edit access. Closes itself if the action vanished (a
          collaborator deleted it, or its element was removed). */}
      {actionPopoverOpenId !== null
        ? (() => {
            const target = activeTab.elements.find(
              (el) => el.id === actionPopoverOpenId && isBoxed(el),
            );
            if (!target || !isBoxed(target) || !target.action) return null;
            return (
              <ActionPopover
                elementId={target.id}
                action={target.action}
                onComplete={() => completeAction(target.id)}
                onReopen={() => reopenAction(target.id)}
                onWontDo={() => wontDoAction(target.id)}
                onEdit={() => openAssignActionDialog(target.id)}
                onDelete={() => deleteAction(target.id)}
                onClose={closeActionPopover}
                readOnly={isReadOnly}
                selfUserId={actionSelfId}
              />
            );
          })()
        : null}
      {/* Assign Action dialog (docs/specs/012-collaboration/assigned-actions.md §2): create when the element has
          no action, edit (prefilled) when it does. */}
      {assignActionFor !== null
        ? (() => {
            const target = activeTab.elements.find(
              (el) => el.id === assignActionFor && isBoxed(el),
            );
            if (!target || !isBoxed(target)) return null;
            // Default action name (docs/specs/012-collaboration/assigned-actions.md §2): the element's own text —
            // its label, or a table's first non-empty cell. Null when the
            // element is unlabelled (the field just starts empty).
            const targetLabel =
              target.type === 'table'
                ? (target.cells
                    .flat()
                    .find((c) => c.trim().length > 0)
                    ?.trim() ?? null)
                : (target.label?.trim() ?? null);
            return (
              <AssignActionDialog
                open
                // The element's one action.
                existing={target.action ?? null}
                elementLabel={targetLabel || null}
                teams={teams}
                ownerId={accountUserId ?? null}
                selfUserId={actionSelfId}
                selfName={actionSelfName}
                designId={designId}
                designTeamId={designTeamId}
                emailEnabled={emailEnabled}
                // Inline personal-design fix (docs/specs/012-collaboration/assigned-actions.md §2): file the design
                // into the picked team's library root so the picker can offer
                // that team's members without an Explorer round-trip. The
                // server enforces the docs/specs/013-workspace/team-shared-designs.md placement rules; on success the
                // local team id flips and the member fetch re-runs.
                onMoveToTeam={async (teamId) => {
                  if (!accountUserId || !designId) return false;
                  try {
                    await apiSetDesignFolder(accountUserId, designId, null, teamId);
                  } catch {
                    return false;
                  }
                  setDesignTeamId(teamId);
                  return true;
                }}
                onSubmit={(input) => saveAction(target.id, input, assignActionId)}
                onClose={closeAssignActionDialog}
              />
            );
          })()
        : null}
      {noteOpenId !== null
        ? (() => {
            const target = activeTab.elements.find((el) => el.id === noteOpenId && isBoxed(el));
            if (!target || !isBoxed(target)) return null;
            return (
              <NotePopover
                elementId={target.id}
                initial={target.note ?? ''}
                initialRuns={target.noteRich}
                readOnly={isReadOnly}
                onCommit={(next, runs) => {
                  // Compare the CANONICAL forms (the same normalisation
                  // `setNote` stores), so reopening a note and clicking away
                  // reports nothing, and a formatting-only edit — which
                  // leaves the plain mirror identical — still reports.
                  const prev = canonicalNote(target.note ?? '', target.noteRich);
                  const now = canonicalNote(next, runs);
                  setNote(target.id, next, runs);
                  if (noteFieldsEqual(prev, now)) return;
                  if (!prev.note) track('Note', 'Added');
                  else if (!now.note) track('Note', 'Deleted');
                  else track('Note', 'Changed');
                }}
                onClose={closeNote}
              />
            );
          })()
        : null}
    </>
  );
}
