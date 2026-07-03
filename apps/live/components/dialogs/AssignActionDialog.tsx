'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, TextInput } from '@livediagram/ui';
import type { ElementAction } from '@livediagram/diagram';
import { Dialog } from '@/components/dialogs/Dialog';
import { CloseIcon } from '@/components/primitives/CloseIcon';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import {
  apiCheckAssigneeAccess,
  apiGetTeam,
  type TeamListItem,
  type TeamMember,
} from '@/lib/api-client';
import type { SaveActionInput } from '@/hooks/collab/useEditorActions';
import { memberName } from '@/components/panels/team-pane-parts';
import { initialsOf } from '@/lib/identity';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
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

type PickableMember = {
  userId: string;
  name: string;
  email: string | null;
  // Null for the pinned Myself row (no team involved, no email).
  teamId: string | null;
  teamName: string | null;
};

type AssignActionDialogProps = {
  open: boolean;
  // The element's current action when editing; null when assigning fresh.
  existing: ElementAction | null;
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
  onSubmit: (input: SaveActionInput) => void;
  onClose: () => void;
};

export function AssignActionDialog({
  open,
  existing,
  teams,
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
  // Whether the picked teammate can actually open this diagram
  // (spec/68 §4): asked of the server per selection. 'unknown' while in
  // flight (show nothing); 'error' falls back to the picked-team
  // heuristic with hedged wording.
  const [assigneeAccess, setAssigneeAccess] = useState<'unknown' | 'yes' | 'no' | 'error'>(
    'unknown',
  );
  const [members, setMembers] = useState<PickableMember[] | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const { signInHref } = useAuthHrefs();

  const signedIn = ownerId !== null;
  // The pinned Myself row: every session has one once identity has
  // hydrated (Clerk account or guest participant id).
  const selfRow = useMemo<PickableMember | null>(
    () =>
      selfUserId
        ? {
            userId: selfUserId,
            name: selfName?.trim() || 'Me',
            email: null,
            teamId: null,
            teamName: null,
          }
        : null,
    [selfUserId, selfName],
  );

  // Re-seed per open: a reopened dialog must show the CURRENT action (or
  // a blank form), never the previous attempt. The email offer
  // re-defaults to on each time (spec/68: default on; it only renders
  // for a non-self assignee anyway).
  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? '');
    setDescription(existing?.description ?? '');
    setAssignee(null);
    setNotifyEmail(true);
    nameRef.current?.focus();
  }, [open, existing]);

  // Signed-out impression: the Myself-only picker with the sign-in
  // nudge. One emit per open so the funnel is measurable (spec/22).
  useEffect(() => {
    if (open && !signedIn && clerkEnabled) track('UI', 'Opened', 'ActionSignInNudge');
  }, [open, signedIn]);

  // Load the joined members of every joined team once per open
  // (signed-in only; a guest picker is Myself alone). Each team detail
  // is one GET; failures just leave that team's members out.
  useEffect(() => {
    if (!open) return;
    if (!ownerId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    setMembers(null);
    void Promise.all(
      teams.map(async (team) => {
        try {
          const detail = await apiGetTeam(ownerId, team.id);
          return detail.members
            .filter(
              // Joined, connected members only — and not the assigner
              // themselves, whom the pinned Myself row already covers.
              (m: TeamMember) => m.status === 'joined' && m.userId !== null && m.userId !== ownerId,
            )
            .map(
              (m: TeamMember): PickableMember => ({
                userId: m.userId!,
                name: memberName(m, false, null),
                email: m.email,
                teamId: team.id,
                teamName: team.name,
              }),
            );
        } catch {
          return [];
        }
      }),
    ).then((lists) => {
      if (!cancelled) setMembers(lists.flat());
    });
    return () => {
      cancelled = true;
    };
  }, [open, ownerId, teams]);

  // Preselect the existing assignee on edit: the Myself row when the
  // action is self-assigned, else the matching member row once loaded
  // (prefer the row from the action's own team).
  useEffect(() => {
    if (!open || !existing) return;
    if (selfRow && existing.assignee.userId === selfRow.userId) {
      setAssignee((cur) => cur ?? selfRow);
      return;
    }
    if (!members) return;
    setAssignee(
      (cur) =>
        cur ??
        members.find(
          (m) => m.userId === existing.assignee.userId && m.teamId === existing.teamId,
        ) ??
        members.find((m) => m.userId === existing.assignee.userId) ??
        null,
    );
  }, [open, existing, members, selfRow]);

  // Ask the server whether the picked teammate can open this diagram.
  // Self-assignment short-circuits to yes (the assigner is right here,
  // editing it). Stale responses are ignored via the cancelled flag.
  useEffect(() => {
    if (!open || !assignee) return;
    setAssigneeAccess('unknown');
    if (assignee.userId === selfUserId) {
      setAssigneeAccess('yes');
      return;
    }
    if (!ownerId || !diagramId || !assignee.teamId) {
      setAssigneeAccess('error');
      return;
    }
    let cancelled = false;
    void apiCheckAssigneeAccess(ownerId, assignee.teamId, {
      assigneeUserId: assignee.userId,
      diagramId,
    }).then((canAccess) => {
      if (cancelled) return;
      setAssigneeAccess(canAccess === null ? 'error' : canAccess ? 'yes' : 'no');
    });
    return () => {
      cancelled = true;
    };
  }, [open, assignee, ownerId, diagramId, selfUserId]);

  const grouped = useMemo(() => {
    const byTeam = new Map<string, { teamName: string; members: PickableMember[] }>();
    for (const m of members ?? []) {
      if (m.teamId === null) continue;
      const bucket = byTeam.get(m.teamId) ?? { teamName: m.teamName ?? '', members: [] };
      bucket.members.push(m);
      byTeam.set(m.teamId, bucket);
    }
    return [...byTeam.entries()];
  }, [members]);

  const editing = existing !== null;
  // The email offer matters on create, and on an edit that picks a NEW
  // assignee; an edit that keeps the assignee sends nothing (spec/68 §3).
  // Hidden entirely for a self-assignment: you don't email yourself
  // about your own action.
  const assigneeChanged =
    !editing || (assignee !== null && assignee.userId !== existing.assignee.userId);
  const showEmailControl =
    emailEnabled &&
    assignee !== null &&
    assignee.teamId !== null &&
    assignee.userId !== selfUserId &&
    assigneeChanged;
  // Access hint (spec/68 §4): a definite server "no" gets definite
  // wording; a failed check falls back to the picked-team heuristic with
  // hedged wording; in-flight / yes / Myself shows nothing.
  const showAccessHint =
    assignee !== null &&
    assignee.userId !== selfUserId &&
    (assigneeAccess === 'no' || (assigneeAccess === 'error' && assignee.teamId !== diagramTeamId));

  const canSubmit = name.trim().length > 0 && assignee !== null;
  const submit = () => {
    if (!assignee || !name.trim()) {
      nameRef.current?.focus();
      return;
    }
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      assignee: { userId: assignee.userId, name: assignee.name },
      teamId: assignee.teamId,
      notifyEmail: showEmailControl && notifyEmail,
    });
  };

  const assigneeRow = (m: PickableMember, isSelf: boolean) => {
    const selected = assignee?.userId === m.userId && assignee.teamId === m.teamId;
    return (
      <button
        key={`${m.teamId ?? 'self'}:${m.userId}`}
        type="button"
        onClick={() => setAssignee(m)}
        aria-pressed={selected}
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
          selected
            ? 'bg-brand-50 dark:bg-brand-500/15'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[10px] font-semibold text-white"
        >
          {initialsOf(m.name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-100">
          {isSelf ? 'Myself' : m.name}
          {isSelf ? <span className="text-slate-400 dark:text-slate-500"> ({m.name})</span> : null}
        </span>
        {selected ? (
          <span className="shrink-0 text-xs font-medium text-brand-600 dark:text-brand-400">
            Selected
          </span>
        ) : null}
      </button>
    );
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

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Assignee</span>
            <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
              {selfRow ? assigneeRow(selfRow, true) : null}
              {grouped.map(([teamId, group]) => (
                <div key={teamId}>
                  <p className="sticky top-0 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {group.teamName}
                  </p>
                  {group.members.map((m) => assigneeRow(m, false))}
                </div>
              ))}
              {signedIn && members === null ? (
                <p className="px-3 py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                  Loading teammates…
                </p>
              ) : null}
            </div>
            {/* Teammate nudges: sign in (guests), join a team (signed-in
                with none), or invite (teams with no other joined member). */}
            {!signedIn && clerkEnabled ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <a
                  href={signInHref}
                  className="font-medium text-brand-600 underline dark:text-brand-400"
                >
                  Sign in
                </a>{' '}
                and join a team to assign actions to teammates.
              </p>
            ) : signedIn && teams.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <a
                  href="/explorer/team"
                  className="font-medium text-brand-600 underline dark:text-brand-400"
                >
                  Create or join a team
                </a>{' '}
                to assign actions to teammates.
              </p>
            ) : signedIn && members !== null && members.length === 0 && teams.length > 0 ? (
              <p className="px-1 text-xs text-slate-400 dark:text-slate-500">
                No joined teammates yet — invites that haven&apos;t been accepted can&apos;t be
                assigned actions.
              </p>
            ) : null}
          </div>

          {showAccessHint ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              {assignee?.name}{' '}
              {assigneeAccess === 'no'
                ? "can't open this diagram yet"
                : 'may not be able to open this diagram'}
              : share it or move it to the team library.
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
