// Activity page wire format (spec/142): the cross-diagram list of what
// is outstanding for one reader — open actions assigned to them, open
// actions they assigned to others, and unresolved comment threads they
// are in.
//
// The api worker builds these from the collaboration index
// (`collab_actions` / `collab_threads`, a projection of the element
// JSON that stays the source of truth, spec/68 §1); the live app's
// Activity pane renders them. Present-tense by design: the Timeline
// (spec/138) records that an action WAS assigned, this says whether it
// is still open.

// Where a row lives, and how the reader reaches it. `via` is how the
// diagram is visible to them (their own, a joined team's library, or
// shared with them); `shareCode` is set only for 'shared', so the client
// can build the visitor URL (spec/33) the way Shared with You does.
export type ActivityPlace = {
  diagramId: string;
  diagramName: string;
  teamId: string | null;
  via: 'own' | 'team' | 'shared';
  shareCode: string | null;
  tabId: string;
  tabName: string;
  elementId: string;
  // The element's list name (its label, a table's first cell, or
  // "Untitled"), per `elementDisplayLabel` in @livediagram/diagram.
  elementLabel: string;
};

// An open action (spec/68) the reader assigned or was assigned. The two
// flags are resolved server-side against the reader's identity AND the
// identities it used to be (spec/142 §2.2), so a self-assignment made as
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
// in it, or it is on a diagram they own (owners already hear about every
// new comment by email, spec/64).
export type ActivityThread = ActivityPlace & {
  commentCount: number;
  latest: { text: string; authorName: string; authorColor: string; at: number };
  firstAt: number;
  youCommented: boolean;
  onYourDiagram: boolean;
};

export type ActivityReadResult = {
  actions: ActivityAction[];
  threads: ActivityThread[];
};

// Ceiling per kind on one read. The page is an inbox, not a history: a
// reader with more than this outstanding is not going to scroll to the
// hundredth, and the cap keeps the response bounded without paging.
export const ACTIVITY_LIST_MAX = 100;
