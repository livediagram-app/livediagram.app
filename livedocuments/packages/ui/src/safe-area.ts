import type { CSSProperties } from 'react';

// The device's safe-area insets (the notch, the rounded corners, the home indicator), so edge chrome
// clears them (docs/specs/007-editor/live-app.md "Mobile / responsive"). They are 0 wherever the
// browser draws the page inside the safe area already (no `viewport-fit=cover`), so every rule here
// is a no-op today and keeps the chrome clear once the editor goes edge to edge. Inline styles, not
// Tailwind arbitrary values: an `env()` in a class name was once generated as a broken rule
// (PollPromptSheet).
type Side = 'top' | 'right' | 'bottom' | 'left';

export const safeInset = (side: Side): string => `env(safe-area-inset-${side}, 0px)`;

// At least `base` from the edge, more where the inset is bigger.
export const atLeastInset = (base: string, side: Side): string =>
  `max(${base}, ${safeInset(side)})`;

// Side padding that clears a landscape notch: `base` on each side, or the inset if it is bigger.
export const safeInlinePadding = (base: string): CSSProperties => ({
  paddingLeft: atLeastInset(base, 'left'),
  paddingRight: atLeastInset(base, 'right'),
});
