import { SiteHeader } from '@livehuddle/ui';

// The marketing landing header is the shared SiteHeader (packages/ui), its logo switching between
// liveworkspace's sites (SiteSwitcher). Every marketing page's bar is the same for everyone (`marketing`,
// marketing-site.md "Header"): Explorer alone, with no Build with AI (livehuddle has no MCP server,
// docs/specs/002-project-scope/not-in-livehuddle.md) and no link into the editor (the hero and the page bodies
// carry those); signed in, the account menu ends it (`account`).
export function Header() {
  return <SiteHeader marketing account />;
}
