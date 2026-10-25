import { lucideSquareKanban } from '@liveworkspace/icons/lucide';
import { lucideGlyph, SiteFooter as SharedFooter } from '@liveworkspace/ui';
import { BRAND_APP } from './brand-app';

const NewIcon = /* @__PURE__ */ lucideGlyph(lucideSquareKanban, 16);

// The public site footer (the marketing pages, the help centre, the telemetry dashboard): @liveworkspace/ui's
// SiteFooter with this product's logo, tagline and first link, with no GitHub link and no credits.
export function SiteFooter() {
  return (
    <SharedFooter
      app={BRAND_APP}
      tagline="Free planning for teams who work together, live."
      newLabel="New Plan"
      newIcon={NewIcon}
      credits={false}
    />
  );
}
