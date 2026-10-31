import { CommunityGalleryPage } from '@liveworkspace/community-site/gallery';

// The gallery (docs/specs/025-community/community.md "Gallery"): every app's gallery
// (@liveworkspace/community-site), in livedocuments's binding (lib/community-site.tsx). The hero and filter shell render
// statically; posts load client-side into a grid that reserves its space.
export default function GalleryPage() {
  return <CommunityGalleryPage />;
}
