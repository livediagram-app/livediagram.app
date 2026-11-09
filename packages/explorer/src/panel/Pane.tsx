'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Tooltip } from '@liveworkspace/ui';
import { useExplorer } from '../explorer/context';
import { MyWorkMenu } from '../explorer/menus';
import { InboxPane } from '../explorer/InboxPane';
import { ThisBrowserArchivedGroup } from '../explorer/ArchivedThisBrowser';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { NewFolderIcon, TeamIcon } from '../ui/icons';
import type { ExplorerView } from '../views';
import { useTeams } from '../teams/context';
import { siteOf, type AppFilter } from '../words';
import { PanelLibrary, PanelTimeline } from './PanelLibraryTimeline';
import { PanelThisBrowser } from './PanelThisBrowser';
import { sectionKey, sectionLabel, type LibraryTab, type PanelSection } from './sections';
import { HomeSection } from './HomeSection';
import { PlaceSection } from './PlaceSection';
import { TrashSection } from './TrashSection';
import { TeamMembersDialog } from './TeamMembersDialog';

// ---- The pane -------------------------------------------------------------------------------------------

// The header's quiet actions: a glyph named by its label and tooltip, a wash on hover, no frame. Words would crowd
// the section's name out of a narrow pane.
const HEADER_ICON_BUTTON =
  'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-500 pointer-coarse:size-11 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white [&_svg]:size-4';

function HeaderIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button type="button" aria-label={label} onClick={onClick} className={HEADER_ICON_BUTTON}>
        {children}
      </button>
    </Tooltip>
  );
}

export function Pane({
  section,
  folderId,
  onOpenFolder,
  currentId,
  onOpenExplorer,
  libraryTab,
  setLibraryTab,
}: {
  section: PanelSection;
  folderId: string | null;
  onOpenFolder: (id: string | null) => void;
  currentId: string | null;
  onOpenExplorer?: (view: ExplorerView) => void;
  libraryTab: LibraryTab;
  setLibraryTab: (tab: LibraryTab) => void;
}) {
  const { teamName, folders } = useExplorer();
  const canRunTeams = useTeams().canRun;
  const [members, setMembers] = useState(false);
  const title = sectionLabel(section, (id) => teamName(id));
  const space = section.kind === 'mine' || section.kind === 'team';
  // The folder open, while it is still one of the space's (a folder deleted or moved away goes back to the root).
  const here =
    folderId && folders.byId.get(folderId)?.teamId === (section.kind === 'team' ? section.id : null)
      ? folderId
      : null;
  const pendingRename = useRef<((id: string) => void) | null>(null);
  // The Inbox's filter dropdown is drawn into the header row, beside the app filter.
  const [inboxSlot, setInboxSlot] = useState<HTMLElement | null>(null);
  const newFolder = space
    ? () =>
        void folders
          .create({
            name: 'New Folder',
            parentId: here,
            teamId: section.kind === 'team' ? section.id : null,
          })
          .then((f) => f && pendingRename.current?.(f.id))
    : undefined;
  const body =
    section.kind === 'home' ? (
      <HomeSection currentId={currentId} onOpenExplorer={onOpenExplorer} />
    ) : section.kind === 'inbox' ? (
      <InboxPane compact filterSlot={inboxSlot} />
    ) : section.kind === 'timeline' ? (
      <PanelTimeline />
    ) : section.kind === 'library' ? (
      <PanelLibrary tab={libraryTab} setTab={setLibraryTab} />
    ) : section.kind === 'trash' ? (
      <TrashSection />
    ) : section.kind === 'offline' ? (
      <PanelThisBrowser />
    ) : (
      <>
        <PlaceSection
          section={section}
          folderId={here}
          onOpenFolder={onOpenFolder}
          currentId={currentId}
          rootLabel={title}
          pendingRename={pendingRename}
        />
        {/* Archived also lists what this browser archived (one-explorer.md "Archived"). */}
        {section.kind === 'archived' ? <ThisBrowserArchivedGroup /> : null}
      </>
    );
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* The section's name always shows in full: it takes the room, and wraps rather than truncates (a long team
          name); the actions are glyphs that never shrink. It keeps 5rem, so a short name (Inbox, beside its filter
          on a phone) never breaks inside the word. */}
      <div className="flex items-center gap-1 px-5 pb-3 pt-4 max-sm:px-4 max-sm:pb-1.5 max-sm:pt-2.5">
        <h3 className="mr-1 min-w-[5rem] flex-1 text-[15px] font-semibold leading-5 text-balance break-words text-slate-900 dark:text-slate-50">
          {title}
        </h3>
        {newFolder ? (
          <HeaderIconButton label={here ? 'New Subfolder' : 'New Folder'} onClick={newFolder}>
            <NewFolderIcon />
          </HeaderIconButton>
        ) : null}
        {section.kind === 'mine' ? (
          <MyWorkHeaderMenu onOpenRoot={() => onOpenFolder(null)} />
        ) : null}
        {section.kind === 'team' && canRunTeams ? (
          <HeaderIconButton label="Members" onClick={() => setMembers(true)}>
            <TeamIcon size={16} />
          </HeaderIconButton>
        ) : null}
        {section.kind === 'inbox' ? (
          <span
            ref={setInboxSlot}
            // The filter gives way before the name does: a native select narrows cleanly.
            className="flex min-w-0 max-w-[8.5rem] max-sm:max-w-[13rem]"
          />
        ) : null}
        {/* This Browser holds only this app's items, and the Library is the app's own. */}
        {section.kind === 'library' || section.kind === 'offline' ? null : (
          <span className="ml-1 shrink-0">
            <FilterToggle />
          </span>
        )}
      </div>
      <div
        data-explorer-pane=""
        className="scrollbar-slim @container min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-5 pt-1 @[38rem]:px-4"
      >
        {/* Keyed by section: a pick slides the new section in (a fade alone under reduced motion). */}
        <div key={sectionKey(section)} className="animate-view-forward">
          {body}
        </div>
      </div>
      {members && section.kind === 'team' ? (
        <TeamMembersDialog teamId={section.id} teamName={title} onClose={() => setMembers(false)} />
      ) : null}
    </div>
  );
}

// My Work's menu in its pane's header: the sidebar's own (Open, New Folder, Use as Default for…), with Open and a new
// folder showing My Work's root here rather than leaving for the Explorer page.
function MyWorkHeaderMenu({ onOpenRoot }: { onOpenRoot: () => void }) {
  const { setRenamingId } = useExplorer();
  const menu = useRowMenu();
  return (
    <>
      <EllipsisTriggerButton {...menu.triggerProps} size="lg" label="Menu for My Work" />
      {menu.open ? (
        <MyWorkMenu
          anchor={menu.triggerRef.current}
          onClose={menu.close}
          onOpen={onOpenRoot}
          onRename={(id) => {
            onOpenRoot();
            setRenamingId(id);
          }}
        />
      ) : null}
    </>
  );
}

// This app's items, or every app's: the Explorer page's own filter, as two quiet words.
function FilterToggle() {
  const { app, filter, setFilter, renderAppLogo } = useExplorer();
  const option = (value: AppFilter, label: string) => {
    const logo = renderAppLogo?.(value === 'app' ? app : 'all');
    return (
      <button
        type="button"
        aria-pressed={filter === value}
        onClick={() => setFilter(value)}
        className={`flex h-6 cursor-pointer items-center rounded px-1.5 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:outline-brand-500 ${
          filter === value
            ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-200'
            : // slate-600, not 500: the group's slate-100 ground left slate-500 at 4.3:1, under AA for this 11px text.
              'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
        }`}
      >
        {logo ? (
          <span aria-hidden className="mr-1 inline-flex shrink-0 [&_svg]:size-3.5">
            {logo}
          </span>
        ) : null}
        {label}
      </button>
    );
  };
  return (
    <div
      role="group"
      aria-label="Show"
      className="flex shrink-0 items-center rounded-md bg-slate-100 p-0.5 dark:bg-slate-800"
    >
      {option('app', siteOf(app).name)}
      {option('all', 'All')}
    </div>
  );
}
