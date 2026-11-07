'use client';

import { communityImagePath } from '@liveplanner/api-schema';
import { CommunityHelpLink } from '@liveplanner/ui';
import { CommunityShowcase as Showcase } from '@liveworkspace/community-ui/landing';
import { COMMUNITY_APP_WORDS } from '@liveworkspace/community-ui/words';

// The landing page's Community section (docs/specs/025-community/community.md "Featured on the home page";
// docs/specs/019-marketing/marketing-site.md): every app's section (@liveworkspace/community-ui/landing), bound to
// liveplanner's posts, words, card images (this app's api's: the plan is this app's) and help link. It shows
// nothing while the Community is off or has fewer than six to feature.

const API_BASE = '/api';
const imageUrl = (shareCode: string) => `${API_BASE}${communityImagePath(shareCode)}`;

export function CommunityShowcase() {
  return (
    <Showcase
      app="liveplanner.app"
      words={COMMUNITY_APP_WORDS['liveplanner.app']}
      imageUrl={imageUrl}
      communityApi={process.env.NEXT_PUBLIC_COMMUNITY_API}
      helpLink={<CommunityHelpLink article="finding">How the Community Works</CommunityHelpLink>}
    />
  );
}
