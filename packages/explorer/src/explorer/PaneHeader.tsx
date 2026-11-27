'use client';

// The pane header (livediagram's PaneHeader): the title and the breadcrumb (the shared back bar) on the left; on the right the
// section's own actions, the This app / All filter, the List / Card / Details toggle, Help (where the host
// has an article for the view), and Create (New <kind> and New Folder as two tiles in one menu where both
// apply, else the one button). A phone's one-row toolbar (`phoneRow`, a team's Library; Work Tracker 1516): the scope
// chip and the section's actions at the left, New at the right, Help left to the page (the team's ⋯ menu), `leading`
// on its own row under it.

import type { App } from '@liveworkspace/index-client';
import { possessive } from '@liveworkspace/sites';
import { useState, type ReactNode } from 'react';
import { AppScopeToggle, BackBar, Button } from '@liveworkspace/ui';
import { PortalMenu } from '../ui/Menu';
import {
  CaretDownIcon,
  DetailsViewIcon,
  FolderOutlineIcon,
  GridViewIcon,
  ItemIcon,
  ListViewIcon,
  PlusIcon,
} from '../ui/icons';
import { siteOf } from '../words';
import { useExplorer } from './context';
import { HelpButton } from './HomeHero';
import { ChoiceTile, NewChoices } from './NewChoices';
import { useHostExtras } from './host';
import { useExtras, type ViewModeTelemetry } from './extras';
import { ScopeChip } from './ScopeChip';
import { useIsPhone } from './useViewMode';
import { HoverCard } from '@liveworkspace/ui';

export type ViewMode = 'list' | 'card' | 'details';
const VIEW_MODES: readonly ViewMode[] = ['list', 'card', 'details'];

export type Crumb = { name: string; onClick?: () => void };

export function PaneHeader({
  title,
  crumbs = [],
  onCreateItem,
  onCreateFolder,
  folderLabel = 'New Folder',
  actions,
  viewMode,
  onSetViewMode,
  viewModes,
  showFilter = true,
  leading,
  createLabel = 'Create',
  phoneRow = false,
}: {
  /** The pane's heading; left out where the page has its own (a team's Library tab), `leading` taking its place. */
  title?: string;
  crumbs?: Crumb[];
  // New: the host app's kind, or `app`'s when New offers a choice (createChoices).
  onCreateItem?: (app?: App) => void;
  onCreateFolder?: () => void;
  folderLabel?: string;
  actions?: ReactNode;
  viewMode?: ViewMode;
  onSetViewMode?: (mode: ViewMode) => void;
  /** The layouts offered, where not all three. */
  viewModes?: readonly ViewMode[];
  showFilter?: boolean;
  /** What stands where the heading would (a team's Library tab: its kind chips). */
  leading?: ReactNode;
  /** The create menu's button ("Create"; "New" on a team's Library tab). */
  createLabel?: string;
  /** On a phone, one row that never wraps: the scope chip, `actions`, then New; `leading` under it, Help left out. */
  phoneRow?: boolean;
}) {
  const { kind, helpHref, view, createChoices } = useExplorer();
  const help = helpHref?.(view);
  const [createOpen, setCreateOpen] = useState(false);
  const [createButton, setCreateButton] = useState<HTMLButtonElement | null>(null);
  const phone = useIsPhone();
  const row = phoneRow && phone;
  // Every app's New (and New Folder) in one menu while the list mixes every app.
  const choices = onCreateItem ? createChoices : null;
  const both = Boolean(onCreateItem && onCreateFolder) || Boolean(choices);
  const single = both
    ? null
    : onCreateItem
      ? { label: `New ${kind.one}`, onClick: () => onCreateItem() }
      : onCreateFolder
        ? { label: folderLabel, onClick: onCreateFolder }
        : null;
  // On a phone's one row New is as tall as the chip beside it (36px, 44px to a thumb).
  const createSize = row ? 'relative touch-target-y h-9 shadow-sm' : 'shadow-sm';
  const createButtonSize = row ? 'sm' : 'xs';
  const create = (
    <>
      {single ? (
        <Button
          size={createButtonSize}
          onClick={single.onClick}
          aria-label={single.label}
          className={createSize}
        >
          <PlusIcon />
          <span className="hidden sm:inline">{single.label}</span>
        </Button>
      ) : null}
      {both ? (
        <Button
          ref={setCreateButton}
          size={createButtonSize}
          onClick={() => setCreateOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={createOpen}
          className={createSize}
        >
          <PlusIcon />
          {createLabel}
          <CaretDownIcon />
        </Button>
      ) : null}
      {createOpen && both ? (
        <PortalMenu anchor={createButton} onClose={() => setCreateOpen(false)} label="Create">
          {choices ? (
            <NewChoices
              apps={choices}
              onPick={(app) => {
                setCreateOpen(false);
                onCreateItem!(app);
              }}
              after={
                onCreateFolder ? (
                  <ChoiceTile
                    label={folderLabel}
                    icon={<FolderOutlineIcon size={20} />}
                    onClick={() => {
                      setCreateOpen(false);
                      onCreateFolder();
                    }}
                  />
                ) : null
              }
            />
          ) : (
            /* Icon-over-label tiles, two across: bigger targets than thin rows. */
            <div className="grid grid-cols-2 gap-1 px-1.5 py-0.5">
              <MenuTile
                label={`New ${kind.one}`}
                icon={<ItemIcon size={20} />}
                onClick={() => {
                  setCreateOpen(false);
                  onCreateItem!();
                }}
              />
              <MenuTile
                label={folderLabel}
                icon={<FolderOutlineIcon size={20} />}
                onClick={() => {
                  setCreateOpen(false);
                  onCreateFolder!();
                }}
              />
            </div>
          )}
        </PortalMenu>
      ) : null}
    </>
  );
  if (row) {
    return (
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex min-w-0 flex-nowrap items-center gap-2" data-phone-toolbar="">
          {showFilter ? <ScopeChip /> : null}
          {actions}
          <div className="ml-auto flex shrink-0 items-center">{create}</div>
        </div>
        {leading}
      </div>
    );
  }
  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-[10rem] flex-1 items-center gap-2">
          {title !== undefined ? (
            <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {title}
            </h1>
          ) : (
            leading
          )}
        </div>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          {actions}
          {showFilter ? <FilterToggle /> : null}
          {viewMode && onSetViewMode ? (
            <ViewToggle mode={viewMode} onChange={onSetViewMode} modes={viewModes} />
          ) : null}
          {help ? <HelpButton href={help} /> : null}
          {create}
        </div>
      </div>
      {crumbs.length >= 2 ? (
        // The shared back bar (docs/specs/004-interface-design/back-bar.md): the level above as where Back goes,
        // the open one as its chip.
        <nav aria-label="Breadcrumb">
          <BackBar
            label={crumbs[crumbs.length - 2]!.name}
            current={crumbs[crumbs.length - 1]!.name}
            onClick={crumbs[crumbs.length - 2]!.onClick}
            gap="tight"
          />
        </nav>
      ) : null}
    </div>
  );
}

function MenuTile({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      className="flex cursor-pointer flex-col items-center justify-start gap-1.5 rounded-md px-1.5 py-2 text-center text-[11px] font-medium leading-tight text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
    >
      <span className="text-slate-400">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

const SEGMENTS =
  'flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800';
const segment = (active: boolean) =>
  `flex h-7 items-center justify-center rounded px-2 text-xs font-medium transition ${
    active
      ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-200'
      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
  }`;

/** This app's items, or every app's: the app's own name ("livediagram") beside All (@liveworkspace/ui AppScopeToggle,
 *  which the Community page draws too). */
export function FilterToggle() {
  const { app, filter, setFilter, kind, renderAppLogo } = useExplorer();
  const { allLabel, showAppFilter } = useHostExtras();
  if (!showAppFilter) return null;
  // Each choice wears its logo: the app's, and the platform's for every app.
  return (
    <AppScopeToggle
      value={filter}
      onChange={setFilter}
      app={{
        label: siteOf(app).name,
        logo: renderAppLogo?.(app),
        description: `Only ${possessive(siteOf(app).name)} ${kind.lowerMany}`,
      }}
      all={{ label: allLabel, logo: renderAppLogo?.('all'), description: 'Every app’s items' }}
    />
  );
}

// The telemetry name of a real switch to each layout (`UI / Toggled / <type>`).
export const VIEW_TOGGLE_TELEMETRY = {
  list: 'ExplorerViewList',
  card: 'ExplorerViewCard',
  details: 'ExplorerViewDetails',
} as const satisfies Record<ViewMode, ViewModeTelemetry>;

export function ViewToggle({
  mode,
  onChange,
  modes = VIEW_MODES,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  modes?: readonly ViewMode[];
}) {
  const { words } = useExplorer();
  const { onViewToggled } = useExtras();
  // Only a real switch is counted: pressing the side already on changes nothing.
  const choose = (next: ViewMode) => {
    if (next !== mode) onViewToggled?.(VIEW_TOGGLE_TELEMETRY[next]);
    onChange(next);
  };
  const button = (m: ViewMode, label: string, description: string, icon: ReactNode) =>
    modes.includes(m) ? (
      <HoverCard title={label} description={description}>
        <button
          type="button"
          onClick={() => choose(m)}
          aria-label={label}
          aria-pressed={mode === m}
          className={`${segment(mode === m)} w-7 px-0`}
        >
          {icon}
        </button>
      </HoverCard>
    ) : null;
  return (
    <div role="group" aria-label="View mode" className={`${SEGMENTS} max-sm:hidden`}>
      {button('list', 'List view', 'Compact rows.', <ListViewIcon />)}
      {button(
        'card',
        'Card view',
        `Cards with a large preview of each ${words.lowerOne}.`,
        <GridViewIcon />,
      )}
      {button(
        'details',
        'Details view',
        'A sortable table: type, comments, access, size and dates.',
        <DetailsViewIcon />,
      )}
    </div>
  );
}
