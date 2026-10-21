import { CommunityHero } from '@/components/gallery/CommunityHero';
import { GalleryView } from '@/components/gallery/GalleryView';

// The gallery (docs/specs/025-community/community.md "Gallery"). The hero and filter shell render
// statically; posts load client-side into a grid that reserves its space (blueprint §11).
export default function GalleryPage() {
  return (
    <div className="community-hero">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 pt-12 sm:px-6 sm:pt-16 md:px-8">
        <CommunityHero />
        <GalleryView />
      </div>
    </div>
  );
}
