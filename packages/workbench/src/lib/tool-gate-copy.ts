// What a tool says before it works (footer-tools-menu.md "Always there"), the same plain words in every app and for
// every tool (owner, 2026-11-17): signed out, "Sign In Needed"; on an item kept only in this browser, "Sync <Item>".

/** The gate's heading and its one line, for `tool` (its name, "Email to Board") on an item called `noun` ("Plan"). */
export function toolGateCopy(
  kind: 'sign_in' | 'sync',
  tool: string,
  noun: string,
): { title: string; body: string } {
  if (kind === 'sign_in') {
    return {
      title: 'Sign In Needed',
      body: `You need to sign in to a liveworkspace account to use ${tool}.`,
    };
  }
  return {
    title: `Sync ${noun}`,
    body: `You need to sync this ${noun.toLowerCase()} to our servers to use ${tool}, as it runs on our servers.`,
  };
}
