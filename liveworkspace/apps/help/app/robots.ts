import { site } from '@/lib/help-site';

// Help centre robots (liveworkspace/docs/specs/017-help/help-centre.md): fully crawlable, with a pointer to the sitemap. Static so
// it ships with the `output: 'export'` build.
export const dynamic = 'force-static';

export default function robots() {
  return site.robots();
}
