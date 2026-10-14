'use client';

// The editor's Explorer rail (docs/specs/013-workspace/explorer-structure.md "The rail"): every section as an entry,
// the picked one marked. A column of rows on a desktop, a sideways-scrolling row of chips on a phone. Up and Down (Left
// and Right on a phone) move between entries; Enter or Space picks one. My documents takes a dragged document, filing
// it at the root.
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import {
  HomeIcon,
  InboxIcon,
  LibraryIcon,
  MyDocumentsIcon,
  ShareIcon,
  ThisBrowserIcon,
  TimelineIcon,
  TrashIcon,
  TeamIcon,
  PlusIcon,
} from '@/components/primitives/explorer-icons';
import {
  SIDEBAR_GROUP_TITLES,
  type SidebarDivider,
} from '@/app/explorer/sidebar/sidebar-structure';
import { useDocumentDropTarget } from '../useDocumentDropTarget';
import {
  sectionKey,
  sectionLabel,
  type PanelSection,
  type PanelSectionGroup,
} from './panel-sections';

const ICONS: Record<PanelSection['kind'], () => ReactNode> = {
  home: () => <HomeIcon />,
  inbox: () => <InboxIcon />,
  timeline: () => <TimelineIcon />,
  shared: () => <ShareIcon />,
  mine: () => <MyDocumentsIcon />,
  team: () => <TeamIcon />,
  browser: () => <ThisBrowserIcon />,
  library: () => <LibraryIcon />,
  trash: () => <TrashIcon />,
};

export function ExplorerRail({
  groups,
  selected,
  onPick,
  badges,
  teamName,
  divider,
  phone,
  onDropToMyDocuments,
  onNewDocument,
}: {
  // One click to a new document, first in the rail.
  onNewDocument?: () => void;
  groups: PanelSectionGroup[];
  selected: PanelSection;
  onPick: (s: PanelSection) => void;
  // A count beside an entry (Shared with me, This browser), by section key.
  badges: Record<string, number | undefined>;
  teamName: (id: string) => string | undefined;
  divider: SidebarDivider;
  phone: boolean;
  onDropToMyDocuments?: (documentId: string) => void;
}) {
  const newDocument = onNewDocument ? (
    <button
      type="button"
      onClick={onNewDocument}
      className={`flex cursor-pointer items-center justify-center gap-1.5 bg-brand-700 font-semibold text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-brand-600 dark:hover:bg-brand-500 ${
        phone
          ? 'relative h-9 shrink-0 touch-target-y whitespace-nowrap rounded-lg px-3 text-[13px]'
          : 'mb-3 h-9 w-full rounded-lg text-xs'
      }`}
    >
      <PlusIcon size={13} />
      <span className={phone ? 'text-optical-centre' : ''}>{phone ? 'New' : 'New Document'}</span>
    </button>
  ) : null;
  const navRef = useRef<HTMLElement>(null);
  const drop = useDocumentDropTarget(onDropToMyDocuments);
  const onKeyDown = (e: KeyboardEvent) => {
    const keys = phone ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    if (!keys.includes(e.key)) return;
    const entries = [
      ...(navRef.current?.querySelectorAll<HTMLButtonElement>('[data-rail-entry]') ?? []),
    ];
    const at = entries.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    const next = entries[(at + (e.key === keys[1] ? 1 : -1) + entries.length) % entries.length];
    next?.focus();
  };
  const selectedKey = sectionKey(selected);
  // On a phone the picked chip may sit past the row's edge: bring it into view (no scroll of the page itself).
  useEffect(() => {
    if (!phone) return;
    const chip = navRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    chip?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [phone, selectedKey]);
  const entry = (s: PanelSection) => {
    const key = sectionKey(s);
    const on = key === selectedKey;
    const label = sectionLabel(s, teamName);
    const badge = badges[key];
    const dropProps = s.kind === 'mine' && onDropToMyDocuments ? drop.handlers : undefined;
    const highlighted = s.kind === 'mine' && drop.isDragOver;
    const icon = ICONS[s.kind]();
    return (
      <li key={key} className={phone ? 'shrink-0' : ''}>
        <button
          type="button"
          data-rail-entry=""
          aria-current={on ? 'true' : undefined}
          aria-label={badge ? `${label} (${badge})` : label}
          onClick={() => onPick(s)}
          {...dropProps}
          className={`flex cursor-pointer items-center gap-2 text-left text-xs transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 ${
            phone
              ? 'relative h-9 touch-target-y whitespace-nowrap rounded-lg px-2.5 text-[13px]'
              : 'h-8 w-full rounded-md px-2'
          } ${
            on
              ? 'bg-brand-100 font-semibold text-brand-800 dark:bg-brand-500/20 dark:text-brand-100'
              : phone
                ? 'text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
          } ${highlighted ? 'ring-2 ring-brand-400' : ''}`}
        >
          <span aria-hidden className="flex shrink-0 items-center opacity-80">
            {icon}
          </span>
          <span
            // Trimmed to its cap band only in a phone's chip: a truncated row label trimmed so loses its descenders.
            className={phone ? 'text-optical-centre' : 'min-w-0 flex-1 truncate'}
          >
            {label}
          </span>
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
  };
  return (
    <nav
      ref={navRef}
      aria-label="Explorer sections"
      onKeyDown={onKeyDown}
      className={
        phone
          ? 'shrink-0 overflow-x-auto px-2.5 py-1 [scrollbar-width:none]'
          : 'scrollbar-slim flex w-44 shrink-0 flex-col overflow-y-auto border-r border-slate-200 px-1.5 py-2 dark:border-slate-700/70'
      }
    >
      {phone ? (
        <ul className="flex gap-1.5">
          {newDocument ? <li className="shrink-0">{newDocument}</li> : null}
          {groups.flatMap((g) => g.sections).map(entry)}
        </ul>
      ) : (
        <>
          {newDocument}
          {groups.map((g, i) =>
            g.sections.length ? (
              <section key={g.id} aria-label={SIDEBAR_GROUP_TITLES[g.id]}>
                {divider === 'titles' ? (
                  <h3
                    className={`px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${i ? 'mt-4' : ''}`}
                  >
                    {SIDEBAR_GROUP_TITLES[g.id]}
                  </h3>
                ) : i ? (
                  <span
                    aria-hidden
                    className="mx-2 my-2.5 block h-px bg-slate-200 dark:bg-slate-700"
                  />
                ) : null}
                <ul className="flex flex-col gap-0.5">{g.sections.map(entry)}</ul>
              </section>
            ) : null,
          )}
        </>
      )}
    </nav>
  );
}
