// Search-panel category illustrations (docs/specs/018-help/help-app.md): the global search overlay with
// a query field and results grouped by type. Composed only from the shared
// primitives (plus a few raw motifs the kit lacks, like the magnifier glyph) so
// the house style holds. The overlay frame is the shared figure's, and every article fills it with
// different result rows.

import {
  AddIcon,
  CommandIcon,
  ElementIcon,
  FolderIcon,
  HelpIcon,
  SearchOverlay,
  SharedIcon,
  TabIcon,
  TeamIcon,
} from '@liveworkspace/help-site/art/illustrations/search-panel-frame';

// The overlay, its result icons and the Create a Tab and Settings scenes are the shared figure's
// (@liveworkspace/help-site/art/illustrations/search-panel-frame); the scenes below fill it with this app's rows.
export {
  SearchCreateTab,
  SearchSettings,
} from '@liveworkspace/help-site/art/illustrations/search-panel-frame';

/** A document glyph: a small framed page with two blocks. */
function DocumentIcon() {
  return (
    <g>
      <rect
        x={-7}
        y={-6}
        width={14}
        height={12}
        rx={2.5}
        className="fill-white stroke-brand-400"
        strokeWidth={1.5}
      />
      <rect x={-4.5} y={-3.5} width={4} height={3.5} rx={1} className="fill-brand-300" />
      <rect x={1} y={0.5} width={4} height={3.5} rx={1} className="fill-brand-200" />
    </g>
  );
}

/** Mixed results across documents, tabs, elements, actions and help: search at a glance. */
export function SearchOverview() {
  return (
    <SearchOverlay
      query="check"
      groups={[
        {
          title: 'Documents',
          rows: [{ icon: <DocumentIcon />, label: 'Checkout flow', active: true }],
        },
        {
          title: 'Tabs',
          rows: [{ icon: <TabIcon />, label: 'Checkout', meta: 'current' }],
        },
        {
          title: 'Elements',
          rows: [
            { icon: <ElementIcon />, label: 'Check stock', meta: 'on Checkout' },
            { icon: <ElementIcon />, label: 'Payment check', meta: 'on Payments' },
          ],
        },
        {
          title: 'Help',
          rows: [{ icon: <HelpIcon />, label: 'Checklists' }],
        },
      ]}
    />
  );
}

/** Results limited to documents, folders, and shared documents. */
export function SearchDocuments() {
  return (
    <SearchOverlay
      query="onboarding"
      groups={[
        {
          title: 'Documents',
          rows: [{ icon: <DocumentIcon />, label: 'Onboarding flow', active: true }],
        },
        {
          title: 'Shared with You',
          rows: [{ icon: <SharedIcon />, label: 'Onboarding v2' }],
        },
        {
          title: 'My Work',
          rows: [{ icon: <FolderIcon />, label: 'Onboarding' }],
        },
      ]}
    />
  );
}

/** Results showing teams plus their shared folders and documents. */
export function SearchTeams() {
  return (
    <SearchOverlay
      query="platform"
      groups={[
        {
          title: 'Teams',
          rows: [
            { icon: <TeamIcon />, label: 'Platform team', active: true },
            { icon: <FolderIcon />, label: 'Architecture / Services', meta: 'in Platform team' },
            { icon: <DocumentIcon />, label: 'Platform overview', meta: 'in Platform team' },
          ],
        },
      ]}
    />
  );
}

/** Results showing tabs and elements, including table-cell text. */
export function SearchTabsAndElements() {
  return (
    <SearchOverlay
      query="revenue"
      groups={[
        {
          title: 'Tabs',
          rows: [{ icon: <TabIcon />, label: 'Revenue model', active: true }],
        },
        {
          title: 'Elements',
          rows: [
            { icon: <ElementIcon />, label: 'Revenue growth', meta: 'on Revenue model' },
            { icon: <ElementIcon />, label: 'Revenue 2026: 1.2m', meta: 'on Forecast' },
          ],
        },
      ]}
    />
  );
}

/** Palette results under Add to canvas, below an ordinary document match. */
export function SearchAddToCanvas() {
  return (
    <SearchOverlay
      query="cylinder"
      groups={[
        {
          title: 'Documents',
          rows: [{ icon: <DocumentIcon />, label: 'Storage cylinder demo', active: true }],
        },
        {
          title: 'Add to canvas',
          rows: [{ icon: <AddIcon />, label: 'Cylinder' }],
        },
      ]}
    />
  );
}

/** The command palette: actions for a typed verb, with a matching setting below. */
export function SearchCommandPalette() {
  return (
    <SearchOverlay
      query="layout"
      groups={[
        {
          title: 'Actions',
          rows: [
            { icon: <CommandIcon />, label: 'Auto Layout (tidy up)', active: true },
            { icon: <CommandIcon />, label: 'Auto Layout: Layered (down)' },
            { icon: <CommandIcon />, label: 'Auto Layout: Layered (right)' },
            { icon: <CommandIcon />, label: 'Auto Layout: Tree' },
            { icon: <CommandIcon />, label: 'Auto Layout: Radial' },
          ],
        },
        {
          title: 'Help',
          rows: [{ icon: <HelpIcon />, label: 'Layout Cleanup' }],
        },
      ]}
    />
  );
}
