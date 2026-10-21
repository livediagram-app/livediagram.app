import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BRAND_OG_IMAGE, BRAND_TWITTER_IMAGE } from '@liveplanner/ui';
import { PostView } from '@/components/post/PostView';
import { PostSkeleton } from '@/components/post/PostStates';

// One post (docs/specs/025-community/community.md "Post"): `/community/post/?id=<postId>`. The page is
// one static shell; the id is read on the client (useSearchParams, inside Suspense as the static
// export requires) and the post loads from the api.
// No canonical in the shell: one shell serves every post, so a fixed one would fold them all into one page for
// search engines (and leaving it out would inherit the gallery's). PostView sets the post's own once it loads.
// The Open Graph block is restated without a url for the same reason: the
// gallery's og:url would tell link previews every post IS the gallery.
const POST_DESCRIPTION =
  'A document shared to the liveplanner Community. Open it to explore every tab, then make your own copy to edit.';
export const metadata: Metadata = {
  title: 'Community Document',
  description: POST_DESCRIPTION,
  alternates: {},
  openGraph: {
    type: 'article',
    siteName: 'liveplanner Community',
    title: 'Community Document | liveplanner',
    description: POST_DESCRIPTION,
    locale: 'en_GB',
    images: [BRAND_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Community Document | liveplanner',
    description: POST_DESCRIPTION,
    images: [BRAND_TWITTER_IMAGE],
  },
};

export default function PostPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10 md:px-8">
      <Suspense fallback={<PostSkeleton />}>
        <PostView />
      </Suspense>
    </div>
  );
}
