// Tabs-category scenes every product's help app draws the same (docs/specs/018-help/help-app.md): the tab
// bar, renaming a tab, tab folders opening in place, the Organise in Tab Folder dialog, cross-tab links, a
// before/after cleanup and a locked tab. Each product's illustrations/tabs.tsx re-exports the ones it uses.
// Composed only from the shared primitives so the house style holds.

import { Scene, Shape, Arrow, Label, Dialog, Cursor } from '../primitives';
import { TabPill, AddTabButton, FolderIcon, FolderGroup, TabBar, PickTile } from './tabs-parts';
import { Glyph } from './element-indicators';

/** The tab bar: several tabs, the active one raised with its ⋯ button, then the + button. */
export function TabBarOverview() {
  const barY = 158;
  return (
    <Scene w={420} h={210}>
      {/* The active tab's canvas above the bar */}
      <Shape x={84} y={56} w={92} h={44} kind="rect" accent label="Overview" />
      <Shape x={256} y={24} w={80} h={40} kind="rect" label="API" />
      <Shape x={256} y={92} w={80} h={40} kind="rect" label="Web" />
      <Arrow from={[176, 78]} to={[256, 44]} kind="elbow" tone="muted" />
      <Arrow from={[176, 78]} to={[256, 112]} kind="elbow" tone="muted" />
      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={98} label="Overview" active />
      <TabPill x={118} y={barY + 8} w={66} label="Systems" />
      <TabPill x={190} y={barY + 8} w={56} label="Teams" />
      <TabPill x={252} y={barY + 8} w={64} label="Scratch" />
      <AddTabButton x={322} y={barY + 8} />
    </Scene>
  );
}

/** Renaming a tab inline: the tab's name editor open with a text caret. */
export function RenamingTab() {
  const barY = 70;
  return (
    <Scene w={420} h={150} bg="plain">
      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={56} label="Tab 1" />
      {/* The tab being renamed: its name editor, ringed in the brand colour */}
      <g>
        <rect
          x={78}
          y={barY + 6}
          width={118}
          height={30}
          rx={7}
          className="fill-white stroke-brand-400"
          strokeWidth={2}
        />
        <Label x={90} y={barY + 21} size={11} weight={600} tone="strong">
          Payments
        </Label>
        <rect x={146} y={barY + 13} width={1.5} height={16} className="fill-brand-500" />
      </g>
      <TabPill x={204} y={barY + 8} w={58} label="Billing" />
      <AddTabButton x={268} y={barY + 8} />
      <Label x={78} y={barY - 14} size={10} tone="muted">
        Double-click the active tab, Enter to save
      </Label>
    </Scene>
  );
}

/** A tab folder opening in place: its header always holds a count; shut, only the tab you are on stays
 *  beside it; a click opens its tabs after the header on the bar, the neighbours sliding along. */
export function TabFolderStates() {
  const shutY = 40;
  const openY = 128;
  return (
    <Scene w={432} h={186}>
      <Label x={14} y={shutY - 14} size={10} tone="muted">
        Shut: the tab you are on stays out beside the folder
      </Label>
      <TabBar y={shutY} w={432} />
      <TabPill x={8} y={shutY + 8} w={70} label="Overview" />
      <FolderGroup
        x={80}
        y={shutY + 8}
        name="Plans"
        count={3}
        tabs={[{ label: 'Q1 plan', w: 84, active: true }]}
      />
      <TabPill x={252} y={shutY + 8} w={60} label="Notes" />
      <AddTabButton x={314} y={shutY + 8} />
      <Label x={14} y={openY - 14} size={10} tone="muted">
        Open: a click lays every tab out after the chip
      </Label>
      <TabBar y={openY} w={432} />
      <TabPill x={8} y={openY + 8} w={70} label="Overview" />
      <FolderGroup
        x={80}
        y={openY + 8}
        name="Plans"
        count={3}
        tabs={[
          { label: 'Q1 plan', w: 84, active: true },
          { label: 'Q2 plan', w: 60 },
          { label: 'Q3 plan', w: 60 },
        ]}
      />
      <TabPill x={370} y={openY + 8} w={58} label="Notes" />
    </Scene>
  );
}

/** The Organise in Tab Folder dialog: a No Folder tile, a tile per folder, and a New Folder
 *  tile. */
export function AddToFolderMenu() {
  const W = 420;
  const H = 210;
  const dx = 20;
  const dy = 18;
  return (
    <Scene w={W} h={H}>
      <Dialog x={dx} y={dy} w={380} h={174} title="Organise in Tab Folder" sceneW={W} sceneH={H}>
        <Label x={dx + 16} y={dy + 48} size={10} tone="muted">
          File this tab into a folder on the tab bar.
        </Label>
        <Label x={dx + 16} y={dy + 61} size={10} tone="muted">
          Same name means same folder.
        </Label>
        <PickTile x={dx + 16} y={dy + 78} w={84} label="No Folder" sub="Loose on the bar">
          <FolderIcon />
          <path d="M-3 -2 l6 6 M3 -2 l-6 6" className="stroke-slate-500" strokeWidth={1.3} />
        </PickTile>
        <PickTile x={dx + 104} y={dy + 78} w={84} label="Plans" sub="Current" selected>
          <FolderIcon />
        </PickTile>
        <PickTile x={dx + 192} y={dy + 78} w={84} label="Back office" sub="Folder">
          <FolderIcon />
        </PickTile>
        <PickTile x={dx + 280} y={dy + 78} w={84} label="New Folder" sub="Create here" dashed>
          <path
            d="M-6 0 h12 M0 -6 v12"
            className="stroke-slate-500"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </PickTile>
      </Dialog>
    </Scene>
  );
}

/** A link on one tab jumping to another: the element's Follow link badge, its hover card naming
 *  the destination, and the target tab in the bar. */
export function CrossTabLink() {
  const barY = 158;
  return (
    <Scene w={420} h={210}>
      {/* Source element with its link indicator along the top, under the pointer */}
      <Shape x={30} y={58} w={104} h={52} kind="rect" label="Database" />
      <Glyph kind="link" cx={120} cy={70} strength={1} />
      <Cursor x={122} y={74} />
      {/* The badge's hover card */}
      <rect
        x={70}
        y={8}
        width={170}
        height={34}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={80} y={19} size={10} weight={700} tone="strong">
        Follow link
      </Label>
      <Label x={80} y={33} size={10} tone="muted">
        Goes to tab &quot;DB internals&quot;
      </Label>

      {/* The jump */}
      <Arrow from={[140, 84]} to={[252, 84]} kind="curved" />

      {/* The target tab's content */}
      <Shape x={258} y={58} w={120} h={52} kind="rect" accent label="DB internals" />

      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={70} label="Overview" />
      <TabPill x={90} y={barY + 8} w={120} label="DB internals" active />
      <AddTabButton x={216} y={barY + 8} />
    </Scene>
  );
}

/** Before/after cleanup: scattered shapes on the left, snapped into tidy rows and columns on the
 *  right. */
export function CleanupBeforeAfter() {
  return (
    <Scene w={420} h={210}>
      <Label x={14} y={22} size={10} weight={700} tone="muted">
        BEFORE
      </Label>
      {/* Scattered, misaligned */}
      <Shape x={20} y={40} w={56} h={30} kind="rect" />
      <Shape x={108} y={64} w={56} h={30} kind="rect" />
      <Shape x={44} y={104} w={56} h={30} kind="rect" />
      <Shape x={128} y={132} w={56} h={30} kind="rect" />
      <Arrow from={[76, 55]} to={[108, 75]} tone="muted" />
      <Arrow from={[60, 70]} to={[60, 104]} tone="muted" />
      <Arrow from={[142, 94]} to={[152, 132]} tone="muted" />

      {/* Divider arrow */}
      <Arrow from={[196, 105]} to={[226, 105]} kind="straight" />

      <Label x={246} y={22} size={10} weight={700} tone="muted">
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

/** A locked tab: the padlock sits before its name in the tab bar. */
export function LockedTab() {
  const barY = 78;
  return (
    <Scene w={420} h={150} bg="plain">
      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={58} label="Draft" />
      <TabPill x={80} y={barY + 8} w={122} label="Approved" active locked />
      <TabPill x={210} y={barY + 8} w={60} label="Notes" />
      <AddTabButton x={276} y={barY + 8} />
      <Label x={80} y={barY - 14} size={10} tone="muted">
        Locked: read-only until unlocked
      </Label>
    </Scene>
  );
}
