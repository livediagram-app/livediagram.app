import type { CtaSurface } from '@livediagram/api-schema';
import { SiteHeader } from '@livediagram/ui';

// The marketing landing header is the shared SiteHeader (packages/ui), its logo
// switching between liveworkspace's sites (SiteSwitcher). `surface` is the page's landing-funnel surface (docs/specs/019-marketing/landing-funnel.md),
// which the header's CTA pair carries into the editor. Every marketing page shows the Build with AI link
// (docs/specs/019-marketing/build-with-ai.md), marked current on /ai itself. Signed in, the bar ends with the
// account menu (`account`, marketing-site.md "Header").
export function Header({ surface }: { surface: Exclude<CtaSurface, 'Help' | 'Dashboard'> }) {
  return (
    <SiteHeader ctaSurface={surface} buildWithAi={surface === 'Ai' ? 'current' : 'link'} account />
  );
}
