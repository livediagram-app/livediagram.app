'use client';

import { useEffect, useRef } from 'react';
import type { Tab } from '@livediagram/diagram';
import { Button } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { DialogHeader } from '@/components/dialogs/DialogHeader';
import { FacilitatorButton } from '@/components/dialogs/CollaboratorFacilitatorButton';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
import { useAppearance } from '@/hooks/ui/useAppearance';
import {
  buildCollaboratorRoster,
  participantBadges,
  rosterSummary,
} from '@/lib/collaborator-roster';
import { statusLabel, type Participant } from '@/lib/identity';
import { relativeSince, useRelativeTimeTick } from '@/lib/relative-time';
import { legibleTabAccent } from '@/lib/tab-accent';

// The Collaborators modal (spec/145): everyone in the diagram, grouped by
// the tab they are on, opened by clicking any avatar in a tab's presence
// stack. Each other tab gets a Go to Tab, each other person a Follow
// (spec/131 moved here from the avatar click). The person whose avatar was
// clicked is highlighted and scrolled into view.

type CollaboratorsDialogProps = {
  participantsByTab: Map<string, Participant[]>;
  tabs: Tab[];
  activeId: string;
  selfId: string;
  selfRole: 'edit' | 'view';
  // Whose avatar opened the modal; highlighted. Null from a "+N" badge.
  focusId: string | null;
  followingId: string | null;
  onGoToTab: (tabId: string) => void;
  onFollow: (participantId: string) => void;
  onStopFollowing: () => void;
  // The facilitator baton (spec/149). `facilitatorId` is a presence id, which
  // is why our OWN row reads `isFacilitator` instead: a client cannot
  // recognise its own presence id, so the two answers arrive by different
  // routes and the row asks the one that applies to it.
  facilitatorId: string | null;
  isFacilitator: boolean;
  /** Whether we own this diagram: the one person who can take a held baton. */
  isOwner: boolean;
  onMakeFacilitator: (participantId: string) => void;
  onTakeFacilitation: () => void;
  onStepDown: () => void;
  onClose: () => void;
};

const TITLE_ID = 'collaborators-dialog-title';

export function CollaboratorsDialog({
  participantsByTab,
  tabs,
  activeId,
  selfId,
  selfRole,
  focusId,
  followingId,
  onGoToTab,
  onFollow,
  onStopFollowing,
  facilitatorId,
  isFacilitator,
  isOwner,
  onMakeFacilitator,
  onTakeFacilitation,
  onStepDown,
  onClose,
}: CollaboratorsDialogProps) {
  // Keeps each row's "Active 2 mins ago" honest while the modal stays open.
  useRelativeTimeTick();
  const { appearance } = useAppearance();
  const isDark = appearance === 'dark';
  const roster = buildCollaboratorRoster({ participantsByTab, tabs, activeId, selfId });
  const focusRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  return (
    // The panel carries the height bound so only the roster scrolls: the header
    // (title, count, close) stays put however long the room gets.
    <Dialog
      open
      onClose={onClose}
      titleId={TITLE_ID}
      size="md"
      className="max-h-[min(36rem,calc(100dvh-2rem))]"
    >
      <DialogHeader
        title={<span id={TITLE_ID}>Collaborators</span>}
        subtitle={rosterSummary(roster)}
      >
        <HelpArticleLink article="livePresence" size="md" />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        {roster.groups.map((group) => (
          <section
            key={group.tab?.id ?? 'another-tab'}
            aria-label={group.tab?.name ?? 'Another Tab'}
          >
            <div className="mb-1.5 flex items-center gap-2">
              {group.tab ? (
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: legibleTabAccent(group.tab, isDark) }}
                />
              ) : null}
              <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {group.tab?.name ?? 'Another Tab'}
              </h3>
              {group.isActive ? (
                <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  You&apos;re Here
                </span>
              ) : group.tab ? (
                <Button
                  variant="secondary"
                  size="xs"
                  className="ml-auto shrink-0"
                  onClick={() => onGoToTab(group.tab!.id)}
                >
                  Go to Tab
                </Button>
              ) : null}
            </div>
            <ul className="flex flex-col">
              {group.participants.map((p) => {
                const isSelf = p.id === selfId;
                const following = followingId === p.id;
                return (
                  <li
                    key={p.id}
                    ref={p.id === focusId ? focusRef : undefined}
                    className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                      p.id === focusId ? 'bg-brand-50 dark:bg-brand-500/10' : ''
                    }`}
                  >
                    <ParticipantAvatar participant={p} size={28} />
                    <div className="min-w-0 flex-1 pl-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {p.name}
                        </span>
                        {participantBadges(p, selfId, selfRole, followingId, {
                          isFacilitator: isSelf ? isFacilitator : p.id === facilitatorId,
                        }).map((b) => (
                          <span
                            key={b}
                            className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {statusLabel(p.status)}
                        {p.lastActiveAt !== undefined && !isSelf
                          ? ` · Active ${relativeSince(p.lastActiveAt)}`
                          : ''}
                      </p>
                    </div>
                    {/* Two verbs on a person's row, and on your own the one
                        that moves the baton to or from you. Self rows carried
                        no button at all before this: taking the baton and
                        stepping down had to live somewhere, and the row for
                        the person doing it is the honest place. */}
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      <FacilitatorButton
                        isSelf={isSelf}
                        name={p.name}
                        canHold={(isSelf ? selfRole : p.role) !== 'view'}
                        theyHoldIt={isSelf ? isFacilitator : p.id === facilitatorId}
                        batonFree={facilitatorId === null && !isFacilitator}
                        iHoldIt={isFacilitator}
                        isOwner={isOwner}
                        onPress={() => {
                          if (isSelf) {
                            if (isFacilitator) onStepDown();
                            else onTakeFacilitation();
                          } else {
                            onMakeFacilitator(p.id);
                          }
                        }}
                      />
                      {isSelf ? null : (
                        <Button
                          variant={following ? 'primary' : 'secondary'}
                          size="xs"
                          aria-pressed={following}
                          aria-label={following ? `Stop following ${p.name}` : `Follow ${p.name}`}
                          onClick={() => (following ? onStopFollowing() : onFollow(p.id))}
                        >
                          {following ? 'Stop Following' : 'Follow'}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
