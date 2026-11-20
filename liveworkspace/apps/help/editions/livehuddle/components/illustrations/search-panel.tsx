// Search-panel category illustrations (liveworkspace/docs/specs/017-help/help-centre.md): the global search overlay with
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

/** A document glyph: a small framed canvas with two nodes. */
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
      query="kitchen"
      groups={[
        {
          title: 'Spaces',
          rows: [{ icon: <DocumentIcon />, label: 'Kitchen social', active: true }],
        },
        {
          title: 'Tabs',
          rows: [{ icon: <TabIcon />, label: 'Kitchen', meta: 'current' }],
        },
        {
          title: 'Elements',
          rows: [
            { icon: <ElementIcon />, label: 'Kitchen sign', meta: 'on Kitchen' },
            { icon: <ElementIcon />, label: 'Kitchen rota', meta: 'on Ground Floor' },
          ],
        },
        {
          title: 'Help',
          rows: [{ icon: <HelpIcon />, label: 'Kitchen and Perks' }],
        },
      ]}
    />
  );
}

/** The editor's library scope: your spaces, then what Every App finds once you type. */
export function SearchDocuments() {
  return (
    <SearchOverlay
      query="onboarding"
      groups={[
        {
          title: 'Spaces',
          rows: [
            { icon: <DocumentIcon />, label: 'Onboarding office', active: true },
            { icon: <DocumentIcon />, label: 'Onboarding lounge' },
          ],
        },
        {
          title: 'Every App',
          rows: [{ icon: <SharedIcon />, label: 'Onboarding plan', meta: 'liveplanner' }],
        },
      ]}
    />
  );
}

/** The Explorer page's search: a team's space under Items, its folder tagged with the team, and the team. */
export function SearchTeams() {
  return (
    <SearchOverlay
      query="platform"
      groups={[
        {
          title: 'Items',
          rows: [{ icon: <DocumentIcon />, label: 'Platform office', active: true }],
        },
        {
          title: 'Folders',
          rows: [{ icon: <FolderIcon />, label: 'Platform services', meta: 'in Platform team' }],
        },
        {
          title: 'Teams',
          rows: [{ icon: <TeamIcon />, label: 'Platform team' }],
        },
      ]}
    />
  );
}

/** Results showing tabs and elements. */
export function SearchTabsAndElements() {
  return (
    <SearchOverlay
      query="meeting"
      groups={[
        {
          title: 'Tabs',
          rows: [{ icon: <TabIcon />, label: 'Meeting Rooms', active: true }],
        },
        {
          title: 'Elements',
          rows: [
            { icon: <ElementIcon />, label: 'Meeting Room sign', meta: 'on Meeting Rooms' },
            { icon: <ElementIcon />, label: 'Meeting table', meta: 'on Ground Floor' },
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
      query="coffee"
      groups={[
        {
          title: 'Spaces',
          rows: [{ icon: <DocumentIcon />, label: 'Coffee chat space', active: true }],
        },
        {
          title: 'Add to canvas',
          rows: [{ icon: <AddIcon />, label: 'Coffee Machine' }],
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
          rows: [{ icon: <CommandIcon />, label: 'Auto-align to Grid', active: true }],
        },
        {
          title: 'Help',
          rows: [{ icon: <HelpIcon />, label: 'Layout Cleanup' }],
        },
      ]}
    />
  );
}
