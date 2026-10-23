// The Explorer's events (liveworkspace/docs/telemetry.md "The Explorer on liveworkspace.app"): what the one
// Explorer page on liveworkspace.app may report, in the name of the app it is filtered to or, filtered to All
// Apps, of liveworkspace.app. Each is `Category·Action` with its closed set of type tokens, the fixed tokens
// @liveworkspace/explorer hands its host. The same names the apps' own Explorers always sent, so each app's
// dashboard keeps counting them.
//
// One list for the three that must agree: the site's emitter (it sends nothing else), the service's ingest (a
// batch from liveworkspace.app's origin stores nothing else), and the dashboards' emitter checks (each app's
// metric-emitters test reads these as the values the site can send).

import type { TelemetryWireEvent } from './wire';

// The Share dialog's `Shared` tokens, the apps' own: a level, a lifetime, one tab, then the changes.
const SHARE_TYPES = [
  'Edit',
  'Participate',
  'View',
  'ExpiryWeek',
  'ExpiryMonth',
  'ExpirySixMonths',
  'TabScoped',
  'Extended',
  'Rescoped',
  'PasswordSet',
  'PasswordCleared',
] as const;

// An item's noun in its app's team events: liveplanner's Project, livedesign's Design, the others' Document.
export const TEAM_ITEM_TYPES = ['Project', 'Design', 'Document'] as const;

export const EXPLORER_TELEMETRY_EVENTS = {
  // The Timeline view: its mode, a category or the actor filter, a page read, a card, stack or menu opened, an
  // entry or a stack removed.
  'Timeline·Changed': ['List', 'Calendar'],
  'Timeline·Selected': [
    'Everyone',
    'Others',
    'new',
    'edits',
    'renames',
    'deletions',
    'sharing',
    'filing',
    'favourites',
    'other',
  ],
  'Timeline·Loaded': ['More', 'Retry'],
  'Timeline·Opened': ['Card', 'Stack', 'Menu'],
  'Timeline·Removed': ['Entry', 'Stack'],
  // Home: What Happened, See Timeline, and the first run's welcome.
  'Home·Selected': [
    'WhatHappened',
    'SeeTimeline',
    'Welcome.Blank',
    'Welcome.Template',
    'Welcome.AllTemplates',
    'Welcome.Search',
    'Welcome.StartBlank',
    'Welcome.SignIn',
  ],
  'Home·Opened': ['Group', 'Welcome'],
  // A failed read of Home retried.
  'Home·Loaded': ['Retry'],
  // The filter lens: a facet that gained a value, never the value.
  'Explorer·Selected': ['Text', 'OpensIn', 'Template', 'MadeBy', 'Edited', 'People', 'Space'],
  // The Inbox: opened, a row followed, a failed read retried.
  'Activity·Opened': [null],
  'Activity·Selected': ['Action', 'Card', 'Thread', 'CardThread', 'FormResponses'],
  'Activity·Loaded': ['Retry'],
  // The List / Card / Details toggle, and Home's banner closed.
  'UI·Toggled': ['ExplorerViewList', 'ExplorerViewCard', 'ExplorerViewDetails', 'HomeBannerOff'],
  // The Share dialog: a link, an embed or a live image copied, a live image's tab picked, Show Me, and a
  // pass revoked (under the item's own noun: a Plan is liveplanner's Project, the others' a Document). Sign In
  // followed from a guest's banner is a Selected too.
  'UI·Copied': ['ShareLink', 'EmbedCode', 'LiveImage'],
  'UI·Selected': ['LiveImageTab', 'SignInBannerExplorer'],
  'UI·Started': ['ShareTour'],
  'UI·Ended': ['ShareTourCompleted', 'ShareTourSkipped'],
  'Project·Removed': ['ShareLink'],
  'Document·Removed': ['ShareLink'],
  // A link made (its level, then its lifetime and one tab when it has them, an event each) or changed: under the
  // item's own noun, as the revoked pass.
  'Project·Shared': SHARE_TYPES,
  'Document·Shared': SHARE_TYPES,
  // Folders made (in a team's library: Team), re-parented and deleted; a default folder set or cleared, for the
  // app's own kind or a template family.
  'Folder·Created': [null, 'Team'],
  'Folder·Moved': [null],
  'Folder·Deleted': [null],
  'Folder·Changed': ['Kind', 'Template'],
  'Folder·Cleared': ['Kind', 'Template'],
  // The Trash: an item restored or deleted for good, a Trash emptied, by whose Trash it was.
  'Trash·Restored': ['Personal', 'Team'],
  'Trash·Deleted': ['Personal', 'Team'],
  'Trash·Cleared': ['Personal', 'Team'],
  // An item moved into a team, within one or between two, or out to My Work, under its app's noun (liveplanner's
  // Project, livedesign's Design, the others' Document).
  'Team·Added': TEAM_ITEM_TYPES,
  'Team·Moved': TEAM_ITEM_TYPES,
  'Team·Removed': TEAM_ITEM_TYPES,
  // A guest's sign-in banner: its reasons opened, the banner closed.
  'UI·Opened': ['SignInReasonsExplorer'],
  'UI·Closed': ['SignInBannerExplorer'],
} as const satisfies Record<string, readonly (string | null)[]>;

export type ExplorerTelemetryKey = keyof typeof EXPLORER_TELEMETRY_EVENTS;

const TYPES = EXPLORER_TELEMETRY_EVENTS as Record<string, readonly (string | null)[]>;

/** Whether the Explorer could have sent this event: a known pair with one of its own tokens. */
export function isExplorerTelemetryEvent(event: TelemetryWireEvent): boolean {
  const types = TYPES[`${event.category}·${event.action}`];
  return types !== undefined && types.includes(event.type ?? null);
}
