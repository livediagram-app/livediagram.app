// Tabs-category illustrations (docs/specs/018-help/help-app.md): the tab bar and its tabs,
// tab folders opening in place, the tab menu (toolbar over full-width rows split into groups),
// the Organise in Tab Folder / Add to Document / Import / Export dialogs, cross-tab links and a
// before/after cleanup. Labels are the editor's own (TabPortalMenu,
// TabOrganiseDialogs, ImportTabDialog, ExportTabDialog).
// Composed only from the shared primitives so the house style holds.
//
// The scenes every product draws the same live in @liveworkspace/help-site (tabs-scenes, over the
// tab-bar parts in tabs-parts), the Import and Export ones in ./tabs-import-export; this module keeps
// the tab menu and the Add to dialog.

import { Scene, Label, Dialog } from '@liveworkspace/help-site/art/primitives';
import {
  TabPill,
  AddTabButton,
  TabBar,
  MenuRowList,
} from '@liveworkspace/help-site/art/illustrations/tabs-parts';

export {
  TabBarOverview,
  RenamingTab,
  TabFolderStates,
  AddToFolderMenu,
  CrossTabLink,
} from '@liveworkspace/help-site/art/illustrations/tabs-scenes';
export { ImportMenu, ExportMenu, ImportWarning } from './tabs-import-export';

/** The tab menu: the quick-action toolbar (Rename, Duplicate, Paste, Side by Side, Delete) over
 *  full-width rows in two groups (folders and documents, content), opened from the
 *  active tab's ⋯ button. */
export function TabMenu() {
  const barY = 178;
  const mx = 150;
  const my = 10;
  const mw = 200;
  const rows = [
    'Organise in Tab Folder',
    'Add to Another Space',
    null,
    'Import',
    'Export',
    'Clear',
  ];
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
        height={152}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Toolbar: Rename, Duplicate, Paste, Side by Side | Delete */}
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
      {/* Delete at the right edge */}
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
      <Label x={14} y={30} size={10} tone="muted">
        Rename, Duplicate,
      </Label>
      <Label x={14} y={44} size={10} tone="muted">
        Paste, Side by Side,
      </Label>
      <Label x={14} y={58} size={10} tone="muted">
        then Delete
      </Label>
    </Scene>
  );
}

/** The Add to Document dialog: a filter box over a grid of your other documents. */
export function AddToDocumentMenu() {
  const W = 420;
  const H = 210;
  const dx = 30;
  const dy = 14;
  const docs = ['Roadmap 2026', 'Onboarding', 'Architecture'];
  return (
    <Scene w={W} h={H}>
      <Dialog x={dx} y={dy} w={360} h={182} title="Add to Another Space" sceneW={W} sceneH={H}>
        <rect
          x={dx + 16}
          y={dy + 48}
          width={328}
          height={24}
          rx={6}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <Label x={dx + 26} y={dy + 61} size={11} tone="muted">
          Filter spaces…
        </Label>
        {docs.map((d, i) => {
          const tx = dx + 16 + i * 112;
          const ty = dy + 84;
          return (
            <g key={d}>
              <rect
                x={tx}
                y={ty}
                width={104}
                height={84}
                rx={8}
                className={
                  i === 2 ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'
                }
                strokeWidth={1.5}
              />
              {/* The destination's snapshot thumbnail */}
              <rect
                x={tx + 8}
                y={ty + 8}
                width={88}
                height={48}
                rx={4}
                className="fill-slate-50 stroke-slate-200"
                strokeWidth={1}
              />
              <rect
                x={tx + 18}
                y={ty + 18}
                width={24}
                height={14}
                rx={3}
                className="fill-brand-200"
              />
              <rect
                x={tx + 58}
                y={ty + 30}
                width={26}
                height={16}
                rx={3}
                className="fill-brand-100 stroke-brand-300"
                strokeWidth={1}
              />
              <Label
                x={tx + 52}
                y={ty + 70}
                anchor="middle"
                size={10}
                weight={600}
                tone={i === 2 ? 'accent' : 'strong'}
              >
                {d}
              </Label>
            </g>
          );
        })}
      </Dialog>
    </Scene>
  );
}
