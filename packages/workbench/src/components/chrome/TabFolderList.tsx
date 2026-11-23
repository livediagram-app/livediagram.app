'use client';

// Organise in Tab Folder's list (docs/specs/006-document/tab-folders.md "Membership UX"), the same in every editor:
// full-width rows, one column at every width, so a long folder name shows in full (it wraps, never cut to a few
// letters). New Folder first (owner, 2026-11-23: a dashed row that becomes an inline editor: name, optional colour,
// Add), then No Folder and a row per folder in bar order (its colour, its stacked glyph, its name, how many tabs it
// holds, Current on the tab's own, and its colour button). Pressing a row moves the tab; the colour button never does.

import { useId, useRef, useState, type ReactNode } from 'react';
import { lucideFolderX, lucidePlus } from '@liveworkspace/icons/lucide';
import type { TabFolderColour } from '@liveworkspace/api-schema/tab-folder-colour';
import type { TabFolderSummary } from '@liveworkspace/element-model/tab-folders';
import { Button, TextInput, lucideGlyph } from '@liveworkspace/ui';
import { FolderColourButton } from './FolderColourButton';
import { FolderStackGlyph } from './FolderStackGlyph';
import { chosenFolderHue, folderStyle, resolveFolderHue } from './folder-colour';

const NoFolderGlyph = lucideGlyph(lucideFolderX, 18);
const PlusGlyph = lucideGlyph(lucidePlus, 18);

// "1 tab", "3 tabs".
export const tabCount = (count: number) => `${count} ${count === 1 ? 'tab' : 'tabs'}`;

// A row's box: full width, about 52px, rounded, a wash on hover; the current one tinted in the brand.
const ROW =
  'flex min-h-[52px] w-full items-center gap-1 rounded-lg pr-1.5 transition-colors motion-reduce:transition-none';
const ROW_IDLE = 'hover:bg-slate-50 dark:hover:bg-slate-800/60';
const ROW_CURRENT =
  'bg-brand-50/70 ring-1 ring-brand-200 ring-inset dark:bg-brand-500/10 dark:ring-brand-400/30';
// The pressable part of a row: everything but its colour button.
const ROW_BUTTON =
  'flex min-w-0 flex-1 cursor-pointer items-center gap-3 self-stretch rounded-lg py-2 pl-2.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500';
// The 32px tile at a row's start, tinted in the folder's colour (its ink AA on the tint in either appearance).
const FOLDER_TILE =
  'flex size-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--tf)_14%,transparent)] text-[color-mix(in_srgb,var(--tf)_72%,black)] dark:bg-[color-mix(in_srgb,var(--tfd)_14%,transparent)] dark:text-[var(--tfd)]';
const NEUTRAL_TILE =
  'flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
const NAME =
  'block text-sm font-medium text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100';
const SUB = 'block text-xs text-slate-500 dark:text-slate-400';

function CurrentPill() {
  return (
    <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">
      Current
    </span>
  );
}

function Row({
  current,
  label,
  onPress,
  tile,
  name,
  sub,
  trailing,
  dataName,
}: {
  current: boolean;
  label: string;
  onPress: () => void;
  tile: ReactNode;
  name: string;
  sub: string;
  trailing?: ReactNode;
  dataName: string;
}) {
  return (
    <li data-tab-folder-row={dataName} className={`${ROW} ${current ? ROW_CURRENT : ROW_IDLE}`}>
      <button
        type="button"
        aria-label={label}
        aria-current={current ? 'true' : undefined}
        onClick={onPress}
        className={ROW_BUTTON}
      >
        {tile}
        <span className="min-w-0 flex-1">
          <span className={NAME}>{name}</span>
          <span className={SUB}>{sub}</span>
        </span>
        {current ? <CurrentPill /> : null}
      </button>
      {trailing}
    </li>
  );
}

// The New Folder row: dashed until pressed, then the inline editor.
function NewFolderRow({
  folders,
  onCreate,
  onEditingChange,
  onColourOpenChange,
}: {
  folders: readonly TabFolderSummary[];
  onCreate: (name: string, colour: TabFolderColour | null) => void;
  onEditingChange: (editing: boolean) => void;
  onColourOpenChange: (open: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [colour, setColour] = useState<TabFolderColour | null>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const name = value.trim();
  const existing = name ? folders.find((f) => f.name === name) : undefined;
  // An existing name shows that folder's colour; a new one, the colour chosen or its name's own pick, live.
  const shown = existing ? existing.colour : colour;
  const hue = resolveFolderHue(name, shown);

  const open = (next: boolean) => {
    setEditing(next);
    onEditingChange(next);
    if (!next) {
      setValue('');
      setColour(null);
      requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }));
    }
  };
  const submit = () => {
    if (!name) return;
    onCreate(name, existing ? null : colour);
  };

  if (!editing) {
    return (
      <li data-tab-folder-row="new">
        <button
          ref={opener}
          type="button"
          onClick={() => open(true)}
          className={`${ROW} cursor-pointer gap-3 border border-dashed border-slate-300 py-2 pl-2.5 text-left text-slate-600 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800/60`}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400">
            <PlusGlyph />
          </span>
          <span className="min-w-0 flex-1">
            <span className={NAME}>New Folder</span>
            <span className={SUB}>Name it and move this tab in</span>
          </span>
        </button>
      </li>
    );
  }

  return (
    <li
      data-tab-folder-row="new"
      style={folderStyle(hue)}
      className={`${ROW} gap-2 py-2 pl-2.5 ring-1 ring-brand-300 ring-inset dark:ring-brand-400/50`}
    >
      <span aria-hidden className={FOLDER_TILE}>
        <FolderStackGlyph count={1} size={16} />
      </span>
      <form
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <span className="min-w-0 flex-1 basis-40">
          <TextInput
            compact
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return;
              e.preventDefault();
              e.stopPropagation();
              open(false);
            }}
            maxLength={120}
            placeholder="Folder name"
            aria-label="Folder name"
            hintId={existing ? hintId : undefined}
          />
          {existing ? (
            <span id={hintId} className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              Moves into the existing folder
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <FolderColourButton
            name={name}
            colour={shown}
            onPick={setColour}
            onOpenChange={onColourOpenChange}
            disabled={existing !== undefined}
            disabledReason="Change it from the folder's own row"
          />
          <Button type="submit" size="sm" disabled={!name}>
            Add
          </Button>
        </span>
      </form>
    </li>
  );
}

export type TabFolderListProps = {
  folders: readonly TabFolderSummary[];
  // The tab's folder, or null when it is loose.
  currentFolder: string | null;
  // Move the tab into a folder by name; a new folder takes `colour` (null: Automatic).
  onMoveToFolder: (name: string, colour?: TabFolderColour | null) => void;
  onRemoveFromFolder: () => void;
  // Set a folder's colour on every member (null: Automatic), the tab staying where it is.
  onSetFolderColour: (name: string, colour: TabFolderColour | null) => void;
  // After a move (or pressing the current row): the dialog closes.
  onDone: () => void;
  // The list holds Escape for itself (a colour popover, the New Folder editor): the dialog leaves it alone.
  onEscapeHeld?: (held: boolean) => void;
};

/** The Organise in Tab Folder list: New Folder, No Folder, every folder. */
export function TabFolderList({
  folders,
  currentFolder,
  onMoveToFolder,
  onRemoveFromFolder,
  onSetFolderColour,
  onDone,
  onEscapeHeld,
}: TabFolderListProps) {
  // What holds Escape: an open colour popover, the New Folder editor.
  const held = useRef(new Set<string>());
  const hold = (key: string, on: boolean) => {
    const before = held.current.size > 0;
    if (on) held.current.add(key);
    else held.current.delete(key);
    const after = held.current.size > 0;
    if (before !== after) onEscapeHeld?.(after);
  };

  return (
    <ul aria-label="Tab folders" className="flex flex-col gap-1">
      <NewFolderRow
        folders={folders}
        onCreate={(name, colour) => {
          hold('new', false);
          onMoveToFolder(name, colour);
          onDone();
        }}
        onEditingChange={(editing) => hold('new', editing)}
        onColourOpenChange={(open) => hold('colour:new', open)}
      />
      <Row
        dataName="none"
        current={currentFolder === null}
        label={`No Folder, loose on the bar${currentFolder === null ? ', current' : ''}`}
        onPress={() => {
          if (currentFolder !== null) onRemoveFromFolder();
          onDone();
        }}
        tile={
          <span aria-hidden className={NEUTRAL_TILE}>
            <NoFolderGlyph />
          </span>
        }
        name="No Folder"
        sub="Loose on the bar"
      />
      {folders.map((folder) => {
        const current = folder.name === currentFolder;
        const hue = resolveFolderHue(folder.name, folder.colour);
        return (
          <Row
            key={folder.name}
            dataName={folder.name}
            current={current}
            label={`${folder.name}, ${tabCount(folder.count)}${current ? ', current folder' : ''}`}
            onPress={() => {
              if (!current) onMoveToFolder(folder.name);
              onDone();
            }}
            tile={
              <span aria-hidden style={folderStyle(hue)} className={FOLDER_TILE}>
                <FolderStackGlyph count={folder.count} size={16} />
              </span>
            }
            name={folder.name}
            sub={tabCount(folder.count)}
            trailing={
              <FolderColourButton
                name={folder.name}
                colour={chosenFolderHue(folder.colour)?.name ?? null}
                onPick={(colour) => onSetFolderColour(folder.name, colour)}
                onOpenChange={(open) => hold(`colour:${folder.name}`, open)}
              />
            }
          />
        );
      })}
    </ul>
  );
}
