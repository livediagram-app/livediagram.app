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
import {
  Button,
  ButtonContent,
  buttonClassName,
  CircleXIcon,
  lucideGlyph,
} from '@liveworkspace/ui';
import { notFoundTitle, type NotFoundReason } from '../../lib/not-found-reason';
import { lucideFolder, lucideLogIn, lucideUnlink } from '@liveworkspace/icons/lucide';

const FolderIcon = lucideGlyph(lucideFolder, 16);
// A share link that no longer opens anything: the tile's glyph, at the size and weight of the CircleXIcon it stands in for.
const UnlinkIcon = lucideGlyph(lucideUnlink, 28);
// The Sign In button's glyph, beside the Open Explorer folder.
const SignInIcon = lucideGlyph(lucideLogIn, 16);

// Lucide's archive box, drawn as the Explorer's Archived row draws it, so the card and the row read as one place.
function ArchiveBoxIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export type NotFoundProps = {
  // The product's word for what the address opens, in lower case and taking "a" ('design', 'plan'):
  // the card reads "Design Not Found", "Open a design", "New Design".
  noun: string;
  // Which case the card says (lib/not-found-reason.ts, the new-file route spec's "Which not-found card"). Left out,
  // the plain "doesn't exist or isn't yours".
  reason?: NotFoundReason;
  // Inside someone else's page (an embed or a workbench frame): a refused share code says the item is no longer
  // shared, and offers nothing to create.
  embed?: boolean;
  // Opens a new file; absent leaves New out.
  onCreateNew?: () => void;
  // Opens the Explorer; absent (an embed) leaves the one button.
  onOpenExplorer?: () => void;
  // Where Sign In goes for the `sign-in` case: the sign-in page, returning to this address.
  signInHref?: string;
  // The file is in its owner's Archived (liveworkspace/docs/specs/004-index/one-explorer.md "Archived"): the index
  // refused its grant as `archived`, or this browser holds it archived. The card says so and offers Change Folder,
  // which moves it out; without `onChangeFolder` (an embed) only Open Explorer is offered.
  archived?: { onChangeFolder?: () => void } | null;
};

// The line under the body for the cases a colleague reaches from an editor address someone copied (signed out, or
// signed in without access): only a share link lets them in.
function shareHintOf(reason: NotFoundReason, noun: string): string | null {
  return reason === 'sign-in' || reason === 'missing'
    ? `If you are joining a colleague on this ${noun}, ask them to share a URL via the Share button.`
    : null;
}

// What the card says under its heading, case by case.
function bodyOf(reason: NotFoundReason, noun: string, embed: boolean): string {
  switch (reason) {
    case 'page':
      return `There is no page at this address. Open a ${noun} from the Explorer or start fresh.`;
    case 'access-ended':
      return `Your access to this ${noun} was removed while you had it open. Ask its owner to share it with you again.`;
    case 'dead-link':
      return embed
        ? `This ${noun} is no longer shared at this link. Ask whoever shared it for a new one.`
        : 'This link isn’t valid. It may have been turned off or copied incompletely. Ask whoever shared it for a new one.';
    case 'sign-in':
      return `This ${noun} doesn’t exist, or you don’t have access to it.`;
    default:
      return `This ${noun} doesn’t exist or isn’t yours. Open one from the Explorer or start fresh.`;
  }
}

export function NotFound({
  noun,
  reason = 'missing',
  embed = false,
  onCreateNew,
  onOpenExplorer,
  signInHref,
  archived = null,
}: NotFoundProps) {
  const Noun = capitalised(noun);
  const shareHint = shareHintOf(reason, noun);
  if (archived) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
        <div className="pointer-events-auto flex max-w-md animate-pop-in flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <ArchiveBoxIcon />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {`${Noun} Archived`}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {`This ${noun} is archived, so it can’t be opened or edited. Move it out of Archived with Change Folder to work on it again.`}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {onOpenExplorer ? (
              <Button size="md" variant="secondary" onClick={onOpenExplorer}>
                <FolderIcon />
                Open Explorer
              </Button>
            ) : null}
            {archived.onChangeFolder ? (
              <Button
                size="md"
                onClick={archived.onChangeFolder}
                className="shadow-sm"
                title={`Choose where this ${noun} goes, out of Archived`}
              >
                <FolderIcon />
                Change Folder
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
  // A dead link and ended access are not a missing address: no "404" line, and a dead link's tile is the link itself.
  const deadLink = reason === 'dead-link';
  const quiet = deadLink || reason === 'access-ended';
  const signIn = reason === 'sign-in' && signInHref ? signInHref : null;
  // An embed's dead link leads nowhere its host meant: nothing to create there.
  const createNew = deadLink && embed ? undefined : onCreateNew;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="pointer-events-auto flex max-w-md animate-pop-in flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
        {deadLink ? (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <UnlinkIcon />
          </div>
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-300">
            <CircleXIcon />
          </div>
        )}
        {quiet ? null : (
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-300">
            404
          </p>
        )}
        <h1
          className={`${quiet ? 'mt-4' : 'mt-1'} text-xl font-semibold text-slate-900 dark:text-slate-100`}
        >
          {notFoundTitle(reason, noun, embed)}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {bodyOf(reason, noun, embed)}
        </p>
        {shareHint ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {shareHint}
          </p>
        ) : null}
        {onOpenExplorer || createNew || signIn ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {onOpenExplorer ? (
              <Button size="md" variant="secondary" onClick={onOpenExplorer}>
                <FolderIcon />
                Open Explorer
              </Button>
            ) : null}
            {signIn ? (
              <a href={signIn} className={buttonClassName({ size: 'md', className: 'shadow-sm' })}>
                <ButtonContent>
                  <SignInIcon />
                  Sign In
                </ButtonContent>
              </a>
            ) : createNew ? (
              <Button size="md" onClick={createNew} className="shadow-sm">
                <SparkleIcon />
                {`New ${capitalised(noun)}`}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
