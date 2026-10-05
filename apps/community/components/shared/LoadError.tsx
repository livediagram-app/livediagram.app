import { Button, EmptyState } from '@livediagram/ui';
import { AlertIcon } from './icons';

// A load that failed (docs/specs/025-community/community.md "Gallery", "Post"): says what could not load, and
// Try Again. Announced, since it replaces what the reader was waiting for.
export function LoadError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div role="alert">
      <EmptyState
        icon={<AlertIcon aria-hidden />}
        title={title}
        description="Check your connection, then try again."
      >
        <Button size="md" onClick={onRetry}>
          Try Again
        </Button>
      </EmptyState>
    </div>
  );
}
