// Assigned-action state machine for the editor (spec/68), the sibling of
// useEditorComments. The bundle covers:
//
// - `actionPopoverOpenId`: which element's action popover is open.
// - `assignActionFor`: which element the Assign Action dialog is open for
//   (create when the element has no action, edit when it does — the dialog
//   prefills from the existing action).
// - `openAssignAction`: the context-menu tile's entry point — opens the
//   popover when the element already carries an action, else the dialog.
// - `saveAction`, `completeAction`, `reopenAction`, `deleteAction`: the
//   mutations the dialog + popover bind to.
//
// Mutations run through `tickTabs` (NO history push), the same carve-out
// comments use: Cmd+Z must never silently unassign someone's work. The
// live-state graft in @livediagram/diagram carries `action` across
// undo/redo restores for the same reason.

import { useState } from 'react';
import {
  createElementAction,
  isBoxed,
  type ElementAction,
  type ElementActionAssignee,
} from '@livediagram/diagram';
import type { Tab } from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

export type SaveActionInput = {
  name: string;
  description: string;
  assignee: ElementActionAssignee;
  // Null for a self-assignment (no team row involved, no email).
  teamId: string | null;
  // The dialog's "Email {name} about this action" checkbox. Only consulted
  // when it can matter: on create, and on an edit that changes the assignee.
  notifyEmail: boolean;
};

type EditorActionsDeps = {
  activeId: string;
  // The history hook's element-only setter (no snapshot), per the
  // non-undoable rule above.
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  // Current action for an element on the active tab (undefined when none).
  getAction: (elementId: string) => ElementAction | undefined;
  // The assigner: the signed-in account, or the guest participant
  // identity for a signed-out self-assignment. Null only before the
  // identity has hydrated.
  self: { userId: string | null; name: string | null };
  // Fire-and-forget notify request (POST /api/teams/<id>/notify-action).
  // Injected so the hook stays free of fetch plumbing; failures must never
  // block or roll back the assignment.
  notify: (input: {
    teamId: string;
    assigneeUserId: string | null;
    // The membership row id, for an invited assignee (spec/68).
    assigneeMemberId?: string;
    actionName: string;
    description: string;
  }) => void;
};

type EditorActionsApi = {
  actionPopoverOpenId: string | null;
  openActionPopover: (elementId: string) => void;
  closeActionPopover: () => void;
  assignActionFor: string | null;
  openAssignActionDialog: (elementId: string) => void;
  closeAssignActionDialog: () => void;
  // The Collaborate tile: popover when an action exists, dialog otherwise.
  openAssignAction: (elementId: string) => void;
  saveAction: (elementId: string, input: SaveActionInput) => void;
  completeAction: (elementId: string) => void;
  reopenAction: (elementId: string) => void;
  deleteAction: (elementId: string) => void;
};

export function useEditorActions(deps: EditorActionsDeps): EditorActionsApi {
  const [actionPopoverOpenId, setActionPopoverOpenId] = useState<string | null>(null);
  const [assignActionFor, setAssignActionFor] = useState<string | null>(null);

  // Per-element mutator, the useEditorComments.updateThread shape:
  // returning `undefined` from `fn` drops the field entirely.
  const updateAction = (
    elementId: string,
    fn: (action: ElementAction | undefined) => ElementAction | undefined,
  ) => {
    deps.tickTabs((ts) =>
      ts.map((t) =>
        t.id !== deps.activeId
          ? t
          : {
              ...t,
              elements: t.elements.map((el) => {
                if (el.id !== elementId || !isBoxed(el)) return el;
                const next = fn(el.action);
                if (!next) {
                  const { action: _drop, ...rest } = el;
                  return rest as typeof el;
                }
                return { ...el, action: next };
              }),
            },
      ),
    );
  };

  const openActionPopover = (elementId: string) => {
    const wasOpen = actionPopoverOpenId === elementId;
    setActionPopoverOpenId((cur) => (cur === elementId ? null : elementId));
    if (!wasOpen) track('Action', 'Opened');
  };
  const closeActionPopover = () => setActionPopoverOpenId(null);

  const openAssignActionDialog = (elementId: string) => {
    setActionPopoverOpenId(null);
    setAssignActionFor(elementId);
  };
  const closeAssignActionDialog = () => setAssignActionFor(null);

  const openAssignAction = (elementId: string) => {
    if (deps.getAction(elementId)) {
      setAssignActionFor(null);
      setActionPopoverOpenId(elementId);
      track('Action', 'Opened');
    } else {
      openAssignActionDialog(elementId);
    }
  };

  const saveAction = (elementId: string, input: SaveActionInput) => {
    const existing = deps.getAction(elementId);
    const name = input.name.trim();
    if (!name) return;
    if (!existing) {
      // Assigning needs a signed-in assigner; the tile is hidden for
      // guests so this is belt-and-braces.
      if (!deps.self.userId) return;
      const action = createElementAction({
        name,
        description: input.description.trim(),
        assignee: input.assignee,
        teamId: input.teamId,
        assigner: { id: deps.self.userId, name: deps.self.name },
      });
      updateAction(elementId, () => action);
      track('Action', 'Created', input.notifyEmail ? 'EmailOn' : 'EmailOff');
      // Email needs a team context (the endpoint verifies shared
      // membership); a self-assignment has none and never notifies.
      if (input.notifyEmail && input.teamId) {
        deps.notify({
          teamId: input.teamId,
          assigneeUserId: input.assignee.userId,
          assigneeMemberId: input.assignee.memberId,
          actionName: name,
          description: input.description.trim(),
        });
      }
    } else {
      // Compare BOTH keys: two invited members share a null userId, and
      // an invited member later claimed keeps the same memberId.
      const reassigned =
        existing.assignee.userId !== input.assignee.userId ||
        existing.assignee.memberId !== input.assignee.memberId;
      updateAction(elementId, (action) =>
        action
          ? {
              ...action,
              name,
              description: input.description.trim(),
              assignee: input.assignee,
              teamId: input.teamId,
              updatedAt: Date.now(),
            }
          : action,
      );
      track('Action', 'Changed', reassigned ? 'Reassigned' : 'Edited');
      // Only a NEW assignee gets the email offer (spec/68 §3): an edit
      // that keeps the assignee sends nothing, and a self-assignment
      // has no team context to email through.
      if (reassigned && input.notifyEmail && input.teamId) {
        deps.notify({
          teamId: input.teamId,
          assigneeUserId: input.assignee.userId,
          assigneeMemberId: input.assignee.memberId,
          actionName: name,
          description: input.description.trim(),
        });
      }
    }
    setAssignActionFor(null);
  };

  const completeAction = (elementId: string) => {
    updateAction(elementId, (action) =>
      action ? { ...action, status: 'done', updatedAt: Date.now() } : action,
    );
    track('Action', 'Resolved');
  };

  const reopenAction = (elementId: string) => {
    updateAction(elementId, (action) =>
      action ? { ...action, status: 'open', updatedAt: Date.now() } : action,
    );
    track('Action', 'Unresolved');
  };

  const deleteAction = (elementId: string) => {
    updateAction(elementId, () => undefined);
    setActionPopoverOpenId((cur) => (cur === elementId ? null : cur));
    track('Action', 'Deleted');
  };

  return {
    actionPopoverOpenId,
    openActionPopover,
    closeActionPopover,
    assignActionFor,
    openAssignActionDialog,
    closeAssignActionDialog,
    openAssignAction,
    saveAction,
    completeAction,
    reopenAction,
    deleteAction,
  };
}
