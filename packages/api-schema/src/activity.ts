// Inbox wire format (docs/specs/013-workspace/inbox.md): the cross-document list of what
// is outstanding for one reader — open actions assigned to them, open
// actions they assigned to others, and unresolved comment threads they
// are in.
//
// The api worker builds these from the collaboration index
// (`collab_actions` / `collab_threads`, a projection of the element
// JSON that stays the source of truth, docs/specs/012-collaboration/assigned-actions.md §1); the live app's
// Activity pane renders them. Present-tense by design: the Timeline
// (docs/specs/013-workspace/timeline.md) records that an action WAS assigned, this says whether it
// is still open.

// Where a row lives, and how the reader reaches it. `via` is how the
// document is visible to them (their own, a joined team's library, or
// shared with them); `shareCode` is set only for 'shared', so the client
// can build the visitor URL (docs/specs/013-workspace/embeds.md) the way Shared with You does.
export type ActivityPlace = {
  documentId: string;
  documentName: string;
  teamId: string | null;
  via: 'own' | 'team' | 'shared';
  shareCode: string | null;
  tabId: string;
  tabName: string;
  elementId: string;
  // The element's list name (its label, a table's first cell, or
  // "Untitled"), per `elementDisplayLabel` in @livediagram/document.
  elementLabel: string;
};

// An open action (docs/specs/012-collaboration/assigned-actions.md) the reader assigned or was assigned. The two
// flags are resolved server-side against the reader's identity AND the
// identities it used to be (docs/specs/013-workspace/inbox.md §2.2), so a self-assignment made as
// a guest still reads as "mine" after signing up.
export type ActivityAction = ActivityPlace & {
  id: string;
  name: string;
  description: string;
  assignee: { userId: string | null; name: string | null };
  assigner: { id: string; name: string | null };
  createdAt: number;
  updatedAt: number;
  assignedToMe: boolean;
  createdByMe: boolean;
};

// An unresolved comment thread the reader is in: they wrote a comment
// in it, or it is on a document they own (owners already hear about every
// new comment by email, docs/specs/014-identity/transactional-email.md).
export type ActivityThread = ActivityPlace & {
  commentCount: number;
  latest: { text: string; authorName: string; authorColor: string; at: number };
  firstAt: number;
  youCommented: boolean;
  onYourDocument: boolean;
  // The reader is @-mentioned in the thread (docs/specs/012-collaboration/comment-mentions.md).
  mentionsYou: boolean;
};

// An open Plan card (docs/specs/026-plan/items.md) whose Assignee is the reader (docs/specs/013-workspace/
// inbox.md §2.4). Not an ActivityPlace: a card is an item, not an element, and `board` (where the row
// opens it) is null when no board in its document shows it.
export type ActivityCard = {
  documentId: string;
  documentName: string;
  teamId: string | null;
  via: 'own' | 'team' | 'shared';
  shareCode: string | null;
  board: { tabId: string; tabName: string; elementId: string; title: string } | null;
  id: string;
  key: number;
  type: string;
  title: string;
  status: string | null;
  updatedAt: number;
};

// A Plan card's unresolved comment thread the reader is in (docs/specs/013-workspace/inbox.md §2.5):
// the card's identity and place, and the thread's facts as ActivityThread has them. Author ids never travel.
export type ActivityCardThread = Omit<ActivityCard, 'status' | 'updatedAt'> & {
  commentCount: number;
  latest: { text: string; authorName: string; authorColor: string; at: number };
  firstAt: number;
  youCommented: boolean;
  onYourDocument: boolean;
  mentionsYou: boolean;
};

export type ActivityReadResult = {
  actions: ActivityAction[];
  threads: ActivityThread[];
  cards: ActivityCard[];
  cardThreads: ActivityCardThread[];
};

// Ceiling per kind (actions, threads, cards) on one read. The page is an inbox, not a history: a
// reader with more than this outstanding is not going to scroll to the
// hundredth, and the cap keeps the response bounded without paging.
export const ACTIVITY_LIST_MAX = 100;
