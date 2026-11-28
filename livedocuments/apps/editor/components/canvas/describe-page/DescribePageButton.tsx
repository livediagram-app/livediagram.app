'use client';

// Describe a Page's button (docs/specs/007-editor/describe-a-page.md "The button"): in Contents' foot, after Add Page
// and before Contents Options, a square button the cog's size with the AI sparkle, named for the tab's kind ("Describe a
// Slide"). An Editor's who is signed in (Contents gives a Participant and a Viewer no foot to hold it); disabled at the
// page limit, as Add Page is. The dialog's code loads only once it is pressed.
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { MAX_PAGES, pageKindOf, type PageKind } from '@livedocuments/document';
import { SparkleIcon, Tooltip } from '@livedocuments/ui';
import { useEditorAiScope } from '@liveworkspace/workbench/components/ai/ai-source-scope';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import type { PageContents } from '@/hooks/ui/usePageContents';
import { track } from '@/lib/telemetry';
import { DESCRIBE_PAGE_WORDS } from './describe-page-words';

const DescribePageHost = dynamic(
  () => import('./DescribePageHost').then((m) => m.DescribePageHost),
  { ssr: false },
);

// The cog's own square beside it (ContentsOptions), so the foot reads as one row of controls.
const SQUARE =
  'flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border transition focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-40';
const REST =
  'border-slate-200 bg-white text-brand-700 hover:border-brand-300 hover:bg-brand-50 active:bg-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-brand-300 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100 dark:active:bg-brand-500/30';
const OPEN =
  'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-400/60 dark:bg-brand-500/20 dark:text-brand-100';

export function DescribePageButton({
  view,
  contents,
  onMade,
}: {
  view: PagesModeView;
  contents: PageContents;
  // After the page is made (the phone's Contents sheet closes then).
  onMade?: () => void;
}) {
  const { signedIn } = useEditorAiScope();
  const [open, setOpen] = useState<PageKind | null>(null);
  const { lastPage, full } = contents;
  if (!signedIn || !lastPage || !contents.canAdd) return null;
  const words = DESCRIBE_PAGE_WORDS[pageKindOf(lastPage)];
  const label = full ? `A tab holds up to ${MAX_PAGES} pages` : `${words.title} with AI`;
  return (
    <>
      <Tooltip label={label}>
        <button
          type="button"
          aria-label={full ? `${words.title}: ${label}` : label}
          aria-haspopup="dialog"
          data-describe-page-button=""
          disabled={full || !view.edit?.addDraftedPage}
          onClick={() => {
            track('UI', 'Opened', 'DescribePage');
            setOpen(pageKindOf(lastPage));
          }}
          className={`${SQUARE} ${open ? OPEN : REST}`}
        >
          <SparkleIcon size={16} aria-hidden />
        </button>
      </Tooltip>
      {open ? (
        <DescribePageHost
          kind={open}
          view={view}
          contents={contents}
          onClose={() => setOpen(null)}
          {...(onMade ? { onMade } : {})}
        />
      ) : null}
    </>
  );
}
