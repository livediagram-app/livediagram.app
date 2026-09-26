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
  'AI·Toggled',
  'AI·Used',
  'Action·Changed',
  'Action·Created',
  'Action·Deleted',
  'Action·Moved',
  'Action·Opened',
  'Action·Resolved',
  'Action·Unresolved',
  // Activity (docs/specs/013-workspace/activity-page.md): the Explorer's cross-diagram inbox. 'Opened'
  // once per visit, 'Selected' with type 'Action' | 'Thread' on a row
  // click, 'Loaded'/'Retry' after a failed read.
  'Activity·Loaded',
  'Activity·Opened',
  'Activity·Selected',
  'Canvas·Changed',
  'Canvas·Used',
  'Canvas·Zoomed',
  'Comment·Added',
  'Comment·Deleted',
  'Comment·Opened',
  'Comment·Resolved',
  'Comment·Unresolved',
  // Landing funnel (docs/specs/019-marketing/landing-funnel.md): a public-page CTA brought somebody to /new
  // ('Opened'), and that visit created a diagram ('Created'). `type` is the
  // CTA's source from the closed CTA_SOURCES table.
  'Cta·Created',
  'Cta·Opened',
  'Diagram·Created',
  'Diagram·Deleted',
  'Diagram·Duplicated',
  'Diagram·Exported',
  'Diagram·Loaded',
  'Diagram·Moved',
  'Diagram·Redone',
  'Diagram·Removed',
  'Diagram·Renamed',
  'Diagram·Reverted',
  'Diagram·Shared',
  'Diagram·Undone',
  'Element·Added',
  'Element·Changed',
  'Element·Copied',
  'Element·Deleted',
  'Element·Duplicated',
  'Element·Linked',
  'Element·Locked',
  'Element·Removed',
  'Element·Reordered',
  'Element·Selected',
  'Element·Toggled',
  'Element·Unlinked',
  'Element·Unlocked',
  // Playback started on a video element (docs/specs/009-elements/youtube-video.md).
  'Element·Used',
  'Element·Voted',
  'Error·Api',
  'Error·Client',
  // The hosted reader's budget was spent and the photo import failed over to
  // the in-browser reader (docs/specs/021-event-storming/event-storming.md Phase 9).
  'Error·Warning',
  // The facilitator baton (docs/specs/012-collaboration/facilitator.md): taken, handed on, stepped down. The
  // question is whether rooms use the role at all, never who held it.
  'Facilitator·Changed',
  'Facilitator·Ended',
  'Facilitator·Started',
  'Folder·Created',
  'Folder·Deleted',
  'Folder·Moved',
  'Folder·Renamed',
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
  'Tab·Created',
  'Tab·Deleted',
  'Tab·Duplicated',
  'Tab·Ended',
  'Tab·Imported',
  'Tab·Linked',
  'Tab·Loaded',
  'Tab·Locked',
  'Tab·Moved',
  'Tab·Removed',
  'Tab·Renamed',
  'Tab·Reordered',
  'Tab·Revealed',
  'Tab·Started',
  'Tab·Toggled',
  'Tab·Unlocked',
  'Tab·Voted',
  'Team·Added',
  'Team·Changed',
  'Team·Created',
  // The recipient turned an invitation down — the counterpart to Team·Joined,
  // and distinct from Team·Removed·Invite (an Admin withdrawing one). docs/specs/013-workspace/teams.md.
  'Team·Declined',
  'Team·Deleted',
  'Team·Joined',
  'Team·Moved',
  'Team·Removed',
  'Team·Shared',
  'Template·Used',
  'Theme·Changed',
  'Theme·Created',
  'Theme·Deleted',
  // Timeline (docs/specs/013-workspace/timeline.md): 'Opened' with type 'Landing' | 'Nav' | 'Stack'
  // — the first two measure the landing-page change, the third tells us
  // whether the stacking thresholds are right. 'Changed' carries the
  // view mode, 'Selected' a filter chip's source type, 'Loaded'/'More'
  // a Show-more click, 'Removed'/'Entry' a card taken off the feed
  // (docs/specs/013-workspace/timeline.md §2.9).
  'Timeline·Changed',
  'Timeline·Loaded',
  'Timeline·Opened',
  'Timeline·Removed',
  'Timeline·Selected',
  'Token·Created',
  'Token·Removed',
  'UI·Added',
  'UI·Changed',
  'UI·Closed',
  'UI·Copied',
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
