'use client';

// One client boundary for the whole page (the hero reads the app's binding too), so the page loads one client entry.
import { CommunityHero } from './gallery/CommunityHero';
import { GalleryView } from './gallery/GalleryView';

// The gallery (`/community`; liveworkspace/docs/specs/007-community/community.md "The gallery"), the same on every
// app's address and on liveworkspace.app: app/community/page.tsx renders it inside the Community layout's binding. The
// hero and filter shell render statically; posts load client-side into a grid that reserves its space.
export function CommunityGalleryPage() {
  return (
    <div className="community-hero">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 pt-12 sm:px-6 sm:pt-16 md:px-8">
        <CommunityHero />
        <GalleryView />
      </div>
    </div>
  );
}
