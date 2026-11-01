'use client';

import { useEffect } from 'react';
import { lucideTriangleAlert } from '@liveworkspace/icons/lucide';
import { Button, buttonClassName, ButtonContent, EmptyState, lucideGlyph } from '@liveworkspace/ui';

const WarningIcon = lucideGlyph(lucideTriangleAlert, 16);

// The page's own title while it shows. Set on the document rather than rendered as a <title>: the failed page's
// metadata title is already in the head, and the first <title> is the one a tab shows.
export const PAGE_ERROR_TITLE = 'Something went wrong · liveworkspace';
let shown = 0;
let titleBefore = '';

// What a page that failed to render shows (liveworkspace/docs/specs/010-site/site.md "Behaviour"): the shared empty
// state as one calm card in a main landmark, its heading the page's h1, with Try Again and the way home. Used by
// app/error.tsx inside the root layout and by app/global-error.tsx, which stands in for it.
export function PageError({ onRetry }: { onRetry: () => void }) {
  useEffect(() => {
    // Counted, since Next can mount the card again before the first one goes: the page's own title comes back only
    // when the last one does (Try Again that works).
    if (shown++ === 0) titleBefore = document.title;
    const claim = () => {
      if (document.title !== PAGE_ERROR_TITLE) document.title = PAGE_ERROR_TITLE;
    };
    claim();
    // The failed page's metadata <title> is React's, and its next commit writes the old words back: held while shown.
    const watch = new MutationObserver(claim);
    watch.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      watch.disconnect();
      if (--shown === 0) document.title = titleBefore;
    };
  }, []);
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
