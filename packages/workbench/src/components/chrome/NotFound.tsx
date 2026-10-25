// 404 card surfaced when the URL points at a file that doesn't
// exist OR isn't owned by the current participant. The API returns
// 404 for both (we don't leak existence to strangers). It stands alone
// under the app header (the product's new-file route spec in docs/specs/007-editor/, "Unknown
// addresses"): no Explorer panel beside it, so its two ways on are its own buttons, the Explorer
// and a new file. The editor names the file in its own word (`noun`) through a thin binding of its
// own (components/chrome/NotFound.tsx), so each product's copy reads as it did.

// The new-file sparkle, shared with the template picker's footer so
// the two create-new surfaces can't drift.
import { SparkleIcon } from '../palette/template-picker-icons';
import { Button, CircleXIcon, lucideGlyph } from '@liveworkspace/ui';
import { lucideFolder } from '@liveworkspace/icons/lucide';

const FolderIcon = lucideGlyph(lucideFolder, 16);

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export type NotFoundProps = {
  // The product's word for what the address opens, in lower case and taking "a" ('design', 'plan'):
  // the card reads "Design not found", "Open a design", "New Design".
  noun: string;
  onCreateNew: () => void;
  // Opens the Explorer; absent (an embed) leaves the one button.
  onOpenExplorer?: () => void;
  // The address names no file at all (a mistyped or retired page, "Unknown addresses"): the card
  // speaks of a page, not a file.
  page?: boolean;
  // The file was open a moment ago and access to it ended (a team removal, a changed link;
  // lib/access-notice.ts): say that, rather than "doesn't exist or isn't yours".
  accessEnded?: boolean;
};

export function NotFound({
  noun,
  onCreateNew,
  onOpenExplorer,
  page = false,
  accessEnded = false,
}: NotFoundProps) {
  const Noun = capitalised(noun);
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
          {page
            ? 'Page not found'
            : accessEnded
              ? 'No Longer Shared With You'
              : `${Noun} not found`}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {page
            ? `There is no page at this address. Open a ${noun} from the Explorer or start fresh.`
            : accessEnded
              ? `Your access to this ${noun} was removed while you had it open. Ask its owner to share it with you again.`
              : `This ${noun} doesn’t exist or isn’t yours. Open one from the Explorer or start fresh.`}
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
            {`New ${Noun}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
