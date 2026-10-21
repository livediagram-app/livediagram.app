import { NON_MARKETING_SEGMENTS } from '@livediagram/api-schema';

// Only the marketing pages opt in to cross-document view transitions (docs/specs/019-marketing/marketing-site.md).
// Leaving for another app (the editor, the help centre, the dashboard), the browser would still start one,
// find the new page declined, and report "Transition was aborted because of invalid state" as an uncaught
// error. This inline script skips the transition as the page swaps to any of them. Plain ES5 in a string,
// inlined in the <head> beside the opt-in so it is listening before any link is followed.
export const VIEW_TRANSITION_GUARD_SCRIPT = `addEventListener('pageswap', function (e) {
  var transition = e.viewTransition;
  var entry = e.activation && e.activation.entry;
  if (!transition || !entry) return;
  var url = new URL(entry.url, location.origin);
  if (url.origin === location.origin && ${JSON.stringify(NON_MARKETING_SEGMENTS)}.indexOf(url.pathname.split('/')[1] || '') < 0) return;
  transition.skipTransition();
  console.debug('[motion] view transition skipped: leaving marketing for ' + url.pathname);
});`;
