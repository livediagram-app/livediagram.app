'use client';

import { lucideTriangleAlert } from '@liveworkspace/icons/lucide';
import { Button, buttonClassName, ButtonContent, lucideGlyph } from '@liveworkspace/ui';
import { ErrorCard } from './ErrorCard';
import { usePageErrorTitle } from './page-error-title';

const WarningIcon = lucideGlyph(lucideTriangleAlert, 16);

/** The words under a failed page's actions, before the status link (LazyPageError's plain card says the same). */
export const PAGE_ERROR_STATUS_LEAD = 'Still not working?';

// What a page that failed to render shows (liveworkspace/docs/specs/010-site/site.md "Behaviour"): the site's error
// card (ErrorCard) with Try Again, the way home and the status page. Drawn by app/error.tsx inside the root layout and
// by app/global-error.tsx, which stands in for it, through LazyPageError, so its code is fetched only when a page
// fails.
export function PageError({ onRetry }: { onRetry: () => void }) {
  usePageErrorTitle();
  return (
    <ErrorCard
      icon={<WarningIcon />}
      title="Something went wrong"
      description="This page couldn’t be shown. Nothing you made was lost: your work is saved in its app."
      statusLead={PAGE_ERROR_STATUS_LEAD}
    >
      <Button size="md" onClick={onRetry}>
        Try Again
      </Button>
      <a href="/" className={buttonClassName({ variant: 'secondary', size: 'md' })}>
        <ButtonContent>Go to the Home Page</ButtonContent>
      </a>
    </ErrorCard>
  );
}
