import { SITE_FOOTER_LINK, SiteFooter as SharedFooter } from '@liveworkspace/ui';
import { CommunityFooterLink } from '@liveworkspace/community-ui/links';
import { BRAND_APP } from './brand-app';
import { REPO_URL } from './site';

// The public site footer (the marketing pages, the help centre, the telemetry dashboard): @liveworkspace/ui's
// SiteFooter with this product's logo, tagline and first link, carrying its Community link, the GitHub link,
// and no Build with AI link (livehuddle has no MCP server, docs/specs/002-project-scope/not-in-livehuddle.md).
export function SiteFooter() {
  return (
    <SharedFooter
      app={BRAND_APP}
      tagline="Free Spaces to meet in, for teams who like being together."
      newLabel="New Space"
      community={<CommunityFooterLink className={SITE_FOOTER_LINK} />}
      repoUrl={REPO_URL}
      buildWithAi={false}
    />
  );
}
