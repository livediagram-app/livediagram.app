import { useEffect, useEffectEvent } from 'react';

// Somebody started following us (docs/specs/012-collaboration/follow-me-viewport.md "Starting and stopping"): show
// them where we are now. Viewports go out on change only, so a follower who arrived after our last pan or zoom had
// nothing to apply and read "Following Alice" over a view of their own until we next moved. Publishing once
// whenever the set of followers changes (and is not empty) costs one frame per follow, not a stream.
export function useShowFollowersMyView(
  followerIds: readonly string[],
  publishView: () => void,
): void {
  const key = followerIds.join(',');
  const publish = useEffectEvent(publishView);
  useEffect(() => {
    if (key !== '') publish();
  }, [key]);
}
