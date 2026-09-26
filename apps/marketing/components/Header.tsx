import type { CtaSurface } from '@livediagram/api-schema';
import { SiteHeader } from '@livediagram/ui';

// The marketing landing header is the shared SiteHeader (packages/ui) with the
// apps-menu dropdown enabled next to the logo, where the landing page reads as
// "Welcome". The telemetry dashboard renders the same SiteHeader keyed to its
// own section. `surface` is the page's landing-funnel surface (docs/specs/019-marketing/landing-funnel.md),
// which the header's CTA pair carries into the editor.
export function Header({ surface }: { surface: Exclude<CtaSurface, 'Help' | 'Dashboard'> }) {
  return <SiteHeader productNav="home" ctaSurface={surface} />;
}
