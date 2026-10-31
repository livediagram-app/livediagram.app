import { lucidePenTool } from '@liveworkspace/icons/lucide';
import { CommunityFooterLink } from '@liveworkspace/community-ui/links';
import { lucideGlyph, SITE_FOOTER_LINK, SiteFooter as SharedFooter } from '@liveworkspace/ui';
import { BRAND_APP } from './brand-app';
import { REPO_URL } from './site';

const NewIcon = /* @__PURE__ */ lucideGlyph(lucidePenTool, 16);

// The public site footer (the marketing pages, the help centre, the telemetry dashboard): @liveworkspace/ui's
// SiteFooter with this product's logo, tagline and first link, carrying its Community link (gone while the Community is off), the GitHub link and the contributors' credits.
export function SiteFooter() {
  return (
    <SharedFooter
      app={BRAND_APP}
      tagline="Free articles, slide decks and infographics for teams who make them together."
      newLabel="New Document"
      newIcon={NewIcon}
      community={<CommunityFooterLink className={SITE_FOOTER_LINK} />}
      repoUrl={REPO_URL}
    />
  );
}
