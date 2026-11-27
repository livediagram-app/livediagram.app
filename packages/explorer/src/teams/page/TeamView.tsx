'use client';

// A team's page in the Explorer (liveworkspace/docs/specs/004-index/one-explorer.md "A team's page"): the header (the
// team's badge, name, plan, who is in it, Copy Link, Invite People and its menu), the tabs (Library, the default, People,
// Usage with Pro on, and for its admins Audit Log), and the open tab. On a phone the menu also holds Help, which leaves the
// Library's one-row toolbar there (Work Tracker 1516). The People tab is drawn here; the Library and the Audit Log come in from
// the caller, which owns the list and loads the log's code only when it is opened.

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { PictureDisc } from '@liveworkspace/ui';
import { avatarFill } from '@liveworkspace/account-menu/initials';
import { initialsOf as personInitials } from '@liveworkspace/model-core/names';
import type { TeamDetails, TeamMember } from '../../data/teams';
import { DEFAULT_TEAM_TAB, TEAM_TABS, type TeamTab } from '../../views';
import { MUTED } from '../../ui/classes';
import { HelpMarkIcon, LinkIcon, PencilIcon, PlusIcon, TrashIcon } from '../../ui/icons';
import { useIsPhone } from '../../explorer/useViewMode';
import { FindField } from '../../ui/FindField';
import { useToast } from '../../ui/Toasts';
import { LogOutIcon } from '../../ui/icons';
import { memberName } from '../rules';
import { initialsOf, teamFacts } from '../team-details';
import { TeamPlan, SpaceProBadge, useTeamTier } from '../TeamPlan';
import { TeamUsage, useTeamSubscription } from './TeamUsage';
import { useTeamActions, type TeamActions } from '../useTeamActions';
import { copyText } from './copy-link';
import { InviteComposer, type InviteComposerHandle } from './InviteComposer';
import { MemberTable, RowMenu, WaitingList } from './PeopleList';
import {
  PEOPLE_FILTER_LABELS,
  PEOPLE_FILTERS,
  peopleCounts,
  shownPeople,
  type PeopleFilter,
} from './people';
import { InviteLinkCard, LeaveTeam, RolesCard } from './TeamSideCards';

export function TeamView({
  details,
  reload,
  viewerId,
  helpHref,
  tab,
  onTab,
  onGone,
  libraryCount,
  library,
  audit,
}: {
  details: TeamDetails;
  reload: () => void;
  viewerId?: string | null;
  helpHref?: string;
  tab: TeamTab;
  onTab: (tab: TeamTab) => void;
  onGone: () => void;
  libraryCount: number | null;
  library: ReactNode;
  audit: ReactNode;
}) {
  const actions = useTeamActions({ details, reload, viewerId, onGone });
  const composer = useRef<InviteComposerHandle>(null);
  // A Member who follows an Audit Log link lands on the Library, as with no tab named: the log is the admins' alone.
  // Usage only while the service has the team (Pro on, answered): a link to it lands on the Library until then.
  const usage = useTeamSubscription(details.team.id) !== null;
  const shown: TeamTab =
    (tab === 'audit' && !actions.admin) || (tab === 'usage' && !usage) ? DEFAULT_TEAM_TAB : tab;
  const invite = () => {
    if (shown !== 'people') onTab('people');
    // After the tab has drawn the field.
    requestAnimationFrame(() => composer.current?.focus());
  };
  return (
    <div className="flex flex-col gap-5" data-team-page={details.team.id}>
      <TeamHeader details={details} actions={actions} onInvite={invite} helpHref={helpHref} />
      <TeamTabs
        tab={shown}
        onTab={onTab}
        admin={actions.admin}
        usage={usage}
        people={details.members.length}
        libraryCount={libraryCount}
      />
      <div role="tabpanel" aria-labelledby={`team-tab-${shown}`} id={`team-panel-${shown}`}>
        {shown === 'people' ? (
          <PeopleTab
            details={details}
            actions={actions}
            reload={reload}
            helpHref={helpHref}
            composer={composer}
          />
        ) : shown === 'library' ? (
          library
        ) : shown === 'usage' ? (
          <TeamUsage teamId={details.team.id} />
        ) : (
          audit
        )}
      </div>
      {actions.dialogs}
    </div>
  );
}

// ---------- Header ----------

function TeamHeader({
  details,
  actions,
  onInvite,
  helpHref,
}: {
  details: TeamDetails;
  actions: TeamActions;
  onInvite: () => void;
  /** The team's help article: a row of the menu on a phone, where the Library's toolbar leaves Help out. */
  helpHref?: string;
}) {
  const phone = useIsPhone();
  const { team } = details;
  const tier = useTeamTier(team.id);
  const toast = useToast();
  const link = details.inviteLink ?? null;
  const joined = details.members.filter((m) => m.status === 'joined');
  const line = [team.organisation, ...teamFacts(details)].filter(Boolean);
  const copyLink = () => {
    if (!link) {
      actions.askLink();
      return;
    }
    void copyText(link.url).then((copied) =>
      copied
        ? toast.show('Link copied. Anyone signed in who opens it joins as a Member.', {
            tone: 'success',
          })
        : actions.askLink(),
    );
  };
  const menu = [
    ...(actions.admin
      ? [
          { label: 'Edit Team', icon: <PencilIcon />, run: actions.askEdit },
          { label: 'Invite Link', icon: <LinkIcon />, run: actions.askLink },
        ]
      : []),
    ...(phone && helpHref
      ? [
          {
            label: 'Help',
            icon: <HelpMarkIcon />,
            run: () => void window.open(helpHref, '_blank', 'noopener,noreferrer'),
          },
        ]
      : []),
    ...(actions.rule.canLeave && actions.me
      ? [{ label: 'Leave Team', icon: <LogOutIcon />, run: actions.askLeave }]
      : []),
    ...(actions.admin
      ? [{ label: 'Delete Team', icon: <TrashIcon />, run: actions.askDelete }]
      : []),
  ];
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      {/* The actions drop under the name when the pane is too narrow for both (a tablet with the sidebar open). */}
      <div className="flex min-w-0 items-center gap-4 sm:min-w-[18rem] sm:flex-1">
        <span
          aria-hidden
          className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-bold text-white shadow-sm max-sm:size-12 max-sm:text-lg"
        >
          {initialsOf(team.name)}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="m-0 min-w-0 truncate text-2xl font-semibold tracking-tight text-slate-900 max-sm:text-xl dark:text-slate-100">
              <bdi>{team.name}</bdi>
            </h1>
            {tier === 'Free' ? (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600">
                <span className="text-optical-line">Free Plan</span>
              </span>
            ) : (
              <SpaceProBadge teamId={team.id} size="md" />
            )}
          </div>
          <p className={`m-0 truncate text-[13px] ${MUTED}`}>
            {line.map((part, i) => (
              <span key={i}>
                {i > 0 ? ' · ' : null}
                <bdi>{part}</bdi>
              </span>
            ))}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 max-sm:flex-wrap">
        <AvatarStack people={joined} isSelf={actions.isSelf} />
        {link || actions.admin ? (
          <button
            type="button"
            onClick={copyLink}
            className="relative touch-target-y inline-flex h-9 cursor-pointer whitespace-nowrap items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 max-sm:flex-1 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <LinkIcon />
            Copy Link
          </button>
        ) : null}
        {actions.admin ? (
          <button
            type="button"
            onClick={onInvite}
            className="relative touch-target-y inline-flex h-9 cursor-pointer whitespace-nowrap items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-700 max-sm:flex-1 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            <PlusIcon />
            Invite People
          </button>
        ) : null}
        {menu.length > 0 ? (
          <span ref={(el) => void (actions.homeRef.current = el?.querySelector('button') ?? null)}>
            <RowMenu label={`${team.name} options`} rows={menu} />
          </span>
        ) : null}
      </div>
    </header>
  );
}

function AvatarStack({
  people,
  isSelf,
}: {
  people: readonly TeamMember[];
  isSelf: (m: TeamMember) => boolean;
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, 4);
  const more = people.length - shown.length;
  return (
    <span className="mr-1 flex items-center max-sm:hidden" aria-hidden>
      {shown.map((m) => {
        const name = memberName(m, isSelf(m));
        return (
          <PictureDisc
            key={m.id}
            pictureUrl={m.picture}
            name={name}
            size={30}
            style={{ backgroundColor: avatarFill(name, m.color) }}
            className="-ml-1.5 flex shrink-0 text-[10px] font-semibold text-white ring-2 ring-white first:ml-0 dark:ring-slate-900"
          >
            {personInitials(name, m.email)}
          </PictureDisc>
        );
      })}
      {more > 0 ? (
        <span className="-ml-1.5 inline-flex size-[30px] items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700 ring-2 ring-white dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-900">
          <span className="text-optical-line">+{more}</span>
        </span>
      ) : null}
    </span>
  );
}

// ---------- Tabs ----------

const TAB_LABELS: Record<TeamTab, string> = {
  people: 'People',
  library: 'Library',
  usage: 'Usage',
  audit: 'Audit Log',
};

function TeamTabs({
  tab,
  onTab,
  admin,
  usage,
  people,
  libraryCount,
}: {
  tab: TeamTab;
  onTab: (tab: TeamTab) => void;
  admin: boolean;
  /** Whether the Usage tab shows (Pro on, and the service has the team). */
  usage: boolean;
  people: number;
  libraryCount: number | null;
}) {
  // Library, People, Usage (with Pro on), then (admins) Audit Log: the order of TEAM_TABS.
  const tabs: TeamTab[] = TEAM_TABS.filter(
    (t) => (t !== 'audit' || admin) && (t !== 'usage' || usage),
  );
  const counts: Partial<Record<TeamTab, number | null>> = { people, library: libraryCount };
  const refs = useRef<Partial<Record<TeamTab, HTMLButtonElement | null>>>({});
  // Arrow keys move between the tabs (the WAI-ARIA tabs pattern, activating as they move).
  const step = (from: TeamTab, by: number) => {
    const next = tabs[(tabs.indexOf(from) + by + tabs.length) % tabs.length]!;
    onTab(next);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label="Team"
      className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 [scrollbar-width:none] dark:border-slate-700"
    >
      {tabs.map((t) => {
        const on = t === tab;
        const count = counts[t];
        return (
          <button
            key={t}
            ref={(el) => void (refs.current[t] = el)}
            type="button"
            role="tab"
            id={`team-tab-${t}`}
            aria-selected={on}
            aria-controls={`team-panel-${t}`}
            tabIndex={on ? 0 : -1}
            data-team-tab={t}
            onClick={() => onTab(t)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') step(t, 1);
              else if (e.key === 'ArrowLeft') step(t, -1);
            }}
            className={`-mb-px inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 ${
              on
                ? 'border-brand-600 text-slate-900 dark:border-brand-400 dark:text-white'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            {TAB_LABELS[t]}
            {typeof count === 'number' ? (
              <span
                className={`rounded-full px-1.5 py-px text-[11px] tabular-nums ${
                  on
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="text-optical-line">{count.toLocaleString()}</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------- People ----------

function PeopleTab({
  details,
  actions,
  reload,
  helpHref,
  composer,
}: {
  details: TeamDetails;
  actions: TeamActions;
  reload: () => void;
  helpHref?: string;
  composer: React.RefObject<InviteComposerHandle | null>;
}) {
  const [filter, setFilter] = useState<PeopleFilter>('everyone');
  const [query, setQuery] = useState('');
  const counts = useMemo(() => peopleCounts(details.members), [details.members]);
  const { joined, waiting } = useMemo(
    () => shownPeople(details.members, filter, query, actions.isSelf),
    // isSelf reads the team and the viewer, both in details.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [details, filter, query],
  );
  const nothing = joined.length === 0 && waiting.length === 0;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-4">
        {actions.admin ? (
          <InviteComposer ref={composer} teamId={details.team.id} onInvited={reload} />
        ) : null}
        <section
          aria-label="People"
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-slate-700/60">
            <div
              role="group"
              aria-label="Show"
              className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none]"
            >
              {PEOPLE_FILTERS.map((f) =>
                f === 'pending' && counts.pending === 0 ? null : (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                    className={`relative touch-target-y inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition ${
                      filter === f
                        ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    {PEOPLE_FILTER_LABELS[f]}
                    <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {counts[f]}
                    </span>
                  </button>
                ),
              )}
            </div>
            <FindField
              label="Find a person"
              value={query}
              onChange={setQuery}
              className="flex-[0_1_14rem] max-sm:flex-1"
            />
          </div>
          {nothing ? (
            <p className={`m-0 px-4 py-8 text-center text-sm ${MUTED}`} data-team-no-people="">
              {query ? `No one matches “${query.trim()}”.` : 'No one here yet.'}
            </p>
          ) : (
            <>
              {joined.length > 0 ? <MemberTable members={joined} actions={actions} /> : null}
              <WaitingList invites={waiting} actions={actions} />
            </>
          )}
        </section>
      </div>
      <aside className="flex min-w-0 flex-col gap-4" aria-label="About the team">
        {actions.admin ? (
          <InviteLinkCard link={details.inviteLink ?? null} actions={actions} />
        ) : null}
        <TeamPlan teamId={details.team.id} look="card" />
        <RolesCard helpHref={helpHref} />
        <LeaveTeam actions={actions} />
      </aside>
    </div>
  );
}
