// The row under a list whose next page failed to load: the list is not complete, and Try again asks for that
// page once per press (never on its own, so a failing index is not asked in a loop).

export function MoreFailed({ onRetry, loading }: { onRetry: () => void; loading: boolean }) {
  return (
    <div
      role="status"
      data-explorer-more-failed
      className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
    >
      Couldn’t load the rest of this list.{' '}
      <button
        type="button"
        className="font-semibold underline disabled:opacity-60"
        onClick={onRetry}
        disabled={loading}
      >
        {loading ? 'Loading…' : 'Try again'}
      </button>
    </div>
  );
}
