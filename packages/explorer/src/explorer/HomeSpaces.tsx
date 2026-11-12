'use client';

// Home's Spaces (liveworkspace/docs/specs/004-index/one-explorer.md "Spaces, on Home"): directly under Most Used and Recent, one
// tile per space the person has, My Work then each team, each a link straight into that space's list. A tile is drawn
// as Home's large cards are: a mosaic of the space's newest items (FolderMosaic, the folder cards' own), over the
// space's disc, its name and a line saying how much it holds and when it last changed; a team's adds its member count
// and the faces behind its newest items. One request for every space (useSpacePreviews). On a phone the tiles are one
// strip that snaps tile by tile, as Most Used and Recent's is; from `md` a grid of two, of four from `lg`.

import { useId, useMemo, useState, type ReactNode } from 'react';
import { APP_KINDS, type SpacePreview } from '@liveworkspace/index-client';
import { useSpacePreviews } from '../data/useSpacePreviews';
import { usePersonName } from '../data/usePeople';
import { initialsOf } from '../teams/TeamCard';
import { useTeams } from '../teams/context';
import { NewTeamDialog } from '../teams/NewTeamDialog';
import { useNow } from '../time';
import { FOCUS_RING, MUTED, SKELETON } from '../ui/classes';
import { ChevronDownIcon, MyWorkIcon, PlusIcon, TeamIcon } from '../ui/icons';
import { SIDEBAR_LABELS, type ExplorerView } from '../views';
import type { ThisBrowserItem } from '../this-browser';
import { BrowserIcon } from './host';
import { LocalPreview } from './LocalPreview';
import { useThisBrowserSpace } from './this-browser-space/space';
import type { Words } from '../words';
import { useExplorer } from './context';
import { useExtras } from './extras';
import { FolderMosaic } from './FolderMosaic';
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
import {
  CARD_NAME,
  CARD_SURFACE,
  HomeFailed,
  HomeSection,
  PANEL_SURFACE,
  THUMB_EDGE,
} from './HomeSection';
import { Avatar } from './Avatar';

// A strip below `md` (each tile 15rem, the next peeking, snapping tile by tile), a grid of two from `md`, four from `lg`.
const LIST =
  '-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:scroll-px-0 sm:px-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:p-0 lg:grid-cols-4';
const ITEM = 'flex w-[15rem] min-w-0 shrink-0 snap-start md:w-auto';
const TILE = `group flex w-full min-w-0 flex-col gap-2.5 rounded-[18px] p-2 pb-3 text-left ${CARD_SURFACE} ${FOCUS_RING}`;
// A tile that makes or asks rather than opens: the same footprint, dashed, its words centred.
const DASHED = `group flex min-h-[11.25rem] w-full min-w-0 flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-slate-300 p-4 text-center transition duration-micro hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-600 dark:hover:border-brand-400/60 dark:hover:bg-brand-400/[0.06] ${FOCUS_RING}`;
const MOSAIC = `relative h-28 w-full rounded-xl ${THUMB_EDGE}`;
// Readable over the mosaic, as Most Used and Recent's menu chip is.
const CHIP =
  'absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900/90 dark:text-slate-200 dark:ring-slate-700';

export function HomeSpaces() {
  const { app, client, filter, epoch, teams, words, viewerId } = useExplorer();
  const { myTeams, canRun } = useTeams();
  const { signedIn, signInHref } = useExtras();
  const [all, setAll] = useState(false);
  const [newTeam, setNewTeam] = useState(false);
  const shownApp = filter === 'all' ? null : app;
  const teamsKey = useMemo(() => teams.map((t) => t.id).join(','), [teams]);
  const previews = useSpacePreviews({ client, app: shownApp, epoch, teamsKey });
  const spaces = useMemo(() => orderSpaces(teams, previews.byTeam), [teams, previews.byTeam]);
  const members = useMemo(
    () => new Map(myTeams?.teams.map((t) => [t.id, t.memberCount])),
    [myTeams],
  );
  const title =
    APP_KINDS[app] === 'space' ? SPACES_COPY.titleWhereItemsAreSpaces : SPACES_COPY.title;
  // This Browser after the teams, while it holds anything (one-explorer.md "This Browser, a Space"): read from this
  // browser, so it costs no request.
  const local = useThisBrowserSpace();
  const total = spaces.length + (local.holds ? 1 : 0);
  const overflow = total > SPACES_SHOWN;
  const room = overflow && !all ? SPACES_SHOWN - 1 : total;
  const shown = spaces.slice(0, room);
  const showLocal = local.holds && room > spaces.length;
  // With no team yet: where one is made, or where signing in is.
  const guest = !signedIn && Boolean(signInHref);
  const invite = teams.length === 0 ? (canRun ? 'create' : guest ? 'sign-in' : null) : null;

  return (
    <HomeSection id="spaces" title={title} busy={previews.loading}>
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
        className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-100 dark:bg-brand-400/10 dark:text-brand-300 dark:group-hover:bg-brand-400/20"
      >
        {icon}
      </span>
      <span className="text-[15px] font-semibold leading-5 text-[#17153a] dark:text-slate-100">
        {title}
      </span>
      {lead ? (
        <span className={`max-w-[14rem] text-[12.5px] leading-[18px] ${MUTED}`}>{lead}</span>
      ) : null}
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
      <span aria-hidden className={`${MOSAIC} ${tone.wash}`}>
        {shownPreview ? (
          <FolderMosaic
            preview={{
              folderId: space.teamId ?? 'mine',
              itemCount: shownPreview.itemCount,
              items: shownPreview.items,
            }}
            subfolders={[]}
          />
        ) : (
          <span className={`[&_svg]:size-7 ${MUTED} opacity-60`}>
            {space.teamId === null ? <MyWorkIcon /> : <TeamIcon />}
          </span>
        )}
        {team ? (
          <span className={CHIP}>
            <TeamIcon size={11} />
            {team} members
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 items-center gap-2.5 px-1">
        <SpaceDisc className={tone.disc}>
          {space.teamId === null ? <MyWorkIcon /> : initialsOf(space.name)}
        </SpaceDisc>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`${CARD_NAME} text-[15px] leading-5`}>{space.name}</span>
          <span
            id={lineId}
            className={`block h-[18px] truncate text-[12.5px] leading-[18px] ${MUTED}`}
          >
            {line}
            {team ? <span className="sr-only">{`, ${team} members`}</span> : null}
          </span>
        </span>
        {space.teamId ? <SpaceFaces ids={spaceFaces(preview, viewerId)} /> : null}
      </span>
    </a>
  );
}

/** This Browser's tile: up to four of its newest items, each the app's picture of a local item, over the teal disc,
 *  its name and a line from the list itself. A link to its view, as the others are. */
function ThisBrowserTile({ live }: { live: readonly ThisBrowserItem[] }) {
  const { viewHref, navigate, kind, app } = useExplorer();
  const now = useNow();
  const lineId = useId();
  const view: ExplorerView = { kind: 'offline' };
  const newest = live.reduce<number | null>(
    (at, i) => (at === null || i.updatedAt > at ? i.updatedAt : at),
    null,
  );
  const line = localSpaceLine(live.length, newest, kind, now || null);
  const shown = live.slice(0, live.length > 4 ? 3 : 4);
  const more = live.length - shown.length;
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
      <span aria-hidden className={`${MOSAIC} ${LOCAL_SPACE_TONE.wash}`}>
        {shown.length > 0 ? (
          <span className="grid h-full w-full grid-cols-2 gap-1.5 p-2">
            {shown.map((item) => (
              <LocalPreview
                key={item.id}
                app={app}
                iconSize={16}
                className={`h-full w-full rounded-lg ${shown.length === 1 ? 'col-span-2' : ''}`}
              />
            ))}
            {more > 0 ? (
              <span
                className={`flex items-center justify-center rounded-lg bg-white/70 text-[13px] font-semibold dark:bg-slate-900/50 ${MUTED}`}
              >
                +{more}
              </span>
            ) : null}
          </span>
        ) : (
          <span className={`[&_svg]:size-7 ${MUTED} opacity-60`}>
            <BrowserIcon />
          </span>
        )}
      </span>
      <span className="flex min-w-0 items-center gap-2.5 px-1">
        <SpaceDisc className={LOCAL_SPACE_TONE.disc}>
          <BrowserIcon />
        </SpaceDisc>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`${CARD_NAME} text-[15px] leading-5`}>{SIDEBAR_LABELS.thisBrowser}</span>
          <span
            id={lineId}
            className={`block h-[18px] truncate text-[12.5px] leading-[18px] ${MUTED}`}
          >
            {line}
          </span>
        </span>
      </span>
    </a>
  );
}

/** A space's glyph (My Work's, This Browser's) or a team's initials, on the space's tone. */
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
        <li key={i} className={ITEM}>
          <div className={`flex w-full flex-col gap-2.5 rounded-[18px] p-2 pb-3 ${PANEL_SURFACE}`}>
            <div className={`h-28 w-full rounded-xl ${SKELETON}`} />
            <div className="flex items-center gap-2.5 px-1">
              <div className={`size-9 shrink-0 rounded-xl ${SKELETON}`} />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className={`h-3.5 w-2/3 ${SKELETON}`} />
                <div className={`h-3 w-1/2 ${SKELETON}`} />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
