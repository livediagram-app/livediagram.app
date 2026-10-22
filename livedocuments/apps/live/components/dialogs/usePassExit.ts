import { useState } from 'react';

// A pass's way out (docs/specs/007-editor/live-app.md "Share dialog"): `leave()`
// starts the ticket's close, and only once it has finished (`onLeft`, the
// exit hold) is `remove` called, so the list glides shut instead of the row
// vanishing. If the removal fails the row is still here, so it opens back up
// (`returning`, drawn with the arrival) rather than staying collapsed.
export function usePassExit(remove: () => Promise<void> | void) {
  const [phase, setPhase] = useState<'idle' | 'leaving' | 'returning'>('idle');
  return {
    leave: () => setPhase('leaving'),
    ticket: {
      leaving: phase === 'leaving',
      returning: phase === 'returning',
      onLeft: async () => {
        await remove();
        // Still mounted: the removal did not land (the handler has toasted).
        setPhase('returning');
      },
    },
  };
}
