// The sign-in banner's events no app sends any more, shared by every app's retired-events.ts (each product's
// docs/specs/014-identity/sign-in-encouragement.md, docs/specs/017-telemetry/telemetry.md "Retired features"). In
// November 2026 the editors' banner became a standing toast with Sign In alone, and the Explorer's banner went:
// - Learn More and its reasons, on either surface (`UI·Opened·SignInReasonsEditor` / `SignInReasonsExplorer`, and the
//   older `SignInReasons` sent before the surface was named);
// - the Explorer's banner, its Sign In and its close (`UI·Selected|Closed·SignInBannerExplorer`).
// The editor's Sign In and close carry on under `SignInBannerEditor`, now sent by the toast.

const RETIRED_SIGN_IN_BANNER_EVENTS: ReadonlySet<string> = new Set([
  'UI|Opened|SignInReasons',
  'UI|Opened|SignInReasonsEditor',
  'UI|Opened|SignInReasonsExplorer',
  'UI|Selected|SignInBannerExplorer',
  'UI|Closed|SignInBannerExplorer',
]);

/** Whether an event is one of the retired sign-in banner's: Learn More, or the Explorer's banner. */
export function isRetiredSignInBannerEvent(
  category: string,
  action: string,
  type: string | null,
): boolean {
  return RETIRED_SIGN_IN_BANNER_EVENTS.has(`${category}|${action}|${type ?? ''}`);
}
