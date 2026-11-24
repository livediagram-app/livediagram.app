'use client';

// Home's Spaces (liveworkspace/docs/specs/004-index/one-explorer.md "Spaces, in the rail"): a panel in Home's rail, one
// row per space the person has, My Work then each team, each a link straight into that space's list: the space's disc,
// its name, a line (how much it holds, when the newest changed) and, for a team, the faces behind its newest items.
// Offline's row follows the teams while this browser holds anything. One request for every space's preview
// (useSpacePreviews), whatever the number of spaces.

import { useId, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { APP_KINDS, type SpacePreview } from '@liveworkspace/index-client';
import { useSpacePreviews, type SpacePreviews } from '../data/useSpacePreviews';
import { usePersonName } from '../data/usePeople';
import { initialsOf } from '../teams/team-details';
import { useTeams } from '../teams/context';
import { NewTeamDialog } from './lazy-dialogs';
import { useNow } from '../time';
import { FOCUS_RING, MUTED, SKELETON } from '../ui/classes';
import { ChevronDownIcon, MyWorkIcon, PlusIcon, TeamIcon } from '../ui/icons';
import { SIDEBAR_LABELS, type ExplorerView } from '../views';
import type { ThisBrowserItem } from '../this-browser';
import { BrowserIcon } from './host';
import { useThisBrowserSpace } from './this-browser-space/space';
import { kindWords, type Words } from '../words';
import { useExplorer } from './context';
import { useExtras } from './extras';
import {
  LOCAL_SPACE_TONE,
  localSpaceLine,
  orderSpaces,
  showAllLabel,
  spaceFaces,
  spaceLine,
  SPACES_COPY,
  SPACES_SHOWN,
  spaceTone,
  type SpaceEntry,
} from './home-spaces';
import { CARD_NAME, HomeFailed, HomeSection } from './HomeSection';
import { Avatar } from './Avatar';

// A strip below `md` (each tile 15rem, the next peeking, snapping tile by tile), a grid of two from `md`, four from `lg`.
// The rail's list (one-explorer.md "Spaces, in the rail"): one row per space, its disc, name and line, then the team's
// faces; a row lifts to the hover wash as the rail's other rows do.
const LIST = 'flex flex-col gap-0.5';
const ITEM = 'flex min-w-0';
const TILE = `group flex w-full min-w-0 items-center gap-3 rounded-xl p-2 text-left transition duration-micro hover:bg-slate-100 dark:hover:bg-slate-700/60 ${FOCUS_RING}`;
const DASHED = `group flex w-full min-w-0 items-center gap-3 rounded-xl border border-dashed border-slate-300 p-2 text-left transition duration-micro hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-600 dark:hover:border-brand-400/60 dark:hover:bg-brand-400/[0.06] ${FOCUS_RING}`;

/** Spaces' read, held by HomePane: the previews, the spaces in order, Offline's, and whether all of it is empty. */
export type HomeSpacesState = {
  previews: SpacePreviews;
  spaces: SpaceEntry[];
  local: ReturnType<typeof useThisBrowserSpace>;
  /** Answered, and no space (nor Offline) holds anything: the section is left out. */
  empty: boolean;
};

export function useHomeSpaces(): HomeSpacesState {
  const { app, client, filter, epoch, teams, overlay } = useExplorer();
  const shownApp = filter === 'all' ? null : app;
  const teamsKey = useMemo(() => teams.map((t) => t.id).join(','), [teams]);
  // A card trashed, archived, moved or restored here changes what a space holds: once the index has taken it, the
  // previews are asked again (keeping the tiles on screen until the answer lands), so a count never lags the cards.
  const placed = useSyncExternalStore(
    overlay.subscribe,
    overlay.placesSettled,
    overlay.placesSettled,
  );
  const previews = useSpacePreviews({
    client,
    app: shownApp,
    epoch,
    teamsKey,
    placed,
  });
  const spaces = useMemo(() => orderSpaces(teams, previews.byTeam), [teams, previews.byTeam]);
  // Offline after the teams, while it holds anything (one-explorer.md "Offline, a Space"): read from this
  // browser, so it costs no request.
  const local = useThisBrowserSpace();
  const empty =
    !previews.loading &&
    !previews.error &&
    !local.holds &&
    spaces.every((s) => (s.preview?.itemCount ?? 0) === 0);
  return { previews, spaces, local, empty };
}

export function HomeSpaces({ state }: { state: HomeSpacesState }) {
  const { app, teams, words, viewerId } = useExplorer();
  const { myTeams, canRun } = useTeams();
  const { signedIn, signInHref } = useExtras();
  const [all, setAll] = useState(false);
  const [newTeam, setNewTeam] = useState(false);
  const { previews, spaces, local } = state;
  const members = useMemo(
    () => new Map(myTeams?.teams.map((t) => [t.id, t.memberCount])),
    [myTeams],
  );
  const title =
    APP_KINDS[app] === 'space' ? SPACES_COPY.titleWhereItemsAreSpaces : SPACES_COPY.title;
  const total = spaces.length + (local.holds ? 1 : 0);
  const overflow = total > SPACES_SHOWN;
  const room = overflow && !all ? SPACES_SHOWN - 1 : total;
  const shown = spaces.slice(0, room);
  const showLocal = local.holds && room > spaces.length;
  // With no team yet: where one is made, or where signing in is.
  const guest = !signedIn && Boolean(signInHref);
  const invite = teams.length === 0 ? (canRun ? 'create' : guest ? 'sign-in' : null) : null;
  if (state.empty) return null;

  return (
    <HomeSection id="spaces" title={title} busy={previews.loading} panel>
      {previews.loading ? (
        <SpacesSkeleton count={Math.min(SPACES_SHOWN, total + (invite ? 1 : 0))} />
      ) : (
        <div className="flex flex-col gap-3">
          <ul className={LIST} data-home-spaces="">
            {shown.map((space) => (
              <li key={space.teamId ?? 'mine'} className={ITEM}>
                <SpaceTile
                  space={space}
                  members={space.teamId ? members.get(space.teamId) : undefined}
                  failed={previews.error}
                  words={words}
                  viewerId={viewerId}
                />
              </li>
            ))}
            {showLocal ? (
              <li className={ITEM}>
                <ThisBrowserTile live={local.live} />
              </li>
            ) : null}
            {invite === 'create' ? (
              <li className={ITEM}>
                <button type="button" className={DASHED} onClick={() => setNewTeam(true)}>
                  <InviteBody
                    icon={<PlusIcon size={16} />}
                    title={SPACES_COPY.createTeam}
                    lead={`Work together on shared ${words.lowerMany}.`}
                  />
                </button>
              </li>
            ) : invite === 'sign-in' ? (
              <li className={ITEM}>
                <a href={signInHref} className={DASHED} data-spaces-sign-in="">
                  <InviteBody
                    icon={<TeamIcon size={16} />}
                    title={SPACES_COPY.signIn}
                    lead={`Free, and your guest ${words.lowerMany} come with you.`}
                  />
                </a>
              </li>
            ) : null}
            {overflow ? (
              <li className={ITEM}>
                <button
                  type="button"
                  className={DASHED}
                  aria-expanded={all}
                  onClick={() => setAll((open) => !open)}
                >
                  <InviteBody
                    icon={
                      <span className={`transition-transform ${all ? 'rotate-180' : ''}`}>
                        <ChevronDownIcon size={16} />
                      </span>
                    }
                    title={all ? SPACES_COPY.showFewer : showAllLabel(total, title)}
                    lead={all ? undefined : `${total - room} more after these.`}
                  />
                </button>
              </li>
            ) : null}
          </ul>
          {previews.error ? (
            <HomeFailed message={SPACES_COPY.failed} onRetry={previews.retry} />
          ) : null}
        </div>
      )}
      {newTeam ? <NewTeamDialogTo onClose={() => setNewTeam(false)} /> : null}
    </HomeSection>
  );
}

function NewTeamDialogTo({ onClose }: { onClose: () => void }) {
  const { navigate } = useExplorer();
  return (
    <NewTeamDialog onClose={onClose} onMade={(team) => navigate({ kind: 'team', id: team.id })} />
  );
}

function InviteBody({ icon, title, lead }: { icon: ReactNode; title: string; lead?: string }) {
  return (
    <>
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-100 dark:bg-brand-400/10 dark:text-brand-300 dark:group-hover:bg-brand-400/20"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold leading-5 text-[#17153a] dark:text-slate-100">
          {title}
        </span>
        {lead ? <span className={`text-xs leading-4 ${MUTED}`}>{lead}</span> : null}
      </span>
    </>
  );
}

function SpaceTile({
  space,
  members,
  failed,
  words,
  viewerId,
}: {
  space: SpaceEntry;
  members: number | undefined;
  failed: boolean;
  words: Words;
  viewerId: string | null;
}) {
  const { viewHref, navigate } = useExplorer();
  const now = useNow();
  const lineId = useId();
  const view: ExplorerView =
    space.teamId === null ? { kind: 'all' } : { kind: 'team', id: space.teamId };
  const tone = spaceTone(space.teamId);
  const preview = space.preview;
  // Answered with nothing for a team (one made since the token): it holds nothing yet.
  const shownPreview: SpacePreview | null =
    preview ?? (failed ? null : { teamId: space.teamId, itemCount: 0, items: [] });
  const line = shownPreview ? spaceLine(shownPreview, words, now || null) : '';
  const team = members !== undefined && members > 1 ? members : undefined;
  return (
    <a
      href={viewHref(view)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(view);
      }}
      aria-label={space.name}
      aria-describedby={lineId}
      data-space-tile={space.teamId ?? 'mine'}
      className={TILE}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <SpaceDisc className={tone.disc}>
          {space.teamId === null ? <MyWorkIcon /> : initialsOf(space.name)}
        </SpaceDisc>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`${CARD_NAME} text-sm leading-5`}>{space.name}</span>
          <span id={lineId} className={`block h-4 truncate text-xs leading-4 ${MUTED}`}>
            {line}
            {team ? <span className="sr-only">{`, ${team} members`}</span> : null}
          </span>
        </span>
        {space.teamId ? <SpaceFaces ids={spaceFaces(preview, viewerId)} /> : null}
      </span>
    </a>
  );
}

/** Offline's row: the teal disc, its name and a line from the list itself. A link to its view, as the others are. */
function ThisBrowserTile({ live }: { live: readonly ThisBrowserItem[] }) {
  const { viewHref, navigate, app } = useExplorer();
  // Offline keeps the app's own items, so its line counts them in its words.
  const kind = kindWords(app);
  const now = useNow();
  const lineId = useId();
  const view: ExplorerView = { kind: 'offline' };
  const newest = live.reduce<number | null>(
    (at, i) => (at === null || i.updatedAt > at ? i.updatedAt : at),
    null,
  );
  const line = localSpaceLine(live.length, newest, kind, now || null);
  return (
    <a
      href={viewHref(view)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(view);
      }}
      aria-label={SIDEBAR_LABELS.thisBrowser}
      aria-describedby={lineId}
      data-space-tile="this-browser"
      className={TILE}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <SpaceDisc className={LOCAL_SPACE_TONE.disc}>
          <BrowserIcon />
        </SpaceDisc>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`${CARD_NAME} text-sm leading-5`}>{SIDEBAR_LABELS.thisBrowser}</span>
          <span id={lineId} className={`block h-4 truncate text-xs leading-4 ${MUTED}`}>
            {line}
          </span>
        </span>
      </span>
    </a>
  );
}

/** A space's glyph (My Work's, Offline's) or a team's initials, on the space's tone. */
function SpaceDisc({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={`grid size-9 shrink-0 place-items-center rounded-xl text-[13px] font-bold tracking-tight ${className} [&_svg]:size-4`}
    >
      {children}
    </span>
  );
}

/** Up to three faces of the people behind a team's newest items, their names its tooltip. */
function SpaceFaces({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <span aria-hidden className="flex shrink-0 -space-x-2" data-space-faces={ids.length}>
      {ids.map((id) => (
        <Face key={id} id={id} />
      ))}
    </span>
  );
}

function Face({ id }: { id: string }) {
  const { people } = useExtras();
  const name = usePersonName(people, id) ?? '';
  return (
    <span title={name || undefined} className="inline-flex">
      <Avatar person={{ id, name }} size={22} />
    </span>
  );
}

function SpacesSkeleton({ count }: { count: number }) {
  return (
    <ul aria-hidden className={LIST} data-home-spaces-skeleton="">
      {Array.from({ length: Math.max(1, count) }, (_, i) => (
        <li key={i} className="flex items-center gap-3 p-2">
          <div className={`size-9 shrink-0 rounded-xl ${SKELETON}`} />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className={`h-3.5 w-2/3 ${SKELETON}`} />
            <div className={`h-3 w-1/2 ${SKELETON}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}
