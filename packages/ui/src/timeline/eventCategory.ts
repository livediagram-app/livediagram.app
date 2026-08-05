// What a reader would call a kind of event (spec/138 §2.3).
//
// The filter chips used to slice by SOURCE type — Diagrams, Teams,
// Account — which sounds reasonable and is nearly useless: comments,
// edits, renames, actions, sharing and deletions are all `diagram`, so
// one chip covered most of a personal feed and turning it off left
// almost nothing. "Hide the diagram stuff" is not a thing anyone wants.
//
// These are the groupings people actually ask for. Coarser than the
// event type (nobody wants a chip for `comment_resolved` separately
// from `comment_added`) and finer than the tone, which answers a
// different question — tone is how alarming, this is what happened.
//
// Anything unmapped falls to `other`, so an event type from a newer
// worker gets a chip rather than becoming unfilterable.

export type TimelineCategory =
  | 'comments'
  | 'new'
  | 'edits'
  | 'renames'
  | 'deletions'
  | 'sharing'
  | 'actions'
  | 'teams'
  | 'filing'
  | 'account'
  | 'other';

const BY_EVENT: Record<string, TimelineCategory> = {
  comment_added: 'comments',
  comment_resolved: 'comments',

  diagram_created: 'new',
  diagram_duplicated: 'new',

  diagram_edited: 'edits',

  diagram_renamed: 'renames',
  team_renamed: 'renames',

  // Grouped by consequence, not by which table the row was in: losing a
  // diagram, a folder, a team, or a working token are the same kind of
  // news, and someone scanning for "did anything disappear?" wants them
  // in one place.
  diagram_deleted: 'deletions',
  folder_deleted: 'deletions',
  theme_deleted: 'deletions',
  team_deleted: 'deletions',
  token_revoked: 'deletions',

  // Everything about who can reach a diagram, including the two events
  // that say somebody actually did.
  share_link_created: 'sharing',
  share_link_expiring: 'sharing',
  diagram_opened_by_visitor: 'sharing',
  diagram_copied_by_visitor: 'sharing',
  team_diagram_added: 'sharing',

  action_assigned: 'actions',
  action_completed: 'actions',

  team_created: 'teams',
  team_invite_received: 'teams',
  team_invite_accepted: 'teams',
  team_invite_declined: 'teams',
  team_member_joined: 'teams',
  team_member_left: 'teams',
  team_member_removed: 'teams',
  team_role_changed: 'teams',
  team_invite_link_enabled: 'teams',
  team_invite_link_disabled: 'teams',

  // Where a diagram lives, including which side of the network it's on.
  diagram_moved: 'filing',
  diagram_offline: 'filing',
  diagram_synced: 'filing',
  folder_created: 'filing',

  token_created: 'account',
  token_expiring: 'account',
  theme_saved: 'account',
  image_uploaded: 'account',
};

export function eventCategory(eventType: string): TimelineCategory {
  return BY_EVENT[eventType] ?? 'other';
}

export const CATEGORY_LABELS: Record<TimelineCategory, string> = {
  comments: 'Comments',
  new: 'New diagrams',
  edits: 'Edits',
  renames: 'Renames',
  deletions: 'Deletions',
  sharing: 'Sharing',
  actions: 'Actions',
  teams: 'Teams',
  filing: 'Filing',
  account: 'Account',
  other: 'Other',
};

// Chip order. Fixed rather than alphabetical or by frequency, so the
// chips don't rearrange as the feed changes underneath them — a control
// that moves between visits is one you have to re-read every time.
// Roughly most-looked-for first.
const ORDER: TimelineCategory[] = [
  'comments',
  'actions',
  'new',
  'edits',
  'renames',
  'deletions',
  'sharing',
  'teams',
  'filing',
  'account',
  'other',
];

export function sortCategories(categories: Iterable<TimelineCategory>): TimelineCategory[] {
  return [...categories].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
}

// The telemetry `type` slot is a bounded token (spec/22), so the id is
// sent rather than the label — no spaces, and stable if a label is
// reworded later.
export function categoryToken(category: TimelineCategory): string {
  return category;
}
