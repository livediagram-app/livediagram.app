// 404 card surfaced when the URL points at a project that doesn't
// exist OR isn't owned by the current participant. The API returns
// 404 for both (we don't leak existence to strangers). It stands alone
// under the app header (docs/specs/007-editor/new-project-route.md "Unknown addresses"): no Explorer
// panel beside it, so its two ways on are its own buttons, the Explorer
// and a new project.

// The new-project sparkle, shared with the template picker's footer so
// the two create-new surfaces can't drift.
import { SparkleIcon } from '@/components/palette/template-picker-icons';
import { Button, CircleXIcon, lucideGlyph } from '@liveplanner/ui';
import { lucideFolder } from '@liveworkspace/icons/lucide';

const FolderIcon = lucideGlyph(lucideFolder, 16);

type NotFoundProps = {
  onCreateNew: () => void;
  // Opens the Explorer; absent (an embed) leaves the one button.
  onOpenExplorer?: () => void;
  // The address names no project at all (a mistyped or retired page, docs/specs/007-editor/new-project-route.md
  // "Unknown addresses"): the card speaks of a page, not a project.
  page?: boolean;
  // The project was open a moment ago and access to it ended (a team removal, a changed link;
  // lib/access-notice.ts): say that, rather than "doesn't exist or isn't yours".
  accessEnded?: boolean;
};

export function NotFound({
  onCreateNew,
  onOpenExplorer,
  page = false,
  accessEnded = false,
}: NotFoundProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="pointer-events-auto flex max-w-md animate-pop-in flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-300">
          <CircleXIcon />
        </div>
        {accessEnded ? null : (
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-300">
            404
          </p>
        )}
        <h1
          className={`${accessEnded ? 'mt-4' : 'mt-1'} text-xl font-semibold text-slate-900 dark:text-slate-100`}
        >
          {page ? 'Page not found' : accessEnded ? 'No Longer Shared With You' : 'Plan not found'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {page
            ? 'There is no page at this address. Open a plan from the Explorer or start fresh.'
            : accessEnded
              ? 'Your access to this plan was removed while you had it open. Ask its owner to share it with you again.'
              : 'This plan doesn’t exist or isn’t yours. Open one from the Explorer or start fresh.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {onOpenExplorer ? (
            <Button size="md" variant="secondary" onClick={onOpenExplorer}>
              <FolderIcon />
              Open Explorer
            </Button>
          ) : null}
          <Button size="md" onClick={onCreateNew} className="shadow-sm">
            <SparkleIcon />
            New Plan
          </Button>
        </div>
      </div>
    </div>
  );
}
