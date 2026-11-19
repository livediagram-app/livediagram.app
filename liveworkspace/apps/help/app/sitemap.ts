import { site } from '@/lib/help-site';

// The help centre's static sitemap (liveworkspace/docs/specs/017-help/help-centre.md "SEO"): the home, the features index, every
// category landing and every article, from the registry, each dated by its last commit.
export const dynamic = 'force-static';

export default function sitemap() {
  return site.sitemap();
}
