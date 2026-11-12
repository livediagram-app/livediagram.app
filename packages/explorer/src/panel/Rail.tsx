'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { inboxCount } from '../data/useInbox';
import { useExplorer } from '../explorer/context';
import { MyWorkMenu } from '../explorer/menus';
import { BrowserIcon } from '../explorer/host';
import {
  TRASH_BIN,
  TRASH_OVER,
  TRASH_WAITING,
  useDropTarget,
  useTrashTarget,
  type DropPlace,
} from '../drag/drag';
import { useRowMenu } from '../ui/RowMenu';
import {
  ArchiveIcon,
  HomeIcon,
  InboxIcon,
  LibraryIcon,
  MyWorkIcon,
  PlusIcon,
  ShareIcon,
  StarIcon,
  TeamIcon,
  TrashIcon,
} from '../ui/icons';
import { SIDEBAR_LABELS } from '../views';
import { useTeams } from '../teams/context';
import { NewTeamDialog } from '../teams/NewTeamDialog';
import {
  SECTION_GROUP_TITLES,
  sectionKey,
  sectionLabel,
  type PanelSection,
  type PanelSectionGroup,
} from './sections';

// ---- The rail -------------------------------------------------------------------------------------------

// The New button's sizes: in the rail, the panel's control height (h-9, 36 px; 44 px on a touch screen), full width;
// on a phone's chip row, a chip's (36 px to the eye, its tap reaching 44 px).
export const NEW_BUTTON_RAIL = 'mb-3 h-9 min-h-9 w-full px-3 pointer-coarse:h-11';
export const NEW_BUTTON_CHIP = 'relative h-9 min-h-9 touch-target-y px-3';

function SectionIcon({ kind }: { kind: PanelSection['kind'] }) {
  switch (kind) {
    case 'home':
      return <HomeIcon />;
    case 'inbox':
      return <InboxIcon />;
    case 'shared':
      return <ShareIcon />;
    case 'mine':
      return <MyWorkIcon />;
    case 'team':
      return <TeamIcon />;
    case 'favourites':
      return <StarIcon />;
    case 'offline':
      return <BrowserIcon />;
    case 'library':
      return <LibraryIcon />;
    case 'archived':
      return <ArchiveIcon />;
    case 'trash':
      return <TrashIcon />;
  }
}

export function Rail({
  groups,
  selected,
  onPick,
  phone,
  offlineCount,
}: {
  groups: PanelSectionGroup[];
  selected: PanelSection;
  onPick: (s: PanelSection) => void;
  phone: boolean;
  // How many items this browser keeps only for itself: This Browser's count.
  offlineCount: number;
}) {
  const { onCreate, kind, inbox, hasInbox, viewerId, teamName } = useExplorer();
  const canRunTeams = useTeams().canRun;
  const navRef = useRef<HTMLElement>(null);
  const selectedKey = sectionKey(selected);
  const name = (id: string) => teamName(id);
  const badges: Record<string, number | undefined> = {
    inbox: (hasInbox && inboxCount(inbox.data, viewerId)) || undefined,
    offline: offlineCount || undefined,
  };
  // On a phone the picked chip may sit past the row's edge: bring it into view.
  useEffect(() => {
    if (!phone) return;
    const chip = navRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    chip?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [phone, selectedKey]);
  // Up and Down (Left and Right on a phone) move between entries; Enter or Space picks one.
  const onKeyDown = (e: KeyboardEvent) => {
    const keys = phone ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    if (!keys.includes(e.key)) return;
    const entries = [
      ...(navRef.current?.querySelectorAll<HTMLButtonElement>('[data-rail-entry]') ?? []),
    ];
    const at = entries.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    entries[(at + (e.key === keys[1] ? 1 : -1) + entries.length) % entries.length]?.focus();
  };
  // New, first in the rail: never squeezed by the rail's column (shrink-0), 36 px under a mouse and 44 px on touch;
  // on a phone's chip row 36 px to the eye with a 44 px tap, as the chips are. The words sit on the cap height's
  // centre, so they line up with the plus.
  const newItem = (
    <button
      type="button"
      data-panel-new=""
      onClick={() => onCreate({ folderId: null, teamId: null })}
      className={`flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-700 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-brand-600 dark:hover:bg-brand-500 ${
        phone ? NEW_BUTTON_CHIP : NEW_BUTTON_RAIL
      }`}
    >
      <PlusIcon size={14} />
      <span className="text-optical-centre">{phone ? 'New' : `New ${kind.one}`}</span>
    </button>
  );
  const newTeamEntry = canRunTeams ? (
    <NewTeamEntry key="new-team" phone={phone} onMade={(id) => onPick({ kind: 'team', id })} />
  ) : null;
  const entry = (s: PanelSection) => {
    const key = sectionKey(s);
    return (
      <RailEntry
        key={key}
        section={s}
        on={key === selectedKey}
        label={sectionLabel(s, name)}
        badge={badges[key]}
        phone={phone}
        onPick={onPick}
      />
    );
  };
  return (
    <nav
      ref={navRef}
      aria-label="Explorer sections"
      onKeyDown={onKeyDown}
      className={
        phone
          ? 'shrink-0 overflow-x-auto px-2.5 py-1 [scrollbar-width:none]'
          : 'scrollbar-slim flex w-52 shrink-0 flex-col overflow-y-auto border-r border-slate-200 px-2.5 py-3 dark:border-slate-700/70'
      }
    >
      {phone ? (
        <ul className="flex gap-1.5">
          <li className="shrink-0">{newItem}</li>
          {groups.flatMap((g) => [
            ...g.sections.map(entry),
            ...(g.id === 'spaces' && newTeamEntry ? [newTeamEntry] : []),
          ])}
        </ul>
      ) : (
        <>
          {newItem}
          {groups.map((g, i) =>
            g.sections.length ? (
              <section key={g.id} aria-label={SECTION_GROUP_TITLES[g.id]}>
                <h3
                  className={`px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${i ? 'mt-4' : ''}`}
                >
                  {SECTION_GROUP_TITLES[g.id]}
                </h3>
                <ul className="flex flex-col gap-0.5">
                  {g.sections.map(entry)}
                  {g.id === 'spaces' ? newTeamEntry : null}
                </ul>
              </section>
            ) : null,
          )}
        </>
      )}
    </nav>
  );
}

// New Team, last under Spaces (signed in): the team dialog, and the team made opens in the pane.
function NewTeamEntry({ phone, onMade }: { phone: boolean; onMade: (teamId: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={phone ? 'shrink-0' : ''}>
      <button
        type="button"
        data-rail-entry=""
        onClick={() => setOpen(true)}
        className={`flex cursor-pointer items-center gap-2 border border-transparent text-left text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
          phone
            ? 'relative h-9 touch-target-y whitespace-nowrap rounded-lg px-2.5 text-[13px] ring-1 ring-slate-200 dark:ring-slate-700'
            : 'h-8 w-full rounded-md px-2'
        }`}
      >
        <span aria-hidden className="flex shrink-0 items-center opacity-80">
          <PlusIcon />
        </span>
        <span className={phone ? 'text-optical-centre' : 'min-w-0 flex-1 truncate'}>
          {SIDEBAR_LABELS.newTeam}
        </span>
      </button>
      {open ? (
        <NewTeamDialog onClose={() => setOpen(false)} onMade={(team) => onMade(team.id)} />
      ) : null}
    </li>
  );
}

// Where an item dropped on a rail entry lands: My Work's root, or a team's.
function railDropPlace(s: PanelSection): DropPlace | null {
  if (s.kind === 'mine') return { teamId: null, folderId: null };
  if (s.kind === 'team') return { teamId: s.id, folderId: null };
  return null;
}

/**
 * One rail entry. My Work and each team take a dragged item (a resting drag opens the section under it), and the
 * Trash wakes while anything drags, as the Explorer page's sidebar does.
 */
function RailEntry({
  section: s,
  on,
  label,
  badge,
  phone,
  onPick,
}: {
  section: PanelSection;
  on: boolean;
  label: string;
  badge: number | undefined;
  phone: boolean;
  onPick: (s: PanelSection) => void;
}) {
  const drop = useDropTarget(railDropPlace(s), { onLongHover: on ? undefined : () => onPick(s) });
  const trash = useTrashTarget();
  const isTrash = s.kind === 'trash';
  const trashState = isTrash ? trash.state : 'rest';
  const shown = isTrash && trash.words ? trash.words : label;
  // My Work's entry carries its menu on a right-click, as the sidebar's My Work row does.
  const { setRenamingId } = useExplorer();
  const menu = useRowMenu({ disabled: s.kind !== 'mine' });
  const entryRef = useRef<HTMLButtonElement>(null);
  return (
    <li className={phone ? 'shrink-0' : ''}>
      {menu.open ? (
        <MyWorkMenu
          anchor={entryRef.current}
          onClose={menu.close}
          onOpen={() => onPick(s)}
          onRename={(id) => {
            onPick(s);
            setRenamingId(id);
          }}
        />
      ) : null}
      <button
        ref={entryRef}
        type="button"
        onContextMenu={menu.onContextMenu}
        data-rail-entry=""
        data-drop-over={drop.over || undefined}
        aria-current={on ? 'true' : undefined}
        aria-label={badge ? `${label} (${badge})` : label}
        onClick={() => onPick(s)}
        {...(isTrash ? trash.handlers : drop.handlers)}
        className={`flex cursor-pointer items-center gap-2 border border-transparent text-left text-xs transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 ${
          phone
            ? 'relative h-9 touch-target-y whitespace-nowrap rounded-lg px-2.5 text-[13px]'
            : 'h-8 w-full rounded-md px-2'
        } ${
          trashState === 'over'
            ? `${TRASH_OVER} font-semibold text-white`
            : trashState === 'waiting'
              ? `${TRASH_WAITING} text-brand-800 dark:text-brand-200`
              : on
                ? 'bg-brand-100 font-semibold text-brand-800 dark:bg-brand-500/20 dark:text-brand-100'
                : phone
                  ? 'text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
        } ${drop.over ? 'ring-2 ring-brand-400' : ''}`}
      >
        <span
          aria-hidden
          data-trash-bin={isTrash ? trashState : undefined}
          className={`flex shrink-0 items-center opacity-80 transition-transform duration-short ease-out ${TRASH_BIN[trashState]}`}
        >
          <SectionIcon kind={s.kind} />
        </span>
        <span className={phone ? 'text-optical-centre' : 'min-w-0 flex-1 truncate'}>{shown}</span>
        {isTrash ? (
          <span role="status" aria-live="polite" className="sr-only">
            {trash.words ?? ''}
          </span>
        ) : null}
        {badge ? (
          <span
            aria-hidden
            className="rounded-full bg-slate-200/70 px-1.5 text-[10px] font-semibold leading-4 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {badge}
          </span>
        ) : null}
      </button>
    </li>
  );
}
