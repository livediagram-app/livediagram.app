// The Action panel's small parts (docs/specs/012-collaboration/action-panel.md "The card"): its glyph, the
// green that means done, and the plus the Add Action bar wears.

import { Glyph } from '@livediagram/ui';

// Completion's colour: the Done check's green, so "finished" means one thing
// across the Collaborate cards.
export const ACTION_DONE = '#16a34a';

// A clipboard with a tick: work handed to somebody.
export const ActionGlyph = ({ size = 12 }: { size?: number }) => (
  <Glyph size={size} units={16}>
    <path d="M5.5 2.8h5M5.5 2.8a1 1 0 0 0-1 1v.2h7v-.2a1 1 0 0 0-1-1M4.5 3.4H3.6a1 1 0 0 0-1 1v8.6a1 1 0 0 0 1 1h8.8a1 1 0 0 0 1-1V4.4a1 1 0 0 0-1-1h-.9" />
    <path d="m5.6 9.2 1.7 1.7 3.2-3.6" />
  </Glyph>
);

export const PlusGlyph = ({ size = 12 }: { size?: number }) => (
  <Glyph size={size} units={16}>
    <path d="M8 3.5v9M3.5 8h9" />
  </Glyph>
);
