// Dot voting from the keyboard (docs/specs/012-collaboration/session-tools.md "Casting from the keyboard",
// docs/specs/012-collaboration/blueprints/vote-keys.md). The stepper's buttons sit inside the canvas, where Tab
// walks elements, so a keyboard user reaches a votable element by the walk and votes on it with `+` / `-`. The
// rules are the pointer's: the same handlers, the same `canCastVote`, the same role gate.

import {
  canCastVote,
  isVotableInVote,
  votesSpentBy,
  type Element,
  type Layer,
  type TabVote,
} from '@livediagram/document';
import { describeOne } from '@/lib/element-names';

// `+` and `=` are one key, shifted or not; the numpad's give the same `key`.
export const VOTE_ADD_KEYS: readonly string[] = ['+', '='];
export const VOTE_REMOVE_KEYS: readonly string[] = ['-'];

// A dot on (1), a dot off (-1), or not a vote key. A chord is never one: Cmd/Ctrl + and - zoom.
export function voteKeyDelta(
  e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>,
): 1 | -1 | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  if (VOTE_ADD_KEYS.includes(e.key)) return 1;
  if (VOTE_REMOVE_KEYS.includes(e.key)) return -1;
  return null;
}

// "2 of 3 dots left": the Vote panel's words and the keyboard's.
export function dotsLeftText(remaining: number, budget: number): string {
  return `${remaining} of ${budget} ${budget === 1 ? 'dot' : 'dots'} left`;
}

export const VOTE_KEY_LOCKED = 'This tab is locked, so no dot moved.';

export type VoteByKeyArgs = {
  elementId: string;
  delta: 1 | -1;
  elements: readonly Element[];
  vote: TabVote | null | undefined;
  layers: Layer[] | undefined;
  // Who the vote knows us by (the collab key).
  selfId: string;
  // An Editor or a Participant (the session's `can.takePart`); a Viewer never votes.
  canTakePart: boolean;
  // The shared handlers; each says whether a dot moved.
  cast: (elementId: string) => boolean;
  retract: (elementId: string) => boolean;
};

// Apply one vote key to the selected element. Returns the words to announce, or null when the key is not the
// vote's (no vote open, a Viewer, a non-votable element), so the caller lets it fall through to type-to-edit.
export function voteByKey(args: VoteByKeyArgs): string | null {
  const { elementId, delta, vote, selfId } = args;
  if (!args.canTakePart || !vote?.active) return null;
  const el = args.elements.find((x) => x.id === elementId);
  if (!el || !isVotableInVote(el, vote, args.layers)) return null;
  const name = describeOne(el);
  const budget = vote.votesPerPerson;
  const spent = votesSpentBy(vote, selfId);
  if (delta === 1) {
    if (!canCastVote(vote, selfId, elementId)) {
      return spent >= budget ? 'No dots left.' : `One dot each: ${name} already has yours.`;
    }
    if (!args.cast(elementId)) return VOTE_KEY_LOCKED;
    return `Dot added to ${name}. ${dotsLeftText(Math.max(0, budget - spent - 1), budget)}.`;
  }
  if (!(vote.votes[elementId] ?? []).includes(selfId)) return `No dot of yours on ${name}.`;
  if (!args.retract(elementId)) return VOTE_KEY_LOCKED;
  return `Dot removed from ${name}. ${dotsLeftText(Math.min(budget, budget - spent + 1), budget)}.`;
}

// The editor's `onVoteKey`: `voteByKey` with the words spoken. None for a session that cannot cast, so a Viewer's
// keys never reach the vote.
export function voteKeyHandler(
  ctx: Omit<VoteByKeyArgs, 'elementId' | 'delta'>,
  speak: (message: string) => void,
): ((elementId: string, delta: 1 | -1) => boolean) | undefined {
  if (!ctx.canTakePart) return undefined;
  return (elementId, delta) => {
    const said = voteByKey({ ...ctx, elementId, delta });
    if (said === null) return false;
    speak(said);
    return true;
  };
}
