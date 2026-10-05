import { Button } from '@livediagram/ui';

// Load More (docs/specs/025-community/community.md "Gallery": 24 per page). A failed page keeps the
// button so the visitor can try again, and says so.
export function LoadMore({
  loading,
  failed,
  onClick,
}: {
  loading: boolean;
  failed: boolean;
  onClick: () => void;
}) {
  return (
    <div className="mt-10 flex flex-col items-center gap-2">
      <Button
        variant="secondary"
        size="md"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? 'Loading...' : failed ? 'Try Again' : 'Load More'}
      </Button>
      {failed ? (
        <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
          We couldn&apos;t load more boards.
        </p>
      ) : null}
    </div>
  );
}
