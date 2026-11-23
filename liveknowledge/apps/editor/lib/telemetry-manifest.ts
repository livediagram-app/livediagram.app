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
  // Community (docs/specs/025-community/blueprints/community.md "Telemetry"): publish, Edit Listing and Remove
  // From Community in the Share dialog; Copied when a Community tile on Start Making Pages is chosen
  // (docs/specs/007-editor/start-diagramming.md "From the Community").
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
  'Activity·Added',
  'Activity·Changed',
  'Activity·Loaded',
  'Activity·Opened',
  'Activity·Resolved',
  'Activity·Selected',
  // Automations (docs/specs/013-workspace/automations.md "Telemetry"): a rule, draft or secret Created; a secret
  // Changed or Copied; a rule Toggled on or off, Deleted, Tested, or Ran by hand (components/automations).
  'Document·Changed',
  'Document·Copied',
  'Document·Created',
  'Document·Deleted',
  'Document·Duplicated',
  'Document·Exported',
  'Document·Loaded',
  'Document·Moved',
  'Document·Ran',
  'Document·Redone',
  // A share link revoked in the Share dialog (type ShareLink).
  'Document·Removed',
  'Document·Renamed',
  'Document·Shared',
  'Document·Tested',
  'Document·Toggled',
  'Document·Undone',
  'Element·Added',
  'Element·Changed',
  'Element·Copied',
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
  // The Explorer's filter lens (docs/specs/013-workspace/explorer-filters.md "Telemetry"): a facet that gained a value.
  'Explorer·Selected',
  // An editor freed an element somebody else was holding (docs/specs/007-editor/editor-app.md lock), type
  // 'Unlocked'. The category keeps the name the dashboard already counts it under.
  'Facilitator·Changed',
  'Folder·Changed',
  'Folder·Cleared',
  'Folder·Created',
  'Folder·Deleted',
  'Folder·Moved',
  'Folder·Renamed',
  'Home·Loaded',
  // A Home pick (Most Used, Recent, See More) in the workbench frame (docs/specs/013-workspace/explorer-home.md).
  'Home·Selected',
  'Layer·Renamed',
  // The Library (liveworkspace/docs/specs/006-media/libraries.md "Telemetry"): typed Personal or Team.
  'Library·Added',
  'Library·Created',
  // Note·* left with element notes (docs/specs/009-elements/links-and-notes-retired.md).
  'Participant·Created',
  'Participant·Returned',
  'Search·Opened',
  'Search·Searched',
  'Search·Selected',
  'Session·Deleted',
  'Session·Opened',
  'Session·SignedOut',
  'Snapshot·Created',
  'Snapshot·Deleted',
  'Snapshot·Reverted',
  'Tab·Added',
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
  'Tab·Selected',
  'Tab·Started',
  'Tab·Unlocked',
  'Team·Added',
  'Team·Moved',
  'Team·Removed',
  'Template·Changed',
  'Template·Used',
  'Theme·Changed',
  'Token·Created',
  'Trash·Cleared',
  'Trash·Deleted',
  // Trash (docs/specs/013-workspace/trash.md): a trashed document's card, and the document restored from it.
  'Trash·Restored',
  'UI·Added',
  'UI·Changed',
  // A browser repair from the load-error screen (docs/specs/007-editor/load-recovery.md).
  'UI·Cleared',
  'UI·Closed',
  'UI·Copied',
  // Send to Plan's card made (liveworkspace/docs/specs/004-index/send-to-plan.md "Telemetry").
  'UI·Created',
  'UI·Ended',
  'UI·Moved',
  'UI·Opened',
  // Send to Plan refused by the index or the plan.
  'UI·Refused',
  'UI·Removed',
  'UI·Searched',
  'UI·Selected',
  'UI·Started',
  'UI·Toggled',
  'UI·Used',
  'Walkthrough·Abandoned',
  'Walkthrough·Created',
  'Walkthrough·Deleted',
  'Walkthrough·Played',
  'Walkthrough·Refused',
  'Walkthrough·Started',
  'UI·View',
  // Version history (docs/specs/006-document/version-history.md "Observability and telemetry"): the footer's History,
  // a name given, and the restore toast's Undo. Restored and Copied are counted by the api, by front door.
  'Version·Named',
  'Version·Opened',
  'Version·Undone',
];
