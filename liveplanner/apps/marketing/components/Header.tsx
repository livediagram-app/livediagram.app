import type { CtaSurface } from '@liveplanner/api-schema';
import { SiteHeader } from '@liveplanner/ui';

// The marketing landing header is the shared SiteHeader (packages/ui), its logo
// switching between liveworkspace's sites (SiteSwitcher). `surface` is the page's landing-funnel surface
// (docs/specs/019-marketing/landing-funnel.md); the bar itself links nothing into the editor, so it only marks
// /ai. Every marketing page's bar is the same for everyone (`buildWithAi`, marketing-site.md "Header"): Build
// with AI (marked current on /ai itself) and Explorer; signed in, the account menu ends it (`account`).
export function Header({ surface }: { surface: Exclude<CtaSurface, 'Help' | 'Dashboard'> }) {
  return (
    <SiteHeader buildWithAi={surface === 'Ai' ? 'current' : 'link'} account />
  );
}
