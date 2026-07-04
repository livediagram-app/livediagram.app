'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, TextInput } from '@livediagram/ui';
import type { ElementAction } from '@livediagram/diagram';
import { Dialog } from '@/components/dialogs/Dialog';
import { CloseIcon } from '@/components/primitives/CloseIcon';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { TeamListItem } from '@/lib/api-client';
import type { SaveActionInput } from '@/hooks/collab/useEditorActions';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { useAssigneeOptions } from '@/hooks/collab/useAssigneeOptions';
import {
  AssigneePicker,
  type PickableMember,
} from '@/components/dialogs/AssignActionAssigneePicker';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import { clerkEnabled } from '@/lib/clerk-config';
import { track } from '@/lib/telemetry';

// Assign Action dialog (spec/68 §2). The picker always offers a pinned
// **Myself** row (the feature is not sign-in gated: a signed-out user can
// assign an action to themselves as a personal to-do), then the joined
// members of every team the signed-in user has joined. Also serves as the
// edit form (prefilled from the element's existing action); on an edit
// that changes the assignee the email offer returns for the NEW assignee,
// and an edit that keeps the assignee never sends email (the hook
// enforces it, the control hides to match).
//
// The email offer is the shared iOS-style ToggleSwitch, default on, and
// is hidden entirely for a self-assignment — you don't email yourself
// about your own action. Picking a teammate also fires a REAL access
// check (spec/68 §4) so the "can't open this diagram" hint only shows
// when the server says so.

type AssignActionDialogProps = {
  open: boolean;
  // The element's current action when editing; null when assigning fresh.
  existing: ElementAction | null;
  // The element's own text (label / first table cell), used as the
  // default action name on create so it reads as the work item it sits
  // on. Null for an unlabelled element (the field starts empty).
  elementLabel: string | null;
  // Teams the current user has joined (useTeams already filters to
  // joined memberships server-side via listTeamsByUser).
  teams: TeamListItem[];
  // The signed-in Clerk id, or null for a guest session (guests get the
  // Myself-only picker).
  ownerId: string | null;
  // The assigner's identity: the Clerk account, or the guest participant
  // identity (spec/04). Drives the Myself row.
  selfUserId: string | null;
  selfName: string | null;
  // The diagram's id + team-library team (null team for a personal
  // diagram). Drive the access check: picking a teammate asks the server
  // whether they can actually open this diagram (spec/68 §4).
  diagramId: string | null;
  diagramTeamId: string | null;
  // capabilities.emailEnabled — hides the email offer on a self-host
  // without Resend (never advertise a send we can't perform).
  emailEnabled: boolean;
  // Inline personal-diagram fix (spec/68 §2): file the diagram into the
  // picked team's library root so teammates become assignable without an
  // Explorer round-trip. Resolves false on failure (the picker shows a
  // retry-able error line).
  onMoveToTeam?: (teamId: string) => Promise<boolean>;
  onSubmit: (input: SaveActionInput) => void;
  onClose: () => void;
};

export function AssignActionDialog({
  open,
  existing,
  elementLabel,
  teams,
  onMoveToTeam,
  ownerId,
  selfUserId,
  selfName,
  diagramId,
  diagramTeamId,
  emailEnabled,
  onSubmit,
  onClose,
}: AssignActionDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState<PickableMember | null>(null);
  const [notifyEmail, setNotifyEmail] = useState(true);
  // The team id mid inline move (spec/68 §2 personal-diagram fix), and
  // whether the last attempt failed.
  const [movingToTeamId, setMovingToTeamId] = useState<string | null>(null);
  const [moveFailed, setMoveFailed] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const { signInHref } = useAuthHrefs();

  const signedIn = ownerId !== null;
  // The assignee dataset (Myself row, team members incl. invited, the
  // preselect-on-edit, the per-pick access check, and the by-team
  // grouping) lives in useAssigneeOptions.
  const { selfRow, members, grouped, memberOfDiagramTeam, assigneeAccess } = useAssigneeOptions({
    open,
    existing,
    teams,
    ownerId,
    selfUserId,
    selfName,
    diagramId,
    diagramTeamId,
    assignee,
    setAssignee,
  });

  // Re-seed per open: a reopened dialog must show the CURRENT action (or
  // the create defaults), never the previous attempt. Creating defaults
  // the name to the element's own text (selected, so typing replaces it)
  // and preselects Myself — the common self-assignment is zero-click.
  // The email offer re-defaults to on each time (spec/68: default on; it
  // only renders for a non-self assignee anyway).
  // selfRow via a ref so a late identity settle (Clerk name resolving
  // after the dialog opened) can't re-run the seed and wipe mid-typing
  // edits.
  const selfRowRef = useRef(selfRow);
  selfRowRef.current = selfRow;
  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? elementLabel ?? '');
    setDescription(existing?.description ?? '');
    setAssignee(existing ? null : selfRowRef.current);
    setNotifyEmail(true);
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [open, existing, elementLabel]);

  // Signed-out impression: the Myself-only picker with the sign-in
  // nudge. One emit per open so the funnel is measurable (spec/22).
  useEffect(() => {
    if (open && !signedIn && clerkEnabled) track('UI', 'Opened', 'ActionSignInNudge');
  }, [open, signedIn]);

  const editing = existing !== null;
  // The email offer matters on create, and on an edit that picks a NEW
  // assignee; an edit that keeps the assignee sends nothing (spec/68 §3).
  // Hidden entirely for a self-assignment: you don't email yourself
  // about your own action.
  const assigneeChanged =
    !editing ||
    (assignee !== null &&
      (assignee.userId !== existing.assignee.userId ||
        assignee.memberId !== existing.assignee.memberId));
  const showEmailControl =
    emailEnabled &&
    assignee !== null &&
    assignee.teamId !== null &&
    !(assignee.userId !== null && assignee.userId === selfUserId) &&
    assigneeChanged;
  // Access hint (spec/68 §4): a definite server "no" gets definite
  // wording; a failed check falls back to the picked-team heuristic with
  // hedged wording; in-flight / yes / Myself shows nothing.
  const showAccessHint =
    assignee !== null &&
    !(assignee.userId !== null && assignee.userId === selfUserId) &&
    (assigneeAccess === 'no' ||
      assigneeAccess === 'invited' ||
      (assigneeAccess === 'error' && assignee.teamId !== diagramTeamId));

  const canSubmit = name.trim().length > 0 && assignee !== null;
  const submit = () => {
    if (!assignee || !name.trim()) {
      nameRef.current?.focus();
      return;
    }
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      assignee: {
        userId: assignee.userId,
        ...(assignee.memberId ? { memberId: assignee.memberId } : {}),
        name: assignee.name,
      },
      teamId: assignee.teamId,
      notifyEmail: showEmailControl && notifyEmail,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} titleId="assign-action-title">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="border-b border-slate-100 px-6 pb-5 pt-5 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="assign-action-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-50"
            >
              {editing ? 'Edit action' : 'Assign an action'}
            </h2>
            <div className="-mr-1.5 -mt-0.5 flex items-center gap-0.5">
              <HelpArticleLink
                article="assignedActions"
                variant="icon"
                title="Assigned actions"
                description="Assign work on an element to yourself or a teammate and track it until done."
              />
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {editing
              ? 'Change what needs doing, or hand it to someone else.'
              : 'Attach a piece of work to this element — for yourself, or a teammate.'}
          </p>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Action name
            </span>
            <TextInput
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Confirm the retry budget"
              maxLength={200}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Description <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Any detail the assignee needs…"
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </label>

          <AssigneePicker
            signedIn={signedIn}
            selfRow={selfRow}
            grouped={grouped}
            members={members}
            memberOfDiagramTeam={memberOfDiagramTeam}
            diagramTeamId={diagramTeamId}
            assignee={assignee}
            onPick={setAssignee}
            signInHref={signInHref}
            teams={teams}
            movingToTeamId={movingToTeamId}
            moveFailed={moveFailed}
            onMoveToTeam={
              onMoveToTeam
                ? (teamId) => {
                    setMoveFailed(false);
                    setMovingToTeamId(teamId);
                    void onMoveToTeam(teamId).then((ok) => {
                      setMovingToTeamId(null);
                      if (!ok) setMoveFailed(true);
                      else track('Action', 'Moved', 'DiagramToTeam');
                    });
                  }
                : undefined
            }
          />

          {showAccessHint ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              {assigneeAccess === 'invited' ? (
                // Informational, not a warning: access arrives with the
                // invite acceptance, no owner action needed.
                <>
                  {assignee?.name} hasn&apos;t accepted the team invite yet — they&apos;ll get
                  access to this diagram when they join.
                </>
              ) : (
                <>
                  {assignee?.name}{' '}
                  {assigneeAccess === 'no'
                    ? "can't open this diagram yet"
                    : 'may not be able to open this diagram'}
                  : share it or move it to the team library.
                </>
              )}
            </p>
          ) : null}

          {showEmailControl ? (
            <button
              type="button"
              onClick={() => setNotifyEmail((v) => !v)}
              aria-pressed={notifyEmail}
              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span>Email {assignee?.name ?? 'them'} about this action</span>
              <ToggleSwitch
                checked={notifyEmail}
                label={`Email ${assignee?.name ?? 'them'} about this action`}
                presentational
              />
            </button>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {editing ? 'Save action' : 'Assign action'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
