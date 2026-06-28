import { SiteHeader } from '@livediagram/ui';

// The marketing landing header is the shared SiteHeader (packages/ui) with the
// apps-menu dropdown enabled next to the logo, where the landing page reads as
// "Welcome". The telemetry dashboard renders the same SiteHeader keyed to its
// own section.
export function Header() {
  return <SiteHeader productNav="home" />;
}
