import type { ComponentProps } from 'react';
import { ElementVoteOverlay as SharedElementVoteOverlay } from '@liveworkspace/workbench/components/canvas/ElementVoteOverlay';

// livediagram's door to the shared dot-vote overlay (@liveworkspace/workbench): its vote keys, `+` and `-` on the
// selected element (docs/specs/012-collaboration/session-tools.md "Casting from the keyboard"), announced on the
// stepper's buttons and the badge. The rest, `hasText` included, its canvas passes as props.
const VOTE_KEYS = { add: '+', remove: '-' } as const;

export function ElementVoteOverlay(
  props: Omit<ComponentProps<typeof SharedElementVoteOverlay>, 'keyShortcuts'>,
) {
  return <SharedElementVoteOverlay {...props} keyShortcuts={VOTE_KEYS} />;
}
