import type { ReactNode } from 'react';
import { CommunityBinding } from '@/components/community/CommunityBinding';
import { CommunityFrame } from '@/components/community/CommunityFrame';
import { CommunityGate } from '@/components/community/CommunityGate';
import './community.css';

// The Community (liveworkspace/docs/specs/010-site/site.md "The Community"; liveworkspace/docs/specs/007-community/
// community.md "One page for every app"): one page for every app's posts, built once here and served two ways, on
// liveworkspace.app itself (every app's posts) and under each app's address through its router (`livediagram.app/
// community`, that app's posts first). The layout keeps the binding, the header and the footer mounted across the
// gallery and a post. No Suspense here: the post page keeps its own around useSearchParams (CommunityPostPage.tsx), and
// one round the gallery would hydrate after the binding learns the page's app, throwing its server HTML away.
export default function CommunityLayout({ children }: { children: ReactNode }) {
  return (
    <CommunityBinding>
      <CommunityFrame>
        <CommunityGate>{children}</CommunityGate>
      </CommunityFrame>
    </CommunityBinding>
  );
}
