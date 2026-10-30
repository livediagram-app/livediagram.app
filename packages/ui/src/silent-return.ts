// Whether this page load is the way back from a marketing page's deferred silent sign-in (liveworkspace/docs/specs/
// 003-accounts/accounts.md "Signing in without a click"). That bounce goes after the page has painted, so the visitor
// already saw (and the trackers already counted) the load it left; the one it lands back on is the same page again,
// marked by the boot script with this attribute on <html> (SILENT_RETURN_ATTRIBUTE in @liveworkspace/auth-client/silent,
// which a test pins to this name). The page view and Web Vitals trackers skip it.
export const SILENT_RETURN_ATTRIBUTE = 'data-silent-return';

export function isSilentReturn(): boolean {
  try {
    return document.documentElement.hasAttribute(SILENT_RETURN_ATTRIBUTE);
  } catch {
    return false;
  }
}
