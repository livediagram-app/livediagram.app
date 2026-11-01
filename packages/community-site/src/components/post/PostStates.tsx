import Link from 'next/link';
import { COMMUNITY_DOT_GRID, COMMUNITY_SKELETON_BAR } from '@liveworkspace/community-ui';
import { ButtonContent, EmptyState, buttonClassName } from '@liveworkspace/ui';
import { useCommunitySite } from '../../client';
import { BackIcon, PeopleIcon } from '../shared/icons';

// The post page's not-found and loading states (livediagram/docs/specs/025-community/community.md "Post").

export function PostNotFound() {
  const { words } = useCommunitySite();
  return (
    <EmptyState
      icon={<PeopleIcon aria-hidden />}
      // All the page says: its heading, as the post's title is when it is there.
      heading="h1"
      title={`This ${words.noun} isn't in the Community any more.`}
      description="It may have been removed by its author. There's plenty more to explore."
    >
      <Link href="/" className={buttonClassName({ size: 'md' })}>
        <ButtonContent>
          <BackIcon aria-hidden />
          Back to Community
        </ButtonContent>
      </Link>
    </EmptyState>
  );
}

// The post layout's shape while it loads, so the page does not jump when it arrives.
export function PostSkeleton() {
  return (
    <div aria-hidden className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div
        className={`aspect-[4/3] w-full rounded-2xl border border-slate-200 sm:aspect-[16/10] dark:border-slate-800 ${COMMUNITY_DOT_GRID}`}
      />
      <div className="flex flex-col gap-4">
        <div className={`h-5 w-24 rounded ${COMMUNITY_SKELETON_BAR}`} />
        <div className={`h-9 w-4/5 rounded ${COMMUNITY_SKELETON_BAR}`} />
        <div className={`h-6 w-1/2 rounded ${COMMUNITY_SKELETON_BAR}`} />
        <div className={`mt-2 h-24 w-full rounded ${COMMUNITY_SKELETON_BAR}`} />
        <div className={`h-10 w-full rounded-lg ${COMMUNITY_SKELETON_BAR}`} />
      </div>
    </div>
  );
}
