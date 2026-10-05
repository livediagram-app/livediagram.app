import Link from 'next/link';
import { Button, ButtonContent, EmptyState, buttonClassName } from '@livediagram/ui';
import { AlertIcon, BackIcon, PeopleIcon } from '../shared/icons';

// The post page's not-found, error and loading states (docs/specs/025-community/community.md "Post";
// blueprint §9 final copy).

export function PostNotFound() {
  return (
    <EmptyState
      icon={<PeopleIcon aria-hidden />}
      title="This document isn't in the Community any more."
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

export function PostError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert">
      <EmptyState
        icon={<AlertIcon aria-hidden />}
        title="We couldn't load this document."
        description="Check your connection, then try again."
      >
        <Button size="md" onClick={onRetry}>
          Try Again
        </Button>
      </EmptyState>
    </div>
  );
}

// The post layout's shape while it loads, so the page does not jump when it arrives.
export function PostSkeleton() {
  return (
    <div aria-hidden className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="dot-grid aspect-[4/3] w-full rounded-2xl border border-slate-200 sm:aspect-[16/10] dark:border-slate-800" />
      <div className="flex flex-col gap-4">
        <div className="skeleton-bar h-5 w-24 rounded" />
        <div className="skeleton-bar h-9 w-4/5 rounded" />
        <div className="skeleton-bar h-6 w-1/2 rounded" />
        <div className="skeleton-bar mt-2 h-24 w-full rounded" />
        <div className="skeleton-bar h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}
