// Per-element assigned actions (spec/68): a named, described piece of work
// assigned to a teammate, attached to a boxed element the way a comment
// thread is. At most one action per element. Split into its own module like
// comments.ts; re-exported from ./index so the public surface is unchanged.

// The assignee/assigner identity is denormalised for rendering only (who to
// show), never for permissions: anyone with edit access can complete, edit,
// or delete an action. No email address is ever stored here — diagrams
// travel (share links, embeds, exports); the notify endpoint resolves the
// address server-side from team membership at send time.
export type ElementActionAssignee = {
  // The stable key: a Clerk user id, or — for a SELF-assignment made
  // while signed out — the guest participant id (spec/04). Guests can
  // only pick themselves, so a guest id always means the assigner's own
  // browser identity. Null for an INVITED member the lazy claim hasn't
  // identified with an account yet — `memberId` is their key then.
  userId: string | null;
  // The team membership row id, set when the assignee was picked from a
  // team (joined or invited). For an invited member it is the only
  // stable key: the notify endpoint resolves their invite email from
  // the membership row at send time, so no address enters the blob.
  memberId?: string;
  // Display name at assign time (render fallback: "Teammate").
  name: string | null;
};

export type ElementAction = {
  id: string;
  // Required, short ("Confirm the retry budget").
  name: string;
  // Optional detail; '' when empty.
  description: string;
  assignee: ElementActionAssignee;
  // The team the assignee was picked from; null for a self-assignment
  // (Myself is not a team row).
  teamId: string | null;
  // Who assigned it (Clerk user id, or a guest participant id for a
  // signed-out self-assignment).
  assignerId: string;
  assignerName: string | null;
  status: 'open' | 'done';
  createdAt: number; // unix ms
  updatedAt: number; // unix ms
};

export function createElementAction(input: {
  name: string;
  description: string;
  assignee: ElementActionAssignee;
  teamId: string | null;
  assigner: { id: string; name: string | null };
}): ElementAction {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: input.name,
    description: input.description,
    assignee: input.assignee,
    teamId: input.teamId,
    assignerId: input.assigner.id,
    assignerName: input.assigner.name,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
}

// Whether the action should surface (badge, Actions Panel). Done actions
// stay on the element (reopenable) but stop shouting.
export function isOpenAction(action: ElementAction | undefined): action is ElementAction {
  return !!action && action.status === 'open';
}
