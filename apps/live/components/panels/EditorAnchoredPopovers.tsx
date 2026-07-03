'use client';

import dynamic from 'next/dynamic';
import { isBoxed } from '@livediagram/diagram';

import { track } from '@/lib/telemetry';
import { apiAddComment, apiDeleteComment } from '@/lib/api-client';
import { useEditorContext } from '@/app/diagram/[id]/EditorContext';

const CommentThreadPopover = dynamic(() =>
  import('@/components/panels/CommentThreadPopover').then((m) => m.CommentThreadPopover),
);
const NotePopover = dynamic(() =>
  import('@/components/canvas/NotePopover').then((m) => m.NotePopover),
);
const ActionPopover = dynamic(() =>
  import('@/components/panels/ActionPopover').then((m) => m.ActionPopover),
);
const AssignActionDialog = dynamic(() =>
  import('@/components/dialogs/AssignActionDialog').then((m) => m.AssignActionDialog),
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
    replaceCommentId,
    isReadOnly,
    diagramId,
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
    openAssignActionDialog,
    closeAssignActionDialog,
    saveAction,
    completeAction,
    reopenAction,
    deleteAction,
    teams,
    clerkUserId,
    diagramTeamId,
    emailEnabled,
  } = useEditorContext();

  return (
    <>
      {commentThreadOpenId !== null
        ? (() => {
            const target = activeTab.elements.find(
              (el) => el.id === commentThreadOpenId && isBoxed(el),
            );
            if (!target || !isBoxed(target)) return null;
            return (
              <CommentThreadPopover
                elementId={target.id}
                thread={target.commentThread}
                onAddComment={(text) => {
                  const localId = addComment(target.id, text);
                  track('Comment', 'Added');
                  // View-role visitors don't autosave the tab, so
                  // their addComment via the local commit alone
                  // would vanish on refresh. Persist via the
                  // dedicated POST /tabs/<id>/comments endpoint
                  // (the only write path open to view-role) so the
                  // viewer's contribution lives in D1 like an
                  // owner / editor's would — then adopt the
                  // server-minted id, or the viewer's own delete
                  // would send an id the server doesn't have and
                  // the comment would resurrect on refresh.
                  if (isReadOnly && diagramId) {
                    void apiAddComment(
                      selfParticipant.id,
                      diagramId,
                      activeTab.id,
                      target.id,
                      text,
                      sessionShareCode,
                    )
                      .then((created) => {
                        if (created?.id) replaceCommentId(target.id, localId, created.id);
                      })
                      .catch(() => {});
                  }
                }}
                onDeleteComment={(cid) => {
                  deleteComment(target.id, cid);
                  track('Comment', 'Deleted');
                  // View-role visitors don't autosave the tab, so the
                  // local delete alone would resurrect on refresh.
                  // Persist via the dedicated DELETE endpoint (the
                  // server re-checks authorId === caller, so a viewer
                  // can only land their own deletes). Owners / editors
                  // persist via the normal tab autosave.
                  if (isReadOnly && diagramId) {
                    void apiDeleteComment(
                      selfParticipant.id,
                      diagramId,
                      activeTab.id,
                      cid,
                      sessionShareCode,
                    ).catch(() => {});
                  }
                }}
                onResolve={() => {
                  resolveThread(target.id);
                  track('Comment', 'Resolved');
                }}
                onUnresolve={() => {
                  unresolveThread(target.id);
                  track('Comment', 'Unresolved');
                }}
                onClose={closeComments}
                readOnly={isReadOnly}
                selfId={selfParticipant.id}
              />
            );
          })()
        : null}
      {/* Assigned-action popover (spec/68): read for everyone, mutations
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
                onEdit={() => openAssignActionDialog(target.id)}
                onDelete={() => deleteAction(target.id)}
                onClose={closeActionPopover}
                readOnly={isReadOnly}
                selfUserId={clerkUserId ?? null}
              />
            );
          })()
        : null}
      {/* Assign Action dialog (spec/68 §2): create when the element has
          no action, edit (prefilled) when it does. */}
      {assignActionFor !== null
        ? (() => {
            const target = activeTab.elements.find(
              (el) => el.id === assignActionFor && isBoxed(el),
            );
            if (!target || !isBoxed(target)) return null;
            return (
              <AssignActionDialog
                open
                existing={target.action ?? null}
                teams={teams}
                ownerId={clerkUserId ?? null}
                selfUserId={clerkUserId ?? null}
                diagramTeamId={diagramTeamId}
                emailEnabled={emailEnabled}
                onSubmit={(input) => saveAction(target.id, input)}
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
                readOnly={isReadOnly}
                onCommit={(next) => {
                  const prev = (target.note ?? '').trim();
                  const nextTrim = next.trim();
                  setNote(target.id, next);
                  if (prev === nextTrim) return;
                  if (!prev && nextTrim) track('Note', 'Added');
                  else if (prev && !nextTrim) track('Note', 'Deleted');
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
