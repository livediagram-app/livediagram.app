'use client';

import { useState, type ReactNode } from 'react';

// The pieces a placement level is built from (spec/76, spec/15, spec/141):
// the selectable destination card, the inline New Folder card, their
// cascade entrance, and the glyphs. PlacementBrowser composes them into the
// space -> folder browse; TabOrganiseDialogs (spec/30) and the wizard's Save
// location row (spec/141) use the cards on their own.

// Tile grid (icon over label) or stacked rows (icon beside label, the
// file-explorer idiom). One prop, threaded from the browser down to each
// card, so the two shapes never drift into two components.
export type PlacementLayout = 'tiles' | 'list';

// The cascade entrance for one row / tile at `index` (see the level
// container comment in PlacementBrowser). A list row slides in and grows
// from zero height (slide-row-in), so the rows beneath ease down; a tile
// fades, since a grid track already holds its place.
function enterProps(layout: PlacementLayout, index: number | undefined) {
  if (index === undefined) return { className: '', style: undefined };
  return {
    className: `stagger-enter ${layout === 'list' ? 'animate-slide-row-in' : 'animate-fade-in'}`,
    style: { '--stagger-i': index } as React.CSSProperties,
  };
}

// The "New Folder" tile: a dashed card that flips into a small naming form in
// place (the popover the flow needs, without portal plumbing inside the
// modal). Enter creates in the CURRENT level's scope and the browser selects
// the fresh folder; Escape backs out. Exported for the tab Add-to-Folder
// dialog (spec/30), which offers the same create-in-place affordance.
// The dashed "create one here" tile: a label at rest, an inline name field
// once clicked. New Folder and New Team are two skins of it, so the two
// gestures (click, type, Enter or tap away) are the same wherever a level
// lets you add to it.
function InlineCreateTile({
  onCreate,
  icon,
  label,
  sub,
  placeholder,
  layout = 'tiles',
  enterIndex,
}: {
  onCreate: (name: string) => Promise<boolean>;
  icon: ReactNode;
  label: string;
  sub: string;
  placeholder: string;
  layout?: PlacementLayout;
  // Position in the level's cascade; absent = no entrance animation.
  enterIndex?: number;
}) {
  const row = layout === 'list';
  const enter = enterProps(layout, enterIndex);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const commit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const ok = await onCreate(trimmed);
    setBusy(false);
    if (ok) {
      setNaming(false);
      setName('');
    }
  };
  if (!naming) {
    return (
      <button
        type="button"
        onClick={() => setNaming(true)}
        style={enter.style}
        className={`${enter.className} ${
          row
            ? 'flex items-center gap-2.5 px-3 py-2 text-left'
            : 'flex flex-col items-center justify-center gap-1.5 p-3 text-center'
        } rounded-lg border border-dashed border-slate-300 transition hover:border-brand-400 hover:bg-brand-50/40 dark:border-slate-600 dark:hover:border-brand-500 dark:hover:bg-brand-500/10`}
      >
        <span className="shrink-0 text-slate-400">{icon}</span>
        <span
          className={`${row ? 'min-w-0 flex-1' : 'w-full'} truncate text-xs font-medium text-slate-500 dark:text-slate-400`}
        >
          {label}
        </span>
        <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">{sub}</span>
      </button>
    );
  }
  return (
    <div
      className={`${
        row
          ? 'flex items-center gap-2.5 px-3 py-2'
          : 'flex flex-col items-center justify-center gap-1.5 p-3'
      } rounded-lg border border-brand-300 bg-brand-50/40 dark:border-brand-500/50 dark:bg-brand-500/10`}
    >
      <span className="shrink-0 text-brand-500">{icon}</span>
      <input
        type="text"
        autoFocus
        value={name}
        placeholder={placeholder}
        disabled={busy}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit();
          if (e.key === 'Escape') {
            setNaming(false);
            setName('');
          }
        }}
        onBlur={() => {
          if (busy) return;
          // Mobile keyboards give this single-line field no Enter key, so
          // tapping away with a name typed commits the folder; an empty
          // field just folds the tile back up. (Escape unmounts the input
          // without firing this handler, so cancel stays cancel.)
          if (name.trim()) {
            void commit();
          } else {
            setNaming(false);
            setName('');
          }
        }}
        // No border or fill of its own: the tile is already the outlined,
        // tinted box, and a second outline inside it read as a field in a
        // field. The caret and the placeholder are enough to say "type".
        // Same py-2 as a placement row, and a 16px-tall field, so the tile
        // is exactly a row's height whether it is resting or being named.
        // leading-4 on the row form: under 640px the app's anti-zoom rule
        // (globals.css) lifts every input to 16px, and at the default line
        // height that made this row taller than its neighbours. A 16px
        // line box keeps the row at the same height as a 12px label row.
        className={`${
          row ? 'h-4 min-w-0 flex-1 py-0 text-left leading-4' : 'w-full py-1 text-center'
        } bg-transparent px-0 text-xs text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500`}
      />
      <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
        {busy ? 'Creating…' : 'Enter to create'}
      </span>
    </div>
  );
}

export function NewFolderTile({
  onCreate,
  label = 'New Folder',
  sub = 'Create here',
  layout,
  enterIndex,
}: {
  onCreate: (name: string) => Promise<boolean>;
  // "New Folder" at a space's root, "New Subfolder" once a folder is the
  // selected destination (the browser decides; see its tile).
  label?: string;
  sub?: string;
  layout?: PlacementLayout;
  enterIndex?: number;
}) {
  return (
    <InlineCreateTile
      onCreate={onCreate}
      icon={<NewFolderIcon />}
      label={label}
      sub={sub}
      placeholder="Folder name"
      layout={layout}
      enterIndex={enterIndex}
    />
  );
}

// The space overview's "start a team here" (spec/32, spec/141). Signed-in
// only: the host passes the handler only when teams are on, so a guest
// never sees a tile that would lead to a 401.
export function NewTeamTile({
  onCreate,
  layout,
  enterIndex,
}: {
  onCreate: (name: string) => Promise<boolean>;
  layout?: PlacementLayout;
  enterIndex?: number;
}) {
  return (
    <InlineCreateTile
      onCreate={onCreate}
      icon={<TeamPlaceIcon />}
      label="New Team"
      sub="Create a New Team"
      placeholder="Team name"
      layout={layout}
      enterIndex={enterIndex}
    />
  );
}

function NewFolderIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3.6l1.8 2H15.5A1.5 1.5 0 0 1 17 7.5v7A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-9Z" />
      <path d="M10 9.2v4M8 11.2h4" />
    </svg>
  );
}

// One selectable destination: icon, name, and a small kind caption, radio
// semantics (exactly one destination is ever active). As a tile the three
// stack; as a list row they sit side by side with the caption pinned right,
// the way a file explorer's list view keeps its Type column.
export function PlacementCard({
  label,
  sub,
  icon,
  selected,
  onSelect,
  onCommit,
  layout = 'tiles',
  enterIndex,
  count,
}: {
  label: string;
  sub: string;
  icon: ReactNode;
  selected: boolean;
  onSelect: () => void;
  // Double-click: select + commit the host flow in one gesture. Only wired on
  // cards that stay mounted across the first click (drill-in cards swap the
  // level under the cursor, so a dblclick can never land on them).
  onCommit?: () => void;
  layout?: PlacementLayout;
  // Position in the level's cascade; absent = no entrance animation.
  enterIndex?: number;
  // Direct subfolders inside this destination. Shown as a badge when at
  // least one, so a card that leads somewhere says so; 0 / absent = none.
  count?: number;
}) {
  const row = layout === 'list';
  const enter = enterProps(layout, enterIndex);
  const badge = count ? (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
        selected
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/25 dark:text-brand-200'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
      }`}
    >
      {count} {count === 1 ? 'Subfolder' : 'Subfolders'}
    </span>
  ) : null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      onDoubleClick={onCommit}
      style={enter.style}
      className={`${enter.className} ${
        row
          ? 'flex items-center gap-2.5 px-3 py-2 text-left'
          : 'flex flex-col items-center gap-1.5 p-3 text-center'
      } rounded-lg border transition ${
        selected
          ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-200 dark:border-brand-500 dark:bg-brand-500/10 dark:ring-brand-500/30'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700/60'
      }`}
    >
      <span
        className={`shrink-0 ${selected ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400'}`}
      >
        {icon}
      </span>
      <span
        className={`${row ? 'min-w-0 flex-1' : 'w-full'} truncate text-xs font-medium ${
          selected ? 'text-brand-800 dark:text-brand-200' : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        {label}
      </span>
      {/* In a row the badge sits beside the name; on a tile it takes its own
          line between name and caption, where the narrow track has room. */}
      {badge}
      <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">{sub}</span>
    </button>
  );
}

// Tile glyphs, sized to sit above the card label.
export function PersonalSpaceIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3.5 8.5 10 3l6.5 5.5" />
      <path d="M5 7.5V16a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7.5" />
      <path d="M8 17v-4.5h4V17" />
    </svg>
  );
}

export function FolderPlaceIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3.6l1.8 2H15.5A1.5 1.5 0 0 1 17 7.5v7A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-9Z" />
    </svg>
  );
}

// A folder with a smaller folder tucked inside: the "has subfolders" marker
// on drill-in cards, distinct from the plain FolderPlaceIcon leaf.
export function FolderStackIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3.6l1.8 2H15.5A1.5 1.5 0 0 1 17 7.5v7A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-9Z" />
      <path d="M6.5 12.9v-2.6c0-.44.36-.8.8-.8h1.5l.9 1h2.5c.44 0 .8.36.8.8v1.6c0 .44-.36.8-.8.8H7.3a.8.8 0 0 1-.8-.8Z" />
    </svg>
  );
}

export function TeamPlaceIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="7.5" cy="7" r="2.6" />
      <path d="M3 16c.5-2.8 2.2-4.2 4.5-4.2S11.5 13.2 12 16" />
      <circle cx="13.8" cy="7.8" r="2" />
      <path d="M13.2 11.6c1.9.2 3.2 1.5 3.7 3.9" />
    </svg>
  );
}
