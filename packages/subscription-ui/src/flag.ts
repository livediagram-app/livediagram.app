// The one place a page reads whether Pro is on in its build (liveworkspace/docs/specs/019-subscription/
// subscription.md "The flag"). Everything in this package, the Settings panel's Subscription category, the account
// menu's badge and liveworkspace.app's pricing, checkout and billing pages ask `proOn()`, so a build with the flag
// off draws no Pro UI and makes no subscription request.
import { proEnabled } from '@liveworkspace/subscription';

// Next inlines `process.env.NEXT_PUBLIC_*` only where it is written out literally, so it is written out here and
// nowhere else. The guard is for a bundle with no `process` at all.
declare const process: { env: { NEXT_PUBLIC_PRO_ENABLED?: string } };

const BUILD = proEnabled(
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_PRO_ENABLED : undefined,
);

// A test's own answer, over the build's (testing.ts).
let forced: boolean | null = null;

/** Whether Pro is on in this build. */
export function proOn(): boolean {
  return forced ?? BUILD;
}

/** For tests only (`@liveworkspace/subscription-ui/testing`): turn Pro on or off, or `null` for the build's own. */
export function forcePro(value: boolean | null): void {
  forced = value;
}
