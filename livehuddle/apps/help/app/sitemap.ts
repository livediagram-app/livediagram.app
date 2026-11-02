import { site } from '@/lib/help-site';

// The help centre's static sitemap (docs/specs/018-help/help-app.md "SEO"): the home, the features index, every
// category landing and every article, from the registry, each dated by its last commit.
export const dynamic = 'force-static';

export default function sitemap() {
  return site.sitemap();
}
