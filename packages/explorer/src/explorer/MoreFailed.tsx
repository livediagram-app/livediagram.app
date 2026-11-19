// The row under a list whose next page failed to load: the list is not complete, and Try Again asks for that
// page once per press (never on its own, so a failing index is not asked in a loop).

import { Callout } from '@liveworkspace/ui/callout';

export function MoreFailed({ onRetry, loading }: { onRetry: () => void; loading: boolean }) {
  return (
    <div data-explorer-more-failed className="mt-3">
      <Callout
        tone="error"
        size="md"
        role="status"
        action={{ label: loading ? 'Loading…' : 'Try Again', onSelect: onRetry, disabled: loading }}
      >
        Couldn’t load the rest of this list.
      </Callout>
    </div>
  );
}
