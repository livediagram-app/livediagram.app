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
  'AI·Used',
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
  // Community (docs/specs/025-community/community.md "Telemetry"): publish, Edit Listing and Remove
  // From Community in the Share dialog.
  'Community·Changed',
  'Community·Removed',
  'Community·Shared',
  // Landing funnel (docs/specs/019-marketing/landing-funnel.md): a public-page CTA brought somebody to /new
  // ('Opened'), and that visit created a document ('Created'). `type` is the
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
  // A pass issued in the Share dialog, typed by its level (Edit / Participate / View).
  'Document·Shared',
  // Draw mode (docs/specs/023-draw-mode/draw-mode.md): a Whiteboard tab created (Template /
  // NewTab / Import), a pen picked, the eraser mode or background changed, recognition toggled.
  'Draw·Changed',
  'Draw·Created',
  'Draw·Selected',
  'Draw·Toggled',
  'Document·Undone',
  // Google Drive mirror (docs/specs/022-drive-mirror/drive-mirror.md, "Telemetry").
  'Drive·Applied',
  'Drive·Changed',
  'Drive·Created',
  'Drive·Linked',
  'Drive·Opened',
  'Drive·Unlinked',
  // Editor modes (docs/specs/007-editor/editor-modes.md): a tab switched to Diagram or Draw.
  'Editor·Changed',
  'Element·Added',
  'Element·Changed',
  'Element·Copied',
  'Element·Created',
  'Element·Deleted',
  'Element·Duplicated',
  'Element·Imported',
  'Element·Linked',
  'Element·Locked',
  'Element·Removed',
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
  'Element·Voted',
  'Error·Api',
  'Error·Client',
  // The hosted reader's budget was spent and the photo import failed over to
  // the in-browser reader (docs/specs/021-event-storming/event-storming.md Phase 9).
  'Error·Warning',
  // The Explorer's filter lens (docs/specs/013-workspace/explorer-filters.md "Telemetry"): a facet that gained a value.
  'Explorer·Selected',
  // The facilitator baton (docs/specs/012-collaboration/facilitator.md): taken, handed on, stepped down. The
  // question is whether rooms use the role at all, never who held it.
  'Facilitator·Changed',
  'Facilitator·Ended',
  'Facilitator·Started',
  'Folder·Changed',
  'Folder·Cleared',
  'Folder·Created',
  'Folder·Deleted',
  'Folder·Moved',
  'Folder·Renamed',
  'Home·Loaded',
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
  'Participant·Moved',
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
  'Tab·Ended',
  'Tab·Imported',
  'Tab·Linked',
  'Tab·Loaded',
  'Tab·Locked',
  'Tab·Moved',
  'Tab·Opened',
  'Tab·Removed',
  'Tab·Renamed',
  'Tab·Reordered',
  'Tab·Revealed',
  'Tab·Selected',
  'Tab·Started',
  'Tab·Toggled',
  'Tab·Unlocked',
  'Tab·Voted',
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
  // Trash (docs/specs/013-workspace/trash.md): a trashed document's card, and the document restored from it.
  'Trash·Cleared',
  'Trash·Deleted',
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
