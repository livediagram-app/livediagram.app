'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCommunitySite } from '../client';
import { createForumApi } from './forum-api';
import { ForumTopicView } from './ForumTopicView';
import { useForumAccount } from './useForumAccount';

// A Forum topic's page (`/community/forum/topic?id=`): one static page for every topic, which reads its id from the
// address (liveworkspace/docs/specs/007-community/community.md "The Forum", "Its pages").
export function ForumTopicPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-16 pt-10 sm:px-6 sm:pt-12 md:px-8">
      {/* useSearchParams needs a Suspense boundary in the static export. */}
      <Suspense fallback={null}>
        <ForumTopicFromAddress />
      </Suspense>
    </div>
  );
}

function ForumTopicFromAddress() {
  const { communityApi, keyStorage, ready } = useCommunitySite();
  const api = useMemo(
    () => createForumApi({ communityApi, keyStorage }),
    [communityApi, keyStorage],
  );
  const account = useForumAccount();
  const id = useSearchParams().get('id');
  return ready ? <ForumTopicView api={api} account={account} id={id} /> : null;
}
