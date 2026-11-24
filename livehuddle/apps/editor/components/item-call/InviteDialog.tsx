'use client';

// Invite to a call (docs/specs/012-collaboration/calls-from-items.md "Invite"): the people who can open the call's item,
// the item's team's joined members and its owner and link visitors, each a row to tick. Send Invites puts the call in
// their Inbox; the index checks again that each can open the item. Loaded on its first open.
import { useEffect, useId, useMemo, useState } from 'react';
import type { SpaceCall } from '@liveworkspace/index-client';
import { ITEM_CALL_INVITES_MAX } from '@liveworkspace/index-client';
import { Button } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { meetingHeroArt } from '@liveworkspace/ui/dialog-hero-art/meeting';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { useToast } from '@/hooks/ui/useToast';
import { apiTeamMembers } from '@/lib/api/team-people';
import { track } from '@/lib/telemetry';

export type Invitee = { id: string; name: string; via: 'team' | 'owner' | 'link' };

type People = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; people: Invitee[] };

const VIA: Record<Invitee['via'], string> = {
  team: 'In the team',
  owner: 'Owner',
  link: 'Opened its link',
};

/** The team's joined members first, then the owner and link visitors, each once, never `self`. */
export function mergeInvitees(
  team: readonly { userId: string | null; name: string | null; status: string }[],
  others: readonly { id: string; name: string | null; via: 'owner' | 'link' }[],
  self: string,
): Invitee[] {
  const out: Invitee[] = [];
  const seen = new Set([self]);
  for (const m of team) {
    if (!m.userId || m.status !== 'joined' || seen.has(m.userId)) continue;
    seen.add(m.userId);
    out.push({ id: m.userId, name: m.name || 'Teammate', via: 'team' });
  }
  for (const p of others) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ id: p.id, name: p.name || 'Someone', via: p.via });
  }
  return out;
}

export function InviteDialog({
  call,
  spaceId,
  accountId,
  onClose,
}: {
  call: SpaceCall;
  spaceId: string;
  accountId: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const toast = useToast();
  const [people, setPeople] = useState<People>({ state: 'loading' });
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let live = true;
    indexClient
      .callInvitePeople(spaceId)
      .then(async ({ teamId, people: others }) => {
        const team = teamId ? await apiTeamMembers(accountId, teamId).catch(() => []) : [];
        if (live) setPeople({ state: 'ready', people: mergeInvitees(team, others, accountId) });
      })
      .catch(() => {
        if (live) setPeople({ state: 'failed' });
      });
    return () => {
      live = false;
    };
  }, [spaceId, accountId]);

  const full = picked.size >= ITEM_CALL_INVITES_MAX;
  const toggle = (id: string) =>
    setPicked((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else if (!full) next.add(id);
      return next;
    });

  const rows = useMemo(() => (people.state === 'ready' ? people.people : []), [people]);

  const send = async () => {
    if (picked.size === 0 || sending) return;
    setSending(true);
    try {
      const { invited } = await indexClient.inviteToCall(spaceId, { people: [...picked] });
      track('UI', 'Created', 'CallInvite');
      toast.success(invited === 1 ? 'Invited 1 person' : `Invited ${invited} people`);
      onClose();
    } catch {
      toast.error('The invites couldn’t be sent. Try again in a moment.');
      setSending(false);
    }
  };

  return (
    <Dialog open onClose={onClose} ariaLabel="Invite to the Call" size="md">
      <HeroDialogHeader
        art={meetingHeroArt}
        titleId={titleId}
        title="Invite to the Call"
        subtitle={`People who can open ${call.item.title || 'the item'} get the call in their Inbox.`}
        onClose={onClose}
      />
      <div className="max-h-[50vh] min-h-32 overflow-y-auto px-2 py-2">
        {people.state === 'loading' ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Finding people…
          </p>
        ) : people.state === 'failed' ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            The people couldn’t be read. Close this and try again.
          </p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Nobody else can open the item yet. Share it first, then invite them.
          </p>
        ) : (
          <ul>
            {rows.map((p) => {
              const on = picked.has(p.id);
              return (
                <li key={p.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 ${!on && full ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!on && full}
                      onChange={() => toggle(p.id)}
                      className="size-4 accent-brand-600"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-slate-100">
                      {p.name}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{VIA[p.via]}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => void send()} busy={sending} disabled={picked.size === 0}>
          {picked.size > 1 ? `Send ${picked.size} Invites` : 'Send Invite'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
