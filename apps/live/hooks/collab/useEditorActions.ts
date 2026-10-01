// Assigned-action state machine for the editor (docs/specs/012-collaboration/assigned-actions.md), the sibling of
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
// live-state graft in @livediagram/document carries `action` across
// undo/redo restores for the same reason.
//
// An Action panel holds a LIST (docs/specs/012-collaboration/action-panel.md "The data"), so every mutation
// takes an optional action id. On an ordinary element it is ignored (there is
// only the one); on a card it names which of the card's actions to touch, and
// a save with none appends a new one.

import { useState } from 'react';
import {
  ACTION_CARD_MAX,
  createElementAction,
  elementActions,
  isBoxed,
  type ElementAction,
  type ElementActionAssignee,
} from '@livediagram/document';
import type { Tab } from '@livediagram/document';
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
  // Current action for an element on the active tab (undefined when none):
  // the named one on an Action panel, else the element's single action.
  getAction: (elementId: string, actionId?: string | null) => ElementAction | undefined;
  // Whether the element is an Action panel, which holds a list.
  isActionCard: (elementId: string) => boolean;
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
    // The membership row id, for an invited assignee (docs/specs/012-collaboration/assigned-actions.md).
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
  // Which of an Action panel's actions the dialog edits; null to add one.
  assignActionId: string | null;
  openAssignActionDialog: (elementId: string, actionId?: string | null) => void;
  closeAssignActionDialog: () => void;
  // The Collaborate tile: popover when an action exists, dialog otherwise.
  openAssignAction: (elementId: string) => void;
  saveAction: (elementId: string, input: SaveActionInput, actionId?: string | null) => void;
  completeAction: (elementId: string, actionId?: string | null) => void;
  reopenAction: (elementId: string, actionId?: string | null) => void;
  deleteAction: (elementId: string, actionId?: string | null) => void;
};

export function useEditorActions(deps: EditorActionsDeps): EditorActionsApi {
  const [actionPopoverOpenId, setActionPopoverOpenId] = useState<string | null>(null);
  const [assignActionFor, setAssignActionFor] = useState<string | null>(null);
  const [assignActionId, setAssignActionId] = useState<string | null>(null);

  // Per-element mutator over the element's action LIST (elementActions): an
  // Action panel writes it back as `actions` (a card saved before the list
  // existed is migrated on this first edit, its lone `action` dropped); an
  // ordinary element keeps at most one, as `action`.
  const updateActions = (elementId: string, fn: (list: ElementAction[]) => ElementAction[]) => {
    deps.tickTabs((ts) =>
      ts.map((t) =>
        t.id !== deps.activeId
          ? t
          : {
              ...t,
              elements: t.elements.map((el) => {
                if (el.id !== elementId || !isBoxed(el)) return el;
                const next = fn(elementActions(el));
                const {
                  action: _one,
                  actions: _many,
                  ...rest
                } = el as typeof el & {
                  actions?: ElementAction[];
                };
                if (el.type === 'shape' && el.shape === 'action-card') {
                  return { ...rest, actions: next } as typeof el;
                }
                return (next[0] ? { ...rest, action: next[0] } : rest) as typeof el;
              }),
            },
      ),
    );
  };
  // One action in the list: the named one on a card, else the only one.
  const updateOne = (
    elementId: string,
    actionId: string | null | undefined,
    fn: (action: ElementAction) => ElementAction | undefined,
  ) =>
    updateActions(elementId, (list) =>
      list.flatMap((a, i) => {
        const hit = actionId ? a.id === actionId : i === 0;
        if (!hit) return [a];
        const next = fn(a);
        return next ? [next] : [];
      }),
    );

  const openActionPopover = (elementId: string) => {
    const wasOpen = actionPopoverOpenId === elementId;
    setActionPopoverOpenId((cur) => (cur === elementId ? null : elementId));
    if (!wasOpen) track('Action', 'Opened');
  };
  const closeActionPopover = () => setActionPopoverOpenId(null);

  const openAssignActionDialog = (elementId: string, actionId: string | null = null) => {
    setActionPopoverOpenId(null);
    setAssignActionFor(elementId);
    setAssignActionId(actionId);
  };
  const closeAssignActionDialog = () => {
    setAssignActionFor(null);
    setAssignActionId(null);
  };

  const openAssignAction = (elementId: string) => {
    // An Action panel has no popover: its actions are on its face, so the
    // tile adds another.
    if (deps.isActionCard(elementId)) {
      openAssignActionDialog(elementId, null);
      return;
    }
    if (deps.getAction(elementId)) {
      setAssignActionFor(null);
      setActionPopoverOpenId(elementId);
      track('Action', 'Opened');
    } else {
      openAssignActionDialog(elementId);
    }
  };

  const saveAction = (elementId: string, input: SaveActionInput, actionId?: string | null) => {
    // On an Action panel, no id means "add another"; elsewhere the element's
    // one action (if any) is the one being edited.
    const card = deps.isActionCard(elementId);
    const existing = card && !actionId ? undefined : deps.getAction(elementId, actionId);
    // Editing an action that is gone (a teammate deleted it while this
    // dialog was open): saving must not quietly re-create it as a new one.
    if (actionId && !existing) {
      closeAssignActionDialog();
      return;
    }
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
      updateActions(elementId, (list) =>
        card ? [...list, action].slice(0, ACTION_CARD_MAX) : [action],
      );
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
      updateOne(elementId, existing.id, (action) => ({
        ...action,
        name,
        description: input.description.trim(),
        assignee: input.assignee,
        teamId: input.teamId,
        updatedAt: Date.now(),
      }));
      track('Action', 'Changed', reassigned ? 'Reassigned' : 'Edited');
      // Only a NEW assignee gets the email offer (docs/specs/012-collaboration/assigned-actions.md §3): an edit
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
    closeAssignActionDialog();
  };

  const completeAction = (elementId: string, actionId?: string | null) => {
    updateOne(elementId, actionId, (action) => ({
      ...action,
      status: 'done',
      updatedAt: Date.now(),
    }));
    track('Action', 'Resolved');
  };

  const reopenAction = (elementId: string, actionId?: string | null) => {
    updateOne(elementId, actionId, (action) => ({
      ...action,
      status: 'open',
      updatedAt: Date.now(),
    }));
    track('Action', 'Unresolved');
  };

  const deleteAction = (elementId: string, actionId?: string | null) => {
    updateOne(elementId, actionId, () => undefined);
    setActionPopoverOpenId((cur) => (cur === elementId ? null : cur));
    closeAssignActionDialog();
    track('Action', 'Deleted');
  };

  return {
    actionPopoverOpenId,
    openActionPopover,
    closeActionPopover,
    assignActionFor,
    assignActionId,
    openAssignActionDialog,
    closeAssignActionDialog,
    openAssignAction,
    saveAction,
    completeAction,
    reopenAction,
    deleteAction,
  };
}
