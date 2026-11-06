import type { CtaSurface } from '@livehuddle/api-schema';
import { SiteHeader } from '@livehuddle/ui';

// The marketing landing header is the shared SiteHeader (packages/ui), its logo
// switching between liveworkspace's sites (SiteSwitcher). `surface` is the page's landing-funnel surface (docs/specs/019-marketing/landing-funnel.md),
// which Choose Template carries into the editor. Every marketing page's bar is the same for everyone
// (`marketing`, marketing-site.md "Header"): Choose Template and Explorer, with no Build with AI (livehuddle has
// no MCP server, docs/specs/002-project-scope/not-in-livehuddle.md); signed in, the account menu ends it (`account`).
export function Header({ surface }: { surface: Exclude<CtaSurface, 'Help' | 'Dashboard'> }) {
  return <SiteHeader ctaSurface={surface} marketing account />;
}
