'use client';

import { useCallback, useId, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { forumTopicPath } from '@liveworkspace/community';
import { ResponsivePopover } from '@liveworkspace/ui';
import { useCommunitySite } from '../client';
import { CommunityTabs } from '../CommunityTabs';
import { SignedInAction } from './SignedInAction';
import { createForumApi, type ForumApi } from './forum-api';
import { ForumComposer, newForumDraft, type ForumDraft } from './ForumComposer';
import { ForumHero } from './ForumHero';
import { useForumAccount, type ForumAccount } from './useForumAccount';

// Every Forum page's frame (liveworkspace/docs/specs/007-community/community.md "The Forum", "Its pages"): the
// Community Forum hero with New Post, the tabs, then the page's own part (the list, or a topic). New Post opens the
// composer in a popover from the button pressed (a drawer on a phone), never in the page. The page's app (on its
// address) is the app a new post starts on; the draft stays while the page does, so closing the popover loses nothing.

export type ForumPagePart = {
  api: ForumApi;
  account: ForumAccount;
  /** New Post, opening from the button pressed. */
  startPost: (anchor: HTMLElement) => void;
};

export function ForumShell({
  heroHeading,
  children,
}: {
  /** The hero's heading: the page's h1 on the list, a plain line on a topic (whose title is its h1). */
  heroHeading: 'h1' | 'p';
  children: (part: ForumPagePart) => ReactNode;
}) {
  const { pageApp, communityApi, keyStorage, ready, telemetry } = useCommunitySite();
  const api = useMemo(
    () => createForumApi({ communityApi, keyStorage }),
    [communityApi, keyStorage],
  );
  const account = useForumAccount();
  const router = useRouter();
  const titleId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState<ForumDraft>(() => newForumDraft(pageApp));
  const startPost = useCallback((from: HTMLElement) => {
    setAnchor(from);
    setComposing(true);
  }, []);
  return (
    // The same width as the Gallery tab, so the heading and the tabs stay put between them.
    <div className="community-hero">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 md:px-8">
        <ForumHero
          heading={heroHeading}
          action={
            ready ? (
              <SignedInAction
                account={account}
                label="New Post"
                signInLabel="Sign In to Post"
                onClick={(e) => startPost(e.currentTarget)}
              />
            ) : null
          }
        />
        <div className="flex flex-col gap-6">
          <CommunityTabs current="forum" />
          {ready ? children({ api, account, startPost }) : null}
        </div>
      </div>
      {account.status === 'in' ? (
        <ResponsivePopover
          open={composing}
          onClose={() => setComposing(false)}
          anchor={anchor}
          titleId={titleId}
          width={560}
        >
          <ForumComposer
            api={api}
            account={account}
            draft={draft}
            onDraft={setDraft}
            titleId={titleId}
            onPosted={(topic) => {
              telemetry.forum.postedTopic();
              setDraft(newForumDraft(pageApp));
              setComposing(false);
              router.push(forumTopicPath(topic.id));
            }}
            onCancel={() => setComposing(false)}
          />
        </ResponsivePopover>
      ) : null}
    </div>
  );
}
