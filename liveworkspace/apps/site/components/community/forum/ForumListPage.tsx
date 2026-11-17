'use client';

import { useEffect } from 'react';
import { useCommunitySite } from '../client';
import { ForumListView } from './ForumListView';
import { ForumShell } from './ForumShell';

// The Forum's tab (`/community/forum`; liveworkspace/docs/specs/007-community/community.md "The Forum"): the Forum's
// frame (hero, New Post, tabs) around the list.
export function ForumListPage() {
  const { telemetry } = useCommunitySite();
  useEffect(() => {
    telemetry.forum.opened();
  }, [telemetry]);
  return (
    <ForumShell heroHeading="h1">
      {({ api, account, startPost }) => (
        <ForumListView api={api} account={account} onNewPost={startPost} />
      )}
    </ForumShell>
  );
}
