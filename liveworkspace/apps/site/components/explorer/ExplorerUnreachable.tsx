'use client';

import { lucideCloudAlert } from '@liveworkspace/icons/lucide';
import { Button, EmptyState, lucideGlyph } from '@liveworkspace/ui';
import { STATUS_HREF, STATUS_LINK } from '../ErrorCard';

const CloudAlertIcon = lucideGlyph(lucideCloudAlert, 16);

export const EXPLORER_UNREACHABLE_COPY = {
  title: 'Your Explorer Couldn’t Load',
  description:
    'Your account didn’t answer in time. Nothing you made was lost: your work is saved in its app.',
  retry: 'Try Again',
} as const;

// What the Explorer shows in place of its placeholders when the person isn't known in time (ExplorerShell's bounded
// wait, liveworkspace/docs/specs/010-site/site.md "The Explorer"): what happened, Try Again (asked again in place)
// and the status page.
export function ExplorerUnreachable({ onRetry }: { onRetry: () => void }) {
  return (
    <main
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16 sm:px-6"
      data-explorer-unreachable=""
    >
      <EmptyState
        icon={<CloudAlertIcon />}
        title={EXPLORER_UNREACHABLE_COPY.title}
        description={EXPLORER_UNREACHABLE_COPY.description}
      >
        <Button size="md" onClick={onRetry}>
          {EXPLORER_UNREACHABLE_COPY.retry}
        </Button>
        <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
          Still not working?{' '}
          <a
            href={STATUS_HREF}
            className="inline-flex items-center font-medium pointer-coarse:min-h-11 text-slate-700 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-900 hover:decoration-slate-500 dark:text-slate-200 dark:decoration-slate-600 dark:hover:text-white dark:hover:decoration-slate-400"
          >
            {STATUS_LINK}
          </a>
        </p>
      </EmptyState>
    </main>
  );
}
