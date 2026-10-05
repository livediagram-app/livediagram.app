import { Button, ButtonContent, EmptyState, SearchIcon, buttonClassName } from '@livediagram/ui';
import { EMPTY_INVITE_HREF } from '@/lib/links';
import { AlertIcon, PeopleIcon } from '../shared/icons';

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
      <a href={EMPTY_INVITE_HREF} className={buttonClassName({ size: 'md' })}>
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
