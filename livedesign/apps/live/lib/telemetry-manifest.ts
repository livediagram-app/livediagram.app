// The category·action pairs the editor actually emits (docs/specs/017-telemetry/telemetry.md, issue #30).
//
// Pinned so telemetry can't drift silently. Emitting is fire-and-forget by
// design and the public dashboard only shows what ARRIVED, so a renamed or
// deleted event looks identical to a feature nobody used — there is no
// runtime signal at all. This list is that signal, enforced by
// telemetry-coverage.test.ts.
//
// Changing the editor's event vocabulary means updating THIS list and the
// taxonomy in docs/specs/017-telemetry/telemetry.md in the same change. That pairing is the
// whole point: the manifest catches the drift, the spec explains the event.
//
// Pairs only, not `type` values — types are open-ended by design (a shape
// kind, a template id, a help-article slug). The palette types, where drift
// is both invisible and costly, are pinned separately in
// packages/api-schema's PALETTE_TELEMETRY_TYPES.
export const EMITTED_EVENT_PAIRS: readonly string[] = [
  'Action·Changed',
  'Action·Created',
  'Action·Deleted',
  'Action·Moved',
  'Action·Opened',
  'Action·Resolved',
  'Action·Unresolved',
  'Agent·Opened',
  'Canvas·Changed',
  'Canvas·Used',
  'Canvas·Zoomed',
  'Comment·Added',
  'Comment·Deleted',
  'Comment·Mentioned',
  'Comment·Opened',
  'Comment·Resolved',
  'Comment·Unresolved',
  // Landing funnel (docs/specs/019-marketing/landing-funnel.md): a public-page CTA brought somebody to /new
  // ('Opened'), and that visit created a design ('Created'). `type` is the
  // CTA's source from the closed CTA_SOURCES table.
  'Cta·Created',
  'Cta·Opened',
  // The Explorer's Inbox (lib/explorer-inbox-host.tsx): 'Opened' once a visit, 'Selected' a row followed (by its
  // kind), 'Loaded' a failed read retried.
  'Activity·Loaded',
  'Activity·Opened',
  'Activity·Selected',
  'Document·Created',
  'Document·Deleted',
  'Document·Duplicated',
  'Document·Exported',
  'Document·Loaded',
  'Document·Moved',
  'Document·Redone',
  // A share link revoked in the Share dialog (type ShareLink).
  'Document·Removed',
  'Document·Renamed',
  'Document·Shared',
  // The markers (docs/specs/023-draw-mode/drawing-tools.md): a marker's colour or width changed,
  // a stroke flipped between ink and a shape.
  'Draw·Changed',
  'Draw·Toggled',
  'Document·Undone',
  'Element·Added',
  'Element·Changed',
  'Element·Copied',
  'Element·Created',
  'Element·Deleted',
  'Element·Duplicated',
  'Element·Linked',
  'Element·Locked',
  'Element·Reordered',
  // A search submitted in the image picker (docs/specs/009-elements/image-search.md).
  'Element·Searched',
  'Element·Selected',
  'Element·Toggled',
  'Element·Unlinked',
  'Element·Unlocked',
  // Playback started on a video element (docs/specs/009-elements/youtube-video.md),
  // or a search result attached to an image (docs/specs/009-elements/image-search.md).
  'Element·Used',
  'Error·Api',
  'Error·Client',
  // A degradation the load was carried through rather than stopped by (lib/api/error-report.ts).
  'Error·Warning',
  // An editor freed an element somebody else was holding (docs/specs/007-editor/live-app.md lock), type
  // 'Unlocked'. The category keeps the name the dashboard already counts it under.
  'Facilitator·Changed',
  // The Explorer's filter lens (docs/specs/013-workspace/explorer-filters.md "Telemetry"): a facet that gained a value.
  'Explorer·Selected',
  'Folder·Changed',
  'Folder·Cleared',
  'Folder·Created',
  'Folder·Deleted',
  'Folder·Moved',
  'Folder·Renamed',
  'Home·Loaded',
  // Explorer Home's What Happened (docs/specs/013-workspace/explorer-home.md): Selected (an entry opened its design,
  // WhatHappened; See Timeline followed, SeeTimeline), Opened (a summary dealt out, Group).
  'Home·Opened',
  'Home·Selected',
  'Layer·Added',
  'Layer·Changed',
  'Layer·Cleared',
  'Layer·Deleted',
  'Layer·Moved',
  'Layer·Opened',
  'Layer·Removed',
  'Layer·Renamed',
  'Layer·Reordered',
  'Layer·Selected',
  'Layer·Toggled',
  'Note·Added',
  'Note·Changed',
  'Note·Deleted',
  'Note·Opened',
  'Note·Used',
  'Participant·Created',
  'Participant·Returned',
  'Search·Opened',
  'Search·Searched',
  'Search·Selected',
  'Session·Deleted',
  'Session·Opened',
  'Session·SignedOut',
  'Tab·Aligned',
  'Tab·Changed',
  'Tab·Cleared',
  'Tab·Closed',
  'Tab·Created',
  'Tab·Deleted',
  'Tab·Duplicated',
  'Tab·Imported',
  'Tab·Linked',
  'Tab·Loaded',
  'Tab·Locked',
  'Tab·Moved',
  'Tab·Opened',
  'Tab·Removed',
  'Tab·Renamed',
  'Tab·Reordered',
  'Tab·Selected',
  'Tab·Unlocked',
  'Team·Added',
  'Team·Moved',
  'Team·Removed',
  'Template·Used',
  'Theme·Changed',
  // The shared Explorer's Timeline (docs/specs/013-workspace/timeline.md): Changed (Cards or Calendar), Selected (a
  // kind of event switched off, Everyone or Others), Loaded (More or Retry), Opened (a Card, a Stack or a card's
  // Menu), Removed (an Entry or a whole Stack taken off the reader's own Timeline).
  'Timeline·Changed',
  'Timeline·Loaded',
  'Timeline·Opened',
  'Timeline·Removed',
  'Timeline·Selected',
  'Token·Created',
  // A token's owner allowed a workbench on the pairing page (docs/specs/013-workspace/workbench-embeds.md).
  'Token·Linked',
  'Trash·Cleared',
  'Trash·Deleted',
  // Trash (docs/specs/013-workspace/trash.md): a trashed design's card, and the design restored from it.
  'Trash·Opened',
  'Trash·Restored',
  'UI·Added',
  'UI·Changed',
  // A browser repair from the load-error screen (docs/specs/007-editor/load-recovery.md).
  'UI·Cleared',
  'UI·Closed',
  'UI·Copied',
  // The power user mode offer turned down (docs/specs/007-editor/power-user-mode.md).
  'UI·Declined',
  'UI·Ended',
  'UI·Moved',
  'UI·Opened',
  'UI·Removed',
  'UI·Searched',
  'UI·Selected',
  'UI·Started',
  'UI·Toggled',
  'UI·Used',
  'UI·View',
];
