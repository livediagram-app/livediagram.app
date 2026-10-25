import { Button, ButtonContent, EmptyState, SearchIcon, buttonClassName } from '@livediagram/ui';
import { SHARE_YOUR_OWN_HREF } from '@/lib/links';
import { signInHref } from '@/lib/session';
import { MineIcon, PeopleIcon } from '../shared/icons';

// The gallery's empty and signed-out states (docs/specs/025-community/community.md "Gallery"; blueprint
// §9 final copy), one per cause.

// Nothing has been published yet.
export function GalleryEmpty() {
  return (
    <EmptyState
      icon={<PeopleIcon aria-hidden />}
      title="Nothing here yet."
      description="Be the first to share a canvas."
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
      title="No canvases match these filters."
      description="Try a different search, or browse everything."
    >
      <Button variant="secondary" size="md" onClick={onClear}>
        Clear Filters
      </Button>
    </EmptyState>
  );
}

// My Shares, signed out: it needs to know who you are.
export function GallerySignedOut() {
  // Back to this very view after signing in; the gallery only renders this in the browser.
  const here = `${window.location.pathname}${window.location.search}`;
  return (
    <EmptyState
      icon={<MineIcon aria-hidden />}
      title="Sign in to see your shares."
      description="My Shares lists the canvases you have shared to the Community, with how many likes and copies each has."
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
      description="Share a canvas you are proud of, and see how it does here."
    >
      <a href={SHARE_YOUR_OWN_HREF} className={buttonClassName({ size: 'md' })}>
        <ButtonContent>Share Your Own</ButtonContent>
      </a>
    </EmptyState>
  );
}
