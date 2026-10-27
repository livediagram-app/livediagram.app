'use client';

import { useEffect, useRef } from 'react';
import type { Tab } from '@liveplanner/project';
import { Button, DialogHeader, DialogCloseButton } from '@liveplanner/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { HideCursorsSwitch } from '@liveworkspace/workbench/components/dialogs/HideCursorsSwitch';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
import { useAppearance } from '@/hooks/ui/useAppearance';
import {
  buildCollaboratorRoster,
  participantBadges,
  collaboratorRowDetail,
  rosterSummary,
} from '@/lib/collaborator-roster';
import type { Participant } from '@/lib/identity';
import { useRelativeNow } from '@/lib/relative-time';
import { legibleTabAccent } from '@/lib/tab-accent';
import type { AccessLevel } from '@liveplanner/api-schema';

// The Collaborators modal (docs/specs/012-collaboration/collaborator-enhancements.md): everyone in the project, grouped by
// the tab they are on, opened by clicking any avatar in a tab's presence
// stack. Each other tab gets a Go to Tab. The person whose avatar was
// clicked is highlighted and scrolled into view.

type CollaboratorsDialogProps = {
  participantsByTab: Map<string, Participant[]>;
  tabs: Tab[];
  activeId: string;
  selfId: string;
  selfRole: AccessLevel;
  // Whose avatar opened the modal; highlighted. Null from a "+N" badge.
  focusId: string | null;
  onGoToTab: (tabId: string) => void;
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
  onGoToTab,
  onClose,
}: CollaboratorsDialogProps) {
  // Keeps each row's "Active 2 mins ago" honest while the modal stays open.
  const now = useRelativeNow();
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
                        {participantBadges(p, selfId, selfRole).map((b) => (
                          <span
                            key={b}
                            className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {collaboratorRowDetail(p, isSelf, now)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {/* Hide Participant Cursors (docs/specs/012-collaboration/collaborator-enhancements.md): the Settings switch,
          one click away when a session gets busy. Outside the scroller, so it stays put however long the room gets. */}
      <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-800">
        <HideCursorsSwitch />
      </div>
    </Dialog>
  );
}
