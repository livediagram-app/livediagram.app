'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, TextInput } from '@livediagram/ui';
import type { ElementAction } from '@livediagram/diagram';
import { Dialog } from '@/components/dialogs/Dialog';
import { CloseIcon } from '@/components/primitives/CloseIcon';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { apiGetTeam, type TeamListItem, type TeamMember } from '@/lib/api-client';
import type { SaveActionInput } from '@/hooks/collab/useEditorActions';
import { memberName } from '@/components/panels/team-pane-parts';
import { initialsOf } from '@/lib/identity';

// Assign Action dialog (spec/68 §2): pick a teammate from any team the
// current user has JOINED, name the action, optionally describe it, and
// optionally email the assignee. Also serves as the edit form (prefilled
// from the element's existing action); on an edit that changes the
// assignee the email checkbox is re-offered for the NEW assignee, and an
// edit that keeps the assignee never sends email (the hook enforces it,
// the checkbox hides to match).

type PickableMember = {
  userId: string;
  name: string;
  email: string | null;
  teamId: string;
  teamName: string;
};

type AssignActionDialogProps = {
  open: boolean;
  // The element's current action when editing; null when assigning fresh.
  existing: ElementAction | null;
  // Teams the current user has joined (useTeams already filters to
  // joined memberships server-side via listTeamsByUser).
  teams: TeamListItem[];
  // The signed-in caller (the tile is signed-in only, so both are set
  // whenever the dialog can open).
  ownerId: string | null;
  selfUserId: string | null;
  // The diagram's team-library team (null for a personal diagram), for
  // the access hint: an assignee picked from a team whose library does
  // not hold this diagram may not be able to open it.
  diagramTeamId: string | null;
  // capabilities.emailEnabled — hides the checkbox on a self-host
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
  diagramTeamId,
  emailEnabled,
  onSubmit,
  onClose,
}: AssignActionDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState<PickableMember | null>(null);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [members, setMembers] = useState<PickableMember[] | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Re-seed per open: a reopened dialog must show the CURRENT action (or
  // a blank form), never the previous attempt. The checkbox re-defaults
  // to checked each time (spec/68: default on).
  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? '');
    setDescription(existing?.description ?? '');
    setAssignee(null);
    setNotifyEmail(true);
    nameRef.current?.focus();
  }, [open, existing]);

  // Load the joined members of every joined team once per open. Each
  // team detail is one GET; failures just leave that team's members out
  // (the dialog is not on any critical path).
  useEffect(() => {
    if (!open || !ownerId) return;
    let cancelled = false;
    setMembers(null);
    void Promise.all(
      teams.map(async (team) => {
        try {
          const detail = await apiGetTeam(ownerId, team.id);
          return detail.members
            .filter((m: TeamMember) => m.status === 'joined' && m.userId !== null)
            .map(
              (m: TeamMember): PickableMember => ({
                userId: m.userId!,
                name: memberName(m, m.userId === selfUserId, null),
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
  }, [open, ownerId, teams, selfUserId]);

  // Preselect the existing assignee on edit, once members have loaded
  // (identity by userId; prefer the row from the action's own team).
  useEffect(() => {
    if (!open || !existing || !members) return;
    setAssignee(
      (cur) =>
        cur ??
        members.find(
          (m) => m.userId === existing.assignee.userId && m.teamId === existing.teamId,
        ) ??
        members.find((m) => m.userId === existing.assignee.userId) ??
        null,
    );
  }, [open, existing, members]);

  const grouped = useMemo(() => {
    const byTeam = new Map<string, { teamName: string; members: PickableMember[] }>();
    for (const m of members ?? []) {
      const bucket = byTeam.get(m.teamId) ?? { teamName: m.teamName, members: [] };
      bucket.members.push(m);
      byTeam.set(m.teamId, bucket);
    }
    return [...byTeam.entries()];
  }, [members]);

  const editing = existing !== null;
  // The checkbox matters on create, and on an edit that picks a NEW
  // assignee; an edit that keeps the assignee sends nothing (spec/68 §3).
  const assigneeChanged =
    !editing || (assignee !== null && assignee.userId !== existing.assignee.userId);
  const showEmailCheckbox = emailEnabled && assignee !== null && assigneeChanged;
  // Access hint (spec/68 §4): assigning is allowed on any diagram the
  // assigner can edit, but a teammate picked from a team whose library
  // does not hold this diagram may not be able to open it.
  const showAccessHint = assignee !== null && assignee.teamId !== diagramTeamId;

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
      notifyEmail: showEmailCheckbox && notifyEmail,
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
                description="Assign work on an element to a teammate and track it until done."
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
              : 'Attach a piece of work to this element and hand it to a teammate.'}
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
            {teams.length === 0 ? (
              // No joined teams: nobody to assign to. Point at the
              // Explorer's Teams section rather than rendering a dead
              // picker (spec/68 §2).
              <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                You&apos;re not in a team yet. Actions are assigned to teammates —{' '}
                <a
                  href="/explorer/team"
                  className="font-medium text-brand-600 underline dark:text-brand-400"
                >
                  create or join a team
                </a>{' '}
                first.
              </p>
            ) : members === null ? (
              <p className="px-1 py-3 text-center text-xs text-slate-400 dark:text-slate-500">
                Loading teammates…
              </p>
            ) : members.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No joined teammates yet — invites that haven&apos;t been accepted can&apos;t be
                assigned actions.
              </p>
            ) : (
              <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                {grouped.map(([teamId, group]) => (
                  <div key={teamId}>
                    {grouped.length > 1 ? (
                      <p className="sticky top-0 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {group.teamName}
                      </p>
                    ) : null}
                    {group.members.map((m) => {
                      const selected =
                        assignee?.userId === m.userId && assignee.teamId === m.teamId;
                      return (
                        <button
                          key={`${m.teamId}:${m.userId}`}
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
                            {m.name}
                            {m.userId === selfUserId ? (
                              <span className="text-slate-400 dark:text-slate-500"> (you)</span>
                            ) : null}
                          </span>
                          {selected ? (
                            <span className="shrink-0 text-xs font-medium text-brand-600 dark:text-brand-400">
                              Selected
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {showAccessHint ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              {assignee?.name} may not be able to open this diagram: share it or move it to the team
              library.
            </p>
          ) : null}

          {showEmailCheckbox ? (
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-500"
              />
              Email {assignee?.name ?? 'them'} about this action
            </label>
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
