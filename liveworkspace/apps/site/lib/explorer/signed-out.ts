// Where signing out from the Explorer goes: the signed-out home page, `/` (liveworkspace.app's, or on an app's own
// address that app's landing page), never the Explorer again, whose next ask for a token would start a guest
// (liveworkspace/docs/specs/003-accounts/accounts.md "From the Explorer", Work Tracker 1443).
export const SIGNED_OUT_HREF = '/';
