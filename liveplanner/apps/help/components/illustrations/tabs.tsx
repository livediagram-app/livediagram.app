// Tabs-category illustrations (docs/specs/018-help/help-app.md): the tab bar and its tabs,
// tab folders opening in place, the tab menu (toolbar over full-width rows split into groups),
// the Organise in Tab Folder / Import / Export dialogs, cross-tab links, a locked
// tab, and a before/after cleanup. Labels are the editor's own (TabPortalMenu,
// TabOrganiseDialogs, ImportTabDialog, ExportTabDialog).
// Composed only from the shared primitives so the house style holds.
//
// The scenes every product draws the same live in @liveworkspace/help-site (tabs-scenes, over the
// tab-bar parts in tabs-parts), the Import and Export ones in ./tabs-import-export; this module keeps
// the tab menu.

import { Scene, Label } from '@liveworkspace/help-site/art/primitives';
import {
  Padlock,
  TabPill,
  AddTabButton,
  TabBar,
  MenuRowList,
} from '@liveworkspace/help-site/art/illustrations/tabs-parts';

export {
  TabFolderStates,
  AddToFolderMenu,
  CleanupBeforeAfter,
  LockedTab,
} from '@liveworkspace/help-site/art/illustrations/tabs-scenes';
export {
  ImportMenu,
  ImportChooser,
  ExportMenu,
  ImportWarning,
  TrackerImportPreview,
} from './tabs-import-export';

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

/** The tab menu: the quick-action toolbar (Rename, Duplicate, Paste, Lock Tab, Delete) over
 *  full-width rows in two groups (folders, content), opened from the active tab's ⋯ button. */
export function TabMenu() {
  const barY = 178;
  const mx = 150;
  const my = 28;
  const mw = 200;
  const rows = ['Organise in Tab Folder', null, 'Import…', 'Export', 'Clear'];
  return (
    <Scene w={420} h={230}>
      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={64} label="Draft" />
      <TabPill x={252} y={barY + 8} w={98} label="Overview" active />
      <AddTabButton x={356} y={barY + 8} />
      {/* The menu, right-aligned above the ⋯ button */}
      <rect
        x={mx}
        y={my}
        width={mw}
        height={134}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Toolbar: Rename, Duplicate, Paste, Side by Side | Lock Tab, Delete */}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={mx + 8 + i * 30}
          y={my + 8}
          width={24}
          height={24}
          rx={5}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1}
        />
      ))}
      {/* Rename (pencil) */}
      <path
        d={`M${mx + 15} ${my + 26} l2 -5 l7 -7 l3 3 l-7 7 Z`}
        className="fill-none stroke-slate-500"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* Duplicate (two squares) */}
      <rect
        x={mx + 44}
        y={my + 13}
        width={10}
        height={10}
        rx={2}
        className="fill-none stroke-slate-500"
        strokeWidth={1.4}
      />
      <rect
        x={mx + 48}
        y={my + 17}
        width={10}
        height={10}
        rx={2}
        className="fill-white stroke-slate-500"
        strokeWidth={1.4}
      />
      {/* Paste (clipboard) */}
      <rect
        x={mx + 75}
        y={my + 13}
        width={12}
        height={14}
        rx={2}
        className="fill-none stroke-slate-500"
        strokeWidth={1.4}
      />
      <rect
        x={mx + 78}
        y={my + 11}
        width={6}
        height={4}
        rx={1}
        className="fill-white stroke-slate-500"
        strokeWidth={1.2}
      />
      {/* Side by Side (two panes) */}
      <rect
        x={mx + 103}
        y={my + 14}
        width={14}
        height={12}
        rx={2}
        className="fill-none stroke-slate-500"
        strokeWidth={1.4}
      />
      <line
        x1={mx + 110}
        y1={my + 14}
        x2={mx + 110}
        y2={my + 26}
        className="stroke-slate-500"
        strokeWidth={1.4}
      />
      {/* Lock Tab + Delete at the right edge */}
      <rect
        x={mx + mw - 62}
        y={my + 8}
        width={24}
        height={24}
        rx={5}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1}
      />
      <g transform={`translate(${mx + mw - 50} ${my + 21})`}>
        <Padlock tone="muted" />
      </g>
      <rect
        x={mx + mw - 32}
        y={my + 8}
        width={24}
        height={24}
        rx={5}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1}
      />
      <path
        d={`M${mx + mw - 26} ${my + 15} h12 M${mx + mw - 23} ${my + 15} v11 h6 v-11 M${mx + mw - 22} ${my + 15} v-2 h4 v2`}
        className="fill-none stroke-rose-500"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <line
        x1={mx}
        y1={my + 40}
        x2={mx + mw}
        y2={my + 40}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      <MenuRowList x={mx} y={my + 46} w={mw} rows={rows} />
      <Label x={14} y={48} size={10} tone="muted">
        Rename, Duplicate,
      </Label>
      <Label x={14} y={62} size={10} tone="muted">
        Paste, Side by Side,
      </Label>
      <Label x={14} y={76} size={10} tone="muted">
        then Lock Tab, Delete
      </Label>
    </Scene>
  );
}
