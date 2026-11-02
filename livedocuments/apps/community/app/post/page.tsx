import type { Metadata } from 'next';
import { BRAND_OG_IMAGE, BRAND_TWITTER_IMAGE } from '@livedocuments/ui';
import { CommunityPostPage } from '@liveworkspace/community-site/post';

// One post (docs/specs/025-community/community.md "Post"): `/community/post/?id=<postId>`, every app's post page
// (@liveworkspace/community-site). The page is one static shell; the id is read on the client and the post loads
// from the service.
// No canonical in the shell: one shell serves every post, so a fixed one would fold them all into one page for
// search engines (and leaving it out would inherit the gallery's). PostView sets the post's own once it loads.
// The Open Graph block is restated without a url for the same reason: the
// gallery's og:url would tell link previews every post IS the gallery.
const POST_DESCRIPTION =
  'A document shared to the livedocuments Community. Open it to read every page, then make your own copy to edit.';
export const metadata: Metadata = {
  title: 'Community Document',
  description: POST_DESCRIPTION,
  alternates: {},
  openGraph: {
    type: 'article',
    siteName: 'livedocuments Community',
    title: 'Community Document | livedocuments',
    description: POST_DESCRIPTION,
    locale: 'en_GB',
    images: [BRAND_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Community Document | livedocuments',
    description: POST_DESCRIPTION,
    images: [BRAND_TWITTER_IMAGE],
  },
};

export default function PostPage() {
  return <CommunityPostPage />;
}
