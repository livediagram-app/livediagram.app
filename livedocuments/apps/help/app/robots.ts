import { site } from '@/lib/help-site';

// Help centre robots (docs/specs/018-help/help-app.md): fully crawlable, with a pointer to the sitemap. Static so
// it ships with the `output: 'export'` build.
export const dynamic = 'force-static';

export default function robots() {
  return site.robots();
}
