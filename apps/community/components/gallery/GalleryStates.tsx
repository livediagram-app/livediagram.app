import { Button, ButtonContent, EmptyState, SearchIcon, buttonClassName } from '@livediagram/ui';
import { SHARE_YOUR_OWN_HREF } from '@/lib/links';
import { signInHref } from '@/lib/session';
import { AlertIcon, MineIcon, PeopleIcon } from '../shared/icons';

// The gallery's empty and error states (docs/specs/025-community/community.md "Gallery"; blueprint
// §9 final copy), one per cause.

// Nothing has been published yet.
export function GalleryEmpty() {
  return (
    <EmptyState
      icon={<PeopleIcon aria-hidden />}
      title="Nothing here yet."
      description="Be the first to share a document."
    >
      <a href={SHARE_YOUR_OWN_HREF} className={buttonClassName({ size: 'md' })}>
        <ButtonContent>Share Your Own</ButtonContent>
      </a>
    </EmptyState>
  );
}

// Posts exist, but none match the search, category or tag.
export function GalleryNoMatches({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      icon={<SearchIcon aria-hidden />}
      title="No documents match these filters."
      description="Try a different search, or browse everything."
    >
      <Button variant="secondary" size="md" onClick={onClear}>
        Clear Filters
      </Button>
    </EmptyState>
  );
}

export function GalleryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert">
      <EmptyState
        icon={<AlertIcon aria-hidden />}
        title="We couldn't load the Community."
        description="Check your connection, then try again."
      >
        <Button size="md" onClick={onRetry}>
          Try Again
        </Button>
      </EmptyState>
    </div>
  );
}

// My Shares, signed out: it needs to know who you are. On a build without sign-in (self-hosted, guest only)
// there is nobody to be, so it says so instead of offering a sign-in that does not exist.
export function GallerySignedOut({ available }: { available: boolean }) {
  if (!available) {
    return (
      <EmptyState
        icon={<MineIcon aria-hidden />}
        title="My Shares needs an account."
        description="This site has no sign-in, so there are no shares to list."
      />
    );
  }
  // Back to this very view after signing in; the gallery only renders this in the browser.
  const here = `${window.location.pathname}${window.location.search}`;
  return (
    <EmptyState
      icon={<MineIcon aria-hidden />}
      title="Sign in to see your shares."
      description="My Shares lists the documents you have shared to the Community, with how many likes and copies each has."
    >
      <a href={signInHref(here)} className={buttonClassName({ size: 'md' })}>
        <ButtonContent>Sign In</ButtonContent>
      </a>
    </EmptyState>
  );
}

// My Shares, signed in, nothing shared yet.
export function GalleryMineEmpty() {
  return (
    <EmptyState
      icon={<MineIcon aria-hidden />}
      title="You haven't shared anything yet."
      description="Share a document you are proud of, and see how it does here."
    >
      <a href={SHARE_YOUR_OWN_HREF} className={buttonClassName({ size: 'md' })}>
        <ButtonContent>Share Your Own</ButtonContent>
      </a>
    </EmptyState>
  );
}
