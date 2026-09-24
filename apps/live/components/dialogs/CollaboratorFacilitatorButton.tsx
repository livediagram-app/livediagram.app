'use client';

// The baton verb on one Collaborators row (spec/148).
//
// One button per row, never two, and its label always says what pressing it
// does. Its own file because the states are the interesting part and the
// dialog is long enough already.
//
// Who may move it, which is the whole permission model:
//   - a FREE baton: anybody with edit rights, on their own row or somebody
//     else's
//   - a HELD baton: the holder (passing it on, or stepping down) and the
//     owner (taking it back)
// Everybody else sees no verb at all, because there is nothing they can do
// with it — rather than a button that would be refused by the room.

import { Button } from '@livediagram/ui';
import { Tooltip } from '@/components/primitives/Tooltip';

export function FacilitatorButton({
  isSelf,
  name,
  canHold,
  theyHoldIt,
  batonFree,
  iHoldIt,
  isOwner,
  onPress,
}: {
  isSelf: boolean;
  name: string;
  /** Editors only: everything the baton governs writes to the document. */
  canHold: boolean;
  /** Does the person on THIS row hold it? */
  theyHoldIt: boolean;
  batonFree: boolean;
  /** Do we hold it? Our own row cannot be recognised by presence id. */
  iHoldIt: boolean;
  /** Are we the diagram's owner? The one who can always take it back. */
  isOwner: boolean;
  onPress: () => void;
}) {
  // Their row says "Facilitating" in its badges; a button would repeat it.
  if (!isSelf && theyHoldIt) return null;
  // Handing it out is the owner's, the holder's, or anybody's when it is free.
  const mayMove = isOwner || iHoldIt || batonFree;
  if (!isSelf && !mayMove) return null;
  // Our own row, while somebody else runs the session: only the owner has a
  // move here, and it is the one that makes "the diagram can always take back
  // control" true.
  if (isSelf && !iHoldIt && !batonFree && !isOwner) return null;

  const label = isSelf
    ? iHoldIt
      ? 'Step Down'
      : batonFree
        ? 'Take Facilitation'
        : 'Take Over'
    : 'Make Facilitator';

  const description = isSelf
    ? iHoldIt
      ? 'Hand the session tools back to everyone.'
      : batonFree
        ? 'Run the timer, votes and polls for this session.'
        : 'Take the session back from whoever is running it.'
    : `Let ${name} run the timer, votes and polls.`;

  // Disabled rather than hidden for a viewer, so the rule is learnable: a
  // button that vanishes teaches nothing about why.
  const blocked = !canHold;
  return (
    <Tooltip
      title={label}
      description={
        blocked ? 'Viewers cannot run a session: the tools write to the diagram.' : description
      }
    >
      <span>
        <Button
          variant="secondary"
          size="xs"
          disabled={blocked}
          aria-label={isSelf ? label : `Make ${name} the facilitator`}
          onClick={onPress}
        >
          {label}
        </Button>
      </span>
    </Tooltip>
  );
}
