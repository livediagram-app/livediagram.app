import { Button, ButtonContent, EmptyState, SearchIcon, buttonClassName } from '@liveworkspace/ui';
import { useCommunitySite } from '../../client';
import { MineIcon, PeopleIcon } from '../shared/icons';

// The gallery's empty and signed-out states (livediagram/docs/specs/025-community/community.md "Gallery"), one per cause, in
// the app's words.

// Nothing has been published yet.
export function GalleryEmpty() {
  const { words, links } = useCommunitySite();
  return (
    <EmptyState
      icon={<PeopleIcon aria-hidden />}
      title="Nothing here yet."
      description={`Be the first to share a ${words.noun}.`}
    >
      <a href={links.shareYourOwn} className={buttonClassName({ size: 'md' })}>
        <ButtonContent>Share Your Own</ButtonContent>
      </a>
    </EmptyState>
  );
}

// Posts exist, but none match the search, category or tag.
export function GalleryNoMatches({ onClear }: { onClear: () => void }) {
  const { words } = useCommunitySite();
  return (
    <EmptyState
      icon={<SearchIcon aria-hidden />}
      title={`No ${words.nouns} match these filters.`}
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
  const { words, links } = useCommunitySite();
  // Back to this very view after signing in; the gallery only renders this in the browser.
  const here = `${window.location.pathname}${window.location.search}`;
  return (
    <EmptyState
      icon={<MineIcon aria-hidden />}
      title="Sign in to see your shares."
      description={`My Shares lists the ${words.nouns} you have shared to the Community, with how many likes and copies each has.`}
    >
      <a href={links.signIn(here)} className={buttonClassName({ size: 'md' })}>
        <ButtonContent>Sign In</ButtonContent>
      </a>
    </EmptyState>
  );
}

// My Shares, signed in, nothing shared yet.
export function GalleryMineEmpty() {
  const { words, links } = useCommunitySite();
  return (
    <EmptyState
      icon={<MineIcon aria-hidden />}
      title="You haven't shared anything yet."
      description={`Share a ${words.noun} you are proud of, and see how it does here.`}
    >
      <a href={links.shareYourOwn} className={buttonClassName({ size: 'md' })}>
        <ButtonContent>Share Your Own</ButtonContent>
      </a>
    </EmptyState>
  );
}
