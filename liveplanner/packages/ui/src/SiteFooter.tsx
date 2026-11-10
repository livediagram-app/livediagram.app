import { CommunityFooterLink } from '@liveworkspace/community-ui/links';
import { SITE_FOOTER_LINK, SiteFooter as SharedFooter } from '@liveworkspace/ui';
import { BRAND_APP } from './brand-app';
import { REPO_URL } from './site';

// The public site footer (the marketing pages, the help centre, the telemetry dashboard): @liveworkspace/ui's
// SiteFooter with this product's logo, tagline and first link, carrying its Community link (gone while the Community
// is off), and the source repository's link, as every app's.
export function SiteFooter() {
  return (
    <SharedFooter
      app={BRAND_APP}
      tagline="Free planning for teams who work together, live."
      newLabel="New Plan"
      repoUrl={REPO_URL}
      community={<CommunityFooterLink className={SITE_FOOTER_LINK} />}
    />
  );
}
