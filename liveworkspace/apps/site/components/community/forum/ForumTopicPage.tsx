'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ForumShell } from './ForumShell';
import { ForumTopicView } from './ForumTopicView';
import type { ForumPagePart } from './ForumShell';

// A Forum topic's page (`/community/forum/topic?id=`): one static page for every topic, which reads its id from the
// address (liveworkspace/docs/specs/007-community/community.md "The Forum", "Its pages"), in the Forum's frame (the
// same hero, New Post and tabs as the list), the topic under it with its sidebar (ForumSidebar) beside it.
export function ForumTopicPage() {
  return (
    <ForumShell heroHeading="p">
      {(part) => (
        // useSearchParams needs a Suspense boundary in the static export.
        <Suspense fallback={null}>
          <ForumTopicFromAddress {...part} />
        </Suspense>
      )}
    </ForumShell>
  );
}

function ForumTopicFromAddress({ api, account }: ForumPagePart) {
  const id = useSearchParams().get('id');
  return <ForumTopicView api={api} account={account} id={id} />;
}
