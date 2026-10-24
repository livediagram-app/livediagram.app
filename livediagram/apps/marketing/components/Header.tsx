import type { CtaSurface } from '@livediagram/api-schema';
import { SiteHeader } from '@livediagram/ui';

// The marketing landing header is the shared SiteHeader (packages/ui), its logo
// switching between liveworkspace's sites (SiteSwitcher). `surface` is the page's landing-funnel surface (docs/specs/019-marketing/landing-funnel.md),
// which Choose Template carries into the editor. Every marketing page's bar is the same for everyone
// (`buildWithAi`, marketing-site.md "Header"): Build with AI (marked current on /ai itself), Choose Template and
// Explorer; signed in, the account menu ends it (`account`).
export function Header({ surface }: { surface: Exclude<CtaSurface, 'Help' | 'Dashboard'> }) {
  return (
    <SiteHeader ctaSurface={surface} buildWithAi={surface === 'Ai' ? 'current' : 'link'} account />
  );
}
