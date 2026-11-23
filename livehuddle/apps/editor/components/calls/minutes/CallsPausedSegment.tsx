'use client';

// The Call dock's first button while the Space's owner's call minutes are used (docs/specs/012-collaboration/
// call-minutes.md "Used"): Calls Paused, calm, never an error, its hover card saying until when. A press opens the
// dialog that says why and, for someone who may, how to carry on. It also asks to join once more, quietly: the api
// refuses again while the month is used, and admits the call the moment it is not (a new month, or the owner's tier
// allows more), which closes the dialog by itself.
import { useState } from 'react';
import { lucidePause } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livehuddle/ui';
import { setCallMinutesNotice } from '@/lib/calls/call-minutes-store';
import { callsPausedHover } from '@/lib/calls/call-minutes-words';
import { Segment } from '../CallSegment';

const PauseIcon = lucideGlyph(lucidePause, 16);

export function CallsPausedSegment({ onRetry }: { onRetry: () => void }) {
  // The clock as the button first drew: the day the month starts again.
  const [now] = useState(() => Date.now());
  return (
    <Segment
      label="Calls Paused"
      name="Calls Paused"
      title="Calls Paused"
      description={callsPausedHover(now)}
      icon={<PauseIcon />}
      onClick={() => {
        setCallMinutesNotice(true);
        onRetry();
      }}
    />
  );
}
