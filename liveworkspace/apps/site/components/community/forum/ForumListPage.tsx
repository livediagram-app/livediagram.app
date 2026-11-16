'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { forumCategoryOfApp, forumTopicPath } from '@liveworkspace/community';
import { useCommunitySite } from '../client';
import { CommunityTabs } from '../CommunityTabs';
import { SignedInAction } from './AskButton';
import { createForumApi } from './forum-api';
import { ForumComposer } from './ForumComposer';
import { ForumHero } from './ForumHero';
import { ForumListView } from './ForumListView';
import { useForumAccount } from './useForumAccount';

// The Forum's tab (`/community/forum`; liveworkspace/docs/specs/007-community/community.md "The Forum"): the
// Community's heading with Ask a Question, the tabs, the composer in place when asked for, and the list. The page's
// app (on its address) is the category a new question starts in.
export function ForumListPage() {
  const { pageApp, communityApi, keyStorage, ready, telemetry } = useCommunitySite();
  const api = useMemo(
    () => createForumApi({ communityApi, keyStorage }),
    [communityApi, keyStorage],
  );
  const account = useForumAccount();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    telemetry.forum.opened();
  }, [telemetry]);
  const ask = () => {
    setAsking(true);
    // From the empty list, the composer is above it: bring it into view.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <div className="community-hero">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 pt-12 sm:px-6 sm:pt-16 md:px-8">
        <ForumHero
          action={
            ready && !asking ? (
              <SignedInAction
                account={account}
                label="Ask a Question"
                signInLabel="Sign In to Ask"
                onClick={ask}
              />
            ) : null
          }
        />
        <div className="flex flex-col gap-6">
          <CommunityTabs current="forum" />
          {asking && account.status === 'in' ? (
            <ForumComposer
              api={api}
              account={account}
              startCategory={forumCategoryOfApp(pageApp)}
              onPosted={(topic) => {
                telemetry.forum.postedTopic();
                router.push(forumTopicPath(topic.id));
              }}
              onCancel={() => setAsking(false)}
            />
          ) : null}
          {ready ? <ForumListView api={api} account={account} onAsk={ask} /> : null}
        </div>
      </div>
    </div>
  );
}
