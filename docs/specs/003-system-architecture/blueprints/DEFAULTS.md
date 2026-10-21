# System architecture blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint               | Spec silence                                           | Default applied                                                                   |
| --- | ----------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| D1  | react-state-and-effects | How a render reads the viewport size or a media query  | The existing stores: `useViewportHeight`, `useViewportWidth`, `useMediaQuery`     |
| D2  | react-state-and-effects | Where a client-only dialog's `use(browser())` suspends | Nowhere in practice: it mounts only in the browser; the page's boundary covers it |
| D3  | react-state-and-effects | What the footer shows as its year                      | The build's year, a constant written at build time (`BUILD_YEAR`)                 |
| D4  | react-state-and-effects | Which reduced-motion check gates a View Transition     | `prefersReducedMotion()` (`apps/live/lib/motion-preference.ts`): both sources     |
