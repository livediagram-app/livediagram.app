'use client';

import { lucideTriangleAlert } from '@liveworkspace/icons/lucide';
import { Button, buttonClassName, ButtonContent, EmptyState, lucideGlyph } from '@liveworkspace/ui';
import { usePageErrorTitle } from './page-error-title';

const WarningIcon = lucideGlyph(lucideTriangleAlert, 16);

// What a page that failed to render shows (liveworkspace/docs/specs/010-site/site.md "Behaviour"): the shared empty
// state as one calm card in a main landmark, its heading the page's h1, with Try Again and the way home. Drawn by
// app/error.tsx inside the root layout and by app/global-error.tsx, which stands in for it, through LazyPageError, so
// its code is fetched only when a page fails.
export function PageError({ onRetry }: { onRetry: () => void }) {
  usePageErrorTitle();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
      <EmptyState
        icon={<WarningIcon />}
        heading="h1"
        title="Something went wrong"
        description="This page couldn’t be shown. Nothing you made was lost: your work is saved in its app."
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="md" onClick={onRetry}>
            Try Again
          </Button>
          <a href="/" className={buttonClassName({ variant: 'secondary', size: 'md' })}>
            <ButtonContent>Go to the Home Page</ButtonContent>
          </a>
        </div>
      </EmptyState>
    </main>
  );
}
