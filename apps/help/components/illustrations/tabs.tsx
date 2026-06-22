// Tabs-category illustrations (spec/55): the tab bar of pill-shaped boards,
// collapsible tab folders, cross-tab links, the tab ellipsis menu and its
// Organise / Content / Cleanup sections, and a before/after cleanup.
// Composed only from the shared primitives so the house style holds.

import { Scene, Shape, Arrow, Menu, Label, TextBar } from './primitives';

// --- Tab-bar building blocks -------------------------------------------------

/** A single pill-shaped tab in the bar. Active tabs are brand-filled. */
function TabPill({
  x,
  y,
  w,
  label,
  active = false,
  h = 26,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  active?: boolean;
  h?: number;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={h / 2}
        className={active ? 'fill-brand-500 stroke-brand-600' : 'fill-white stroke-slate-200'}
        strokeWidth={1.5}
      />
      <Label
        x={x + w / 2}
        y={y + h / 2 + 1}
        anchor="middle"
        size={11}
        weight={active ? 700 : 500}
        tone={active ? 'onAccent' : 'body'}
      >
        {label}
      </Label>
    </g>
  );
}

/** A round `+` add-tab button drawn at the right end of the bar. */
function AddTabButton({ x, y, h = 26 }: { x: number; y: number; h?: number }) {
  const r = h / 2;
  const cx = x + r;
  const cy = y + r;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className="fill-slate-50 stroke-slate-200" strokeWidth={1.5} />
      <path
        d={`M${cx - 6} ${cy} h12 M${cx} ${cy - 6} v12`}
        className="stroke-slate-500"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </g>
  );
}

/** A folder icon: closed (collapsed) or open (expanded), drawn from its centre. */
function FolderIcon({ open = false }: { open?: boolean }) {
  if (open) {
    return (
      <g>
        <path
          d="M-9 -5 h6 l2 2 h7 a1 1 0 0 1 1 1 v1 h-17 Z"
          className="fill-brand-300 stroke-brand-500"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <path
          d="M-9 -1 h19 l-2 7 h-19 Z"
          className="fill-brand-100 stroke-brand-500"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </g>
    );
  }
  return (
    <path
      d="M-9 -5 h6 l2 2 h8 a1 1 0 0 1 1 1 v8 a1 1 0 0 1 -1 1 h-16 a1 1 0 0 1 -1 -1 v-10 a1 1 0 0 1 1 -1 Z"
      className="fill-brand-200 stroke-brand-500"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  );
}

/** A folder chip: a folder icon, the folder name, and a small count badge. */
function FolderChip({
  x,
  y,
  name,
  count,
  open = false,
  w = 108,
  h = 26,
}: {
  x: number;
  y: number;
  name: string;
  count: number;
  open?: boolean;
  w?: number;
  h?: number;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={h / 2}
        className="fill-brand-50 stroke-brand-300"
        strokeWidth={1.5}
      />
      <g transform={`translate(${x + 16} ${y + h / 2})`}>
        <FolderIcon open={open} />
      </g>
      <Label x={x + 30} y={y + h / 2 + 1} size={11} weight={600} tone="accent">
        {name}
      </Label>
      <g>
        <circle cx={x + w - 13} cy={y + h / 2} r={8} className="fill-brand-500" />
        <Label
          x={x + w - 13}
          y={y + h / 2 + 1}
          anchor="middle"
          size={10}
          weight={700}
          tone="onAccent"
        >
          {String(count)}
        </Label>
      </g>
    </g>
  );
}

/** The shared bottom tab-bar background strip. */
function TabBar({ y, w }: { y: number; w: number }) {
  return (
    <rect
      x={0}
      y={y}
      width={w}
      height={42}
      className="fill-slate-50 stroke-slate-200"
      strokeWidth={1.5}
    />
  );
}

// --- Scenes ------------------------------------------------------------------

/** The tab bar: several tab pills, one active, with the + add button. Reused
 *  wherever a section just needs to show the bar of tabs. */
export function TabBarOverview() {
  const barY = 158;
  return (
    <Scene w={420} h={210}>
      {/* The active tab's canvas above the bar */}
      <Shape x={150} y={40} w={92} h={48} kind="rect" accent label="Overview" />
      <Shape x={64} y={108} w={80} h={40} kind="rect" />
      <Shape x={252} y={108} w={80} h={40} kind="rect" />
      <Arrow from={[196, 88]} to={[104, 108]} tone="muted" />
      <Arrow from={[196, 88]} to={[292, 108]} tone="muted" />
      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={76} label="Overview" active />
      <TabPill x={98} y={barY + 8} w={62} label="Systems" />
      <TabPill x={168} y={barY + 8} w={56} label="Teams" />
      <TabPill x={232} y={barY + 8} w={62} label="Scratch" />
      <AddTabButton x={302} y={barY + 8} />
    </Scene>
  );
}

/** Renaming a tab inline: a tab pill in edit mode with a text caret. */
export function RenamingTab() {
  const barY = 70;
  return (
    <Scene w={420} h={150} bg="plain">
      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={66} label="Tab 1" />
      {/* The tab being renamed: a wider editing pill with a caret */}
      <g>
        <rect
          x={88}
          y={barY + 6}
          width={108}
          height={30}
          rx={15}
          className="fill-white stroke-brand-500"
          strokeWidth={2}
        />
        <Label x={104} y={barY + 21} size={11} weight={600} tone="strong">
          Payments
        </Label>
        <rect x={163} y={barY + 13} width={1.5} height={16} className="fill-brand-500" />
      </g>
      <TabPill x={204} y={barY + 8} w={62} label="Billing" />
      <AddTabButton x={274} y={barY + 8} />
      <Label x={88} y={barY - 12} size={9} tone="muted">
        Double-click to rename
      </Label>
    </Scene>
  );
}

/** A tab folder shown both expanded (chip plus its tab pills) and collapsed
 *  (just the chip with its count badge). */
export function TabFolderStates() {
  return (
    <Scene w={420} h={210}>
      {/* Expanded */}
      <Label x={14} y={26} size={8} weight={700} tone="muted">
        EXPANDED
      </Label>
      <rect
        x={10}
        y={36}
        width={284}
        height={42}
        rx={10}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <FolderChip x={18} y={44} name="Plans" count={3} open w={86} />
      <TabPill x={112} y={44} w={54} label="Q1" />
      <TabPill x={172} y={44} w={54} label="Q2" />
      <TabPill x={232} y={44} w={54} label="Q3" />

      {/* Collapsed */}
      <Label x={14} y={120} size={8} weight={700} tone="muted">
        COLLAPSED
      </Label>
      <rect
        x={10}
        y={130}
        width={196}
        height={42}
        rx={10}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <FolderChip x={18} y={138} name="Plans" count={3} w={98} />
      <TabPill x={124} y={138} w={70} label="Overview" />
    </Scene>
  );
}

/** The "Add to Folder" submenu from the tab menu: pick a folder, make a new
 *  one, or remove from folder. */
export function AddToFolderMenu() {
  const barY = 158;
  return (
    <Scene w={420} h={210}>
      <TabBar y={barY} w={420} />
      <FolderChip x={14} y={barY + 8} name="Plans" count={2} w={92} />
      <TabPill x={116} y={barY + 8} w={64} label="Notes" active />
      <AddTabButton x={188} y={barY + 8} />
      {/* The menu floating above the tapped tab */}
      <Menu
        x={116}
        y={26}
        w={150}
        items={['Plans', 'Back office', 'New folder...', 'Remove from folder']}
        active={0}
      />
    </Scene>
  );
}

/** A link on tab 1 jumping to tab 2: an element with a Follow-link badge, an
 *  arrow across to a second board, and the tab bar below. */
export function CrossTabLink() {
  const barY = 158;
  return (
    <Scene w={420} h={210}>
      {/* Tab 1: source element with a link badge */}
      <Shape x={30} y={48} w={104} h={52} kind="rect" label="Database" />
      <g transform="translate(126 44)">
        <circle r={11} className="fill-brand-500 stroke-white" strokeWidth={2.5} />
        {/* Link / chain glyph */}
        <path
          d="M-4 0 a3 3 0 0 1 3 -3 h2 M4 0 a3 3 0 0 1 -3 3 h-2"
          className="stroke-white"
          strokeWidth={1.8}
          fill="none"
          strokeLinecap="round"
        />
        <path d="M-2 0 h4" className="stroke-white" strokeWidth={1.8} strokeLinecap="round" />
      </g>
      <Label x={30} y={114} size={10} tone="accent">
        Follow link
      </Label>

      {/* The jump */}
      <Arrow from={[140, 74]} to={[252, 74]} kind="curved" />

      {/* Tab 2: target board */}
      <Shape x={258} y={48} w={104} h={52} kind="rect" accent label="Internals" />

      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={76} label="Overview" active />
      <TabPill x={98} y={barY + 8} w={96} label="DB internals" />
      <AddTabButton x={202} y={barY + 8} />
    </Scene>
  );
}

/** The tab ellipsis menu with the Add to Diagram option and a target-diagram
 *  picker submenu. */
export function AddToDiagramMenu() {
  const barY = 158;
  return (
    <Scene w={420} h={210}>
      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={88} label="Reference" active />
      <AddTabButton x={112} y={barY + 8} />
      {/* The Organise section of the tab menu */}
      <Menu
        x={14}
        y={28}
        w={142}
        items={['Add to Folder', 'Add to Diagram', 'Link Element']}
        active={1}
      />
      {/* The destination-diagram picker */}
      <Menu
        x={170}
        y={48}
        w={150}
        items={['Roadmap 2026', 'Onboarding', 'Architecture', 'Marketing site']}
        active={2}
      />
      <Arrow from={[156, 60]} to={[170, 70]} tone="muted" head={false} width={1.5} />
    </Scene>
  );
}

/** The Import submenu of the tab menu: JSON and Markdown into the active tab. */
export function ImportMenu() {
  const barY = 158;
  return (
    <Scene w={420} h={210}>
      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={64} label="Draft" active />
      <AddTabButton x={88} y={barY + 8} />
      {/* Content section, then the Import submenu */}
      <Menu x={14} y={36} w={120} items={['Import', 'Export']} active={0} />
      <Menu
        x={148}
        y={48}
        w={188}
        items={['JSON  (.livediagram-tab.json)', 'Markdown  (outline)']}
        active={0}
      />
      <Arrow from={[134, 60]} to={[148, 70]} tone="muted" head={false} width={1.5} />
    </Scene>
  );
}

/** The Export submenu of the tab menu listing PNG / SVG / PDF / Markdown / JSON. */
export function ExportMenu() {
  const barY = 158;
  return (
    <Scene w={420} h={210}>
      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={64} label="Final" active />
      <AddTabButton x={88} y={barY + 8} />
      <Menu x={14} y={36} w={120} items={['Import', 'Export']} active={1} />
      <Menu x={148} y={48} w={130} items={['PNG', 'SVG', 'PDF', 'Markdown', 'JSON']} active={1} />
      <Arrow from={[134, 60]} to={[148, 70]} tone="muted" head={false} width={1.5} />
    </Scene>
  );
}

/** The Import-replaces-the-tab warning dialog naming the tab being overwritten. */
export function ImportWarning() {
  return (
    <Scene w={420} h={200} bg="plain">
      {/* Card drawn inline so we can shape the warning ourselves. No scrim: the
          scene has no canvas behind it, so a flat grey wash would just dull it. */}
      <rect
        x={86}
        y={36}
        width={248}
        height={128}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      {/* Amber warning glyph */}
      <g transform="translate(110 64)">
        <path
          d="M0 -10 L11 9 H-11 Z"
          className="fill-amber-100 stroke-amber-500"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <path d="M0 -3 v6" className="stroke-amber-500" strokeWidth={2} strokeLinecap="round" />
        <circle cx={0} cy={5} r={1.2} className="fill-amber-500" />
      </g>
      <Label x={132} y={58} size={13} weight={700} tone="strong">
        Replace this tab?
      </Label>
      <TextBar x={132} y={70} w={150} />
      <Label x={102} y={96} size={11} tone="body">
        Importing overwrites
      </Label>
      <Label x={206} y={96} size={11} weight={700} tone="accent">
        Draft
      </Label>
      <Label x={244} y={96} size={11} tone="body">
        .
      </Label>
      <TextBar x={102} y={110} w={196} tone="faint" />
      {/* Buttons */}
      <rect
        x={172}
        y={130}
        width={64}
        height={26}
        rx={7}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Label x={204} y={144} anchor="middle" size={11} weight={600} tone="body">
        Cancel
      </Label>
      <rect
        x={244}
        y={130}
        width={72}
        height={26}
        rx={7}
        className="fill-brand-500 stroke-brand-600"
        strokeWidth={1.5}
      />
      <Label x={280} y={144} anchor="middle" size={11} weight={600} tone="onAccent">
        Import
      </Label>
    </Scene>
  );
}

/** Before/after cleanup: scattered shapes on the left, snapped to a tidy grid
 *  (and auto-laid-out) on the right. */
export function CleanupBeforeAfter() {
  return (
    <Scene w={420} h={210}>
      <Label x={14} y={22} size={8} weight={700} tone="muted">
        BEFORE
      </Label>
      {/* Scattered, misaligned */}
      <Shape x={20} y={40} w={56} h={30} kind="rect" />
      <Shape x={108} y={64} w={56} h={30} kind="rect" />
      <Shape x={44} y={104} w={56} h={30} kind="rect" />
      <Shape x={128} y={132} w={56} h={30} kind="rect" />
      <Arrow from={[76, 55]} to={[108, 79]} tone="muted" />
      <Arrow from={[72, 79]} to={[72, 104]} tone="muted" />

      {/* Divider arrow */}
      <Arrow from={[196, 105]} to={[226, 105]} kind="straight" />

      <Label x={246} y={22} size={8} weight={700} tone="muted">
        AFTER
      </Label>
      {/* Snapped to a tidy grid */}
      <Shape x={250} y={48} w={56} h={30} kind="rect" accent />
      <Shape x={332} y={48} w={56} h={30} kind="rect" accent />
      <Shape x={250} y={120} w={56} h={30} kind="rect" accent />
      <Shape x={332} y={120} w={56} h={30} kind="rect" accent />
      <Arrow from={[306, 63]} to={[332, 63]} />
      <Arrow from={[278, 78]} to={[278, 120]} />
      <Arrow from={[360, 78]} to={[360, 120]} />
    </Scene>
  );
}

/** A locked tab: the active pill carries a padlock and the bar reads read-only. */
export function LockedTab() {
  const barY = 78;
  const px = 88;
  const pw = 116;
  return (
    <Scene w={420} h={150} bg="plain">
      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={66} label="Draft" />
      {/* The locked active tab: brand pill with a padlock before the label */}
      <g>
        <rect
          x={px}
          y={barY + 6}
          width={pw}
          height={30}
          rx={15}
          className="fill-brand-500 stroke-brand-600"
          strokeWidth={1.5}
        />
        <g transform={`translate(${px + 22} ${barY + 21})`}>
          <rect x={-5} y={-1} width={10} height={8} rx={1.5} className="fill-white" />
          <path
            d="M-3 -1 V-3.5 a3 3 0 0 1 6 0 V-1"
            fill="none"
            className="stroke-white"
            strokeWidth={1.6}
          />
        </g>
        <Label x={px + 40} y={barY + 21} size={11} weight={700} tone="onAccent">
          Approved
        </Label>
      </g>
      <TabPill x={212} y={barY + 8} w={62} label="Notes" />
      <AddTabButton x={282} y={barY + 8} />
      <Label x={px} y={barY - 12} size={9} tone="muted">
        Locked: read-only
      </Label>
    </Scene>
  );
}
