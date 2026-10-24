'use client';

import { explorerHomeHref } from '@liveworkspace/sites/workspace-proxy';
import { ctaHref, type CtaSurface } from '@livedesign/api-schema';
import { useSyncExternalStore } from 'react';
import { signedInFromCookie } from './browser-repair/identity';
import { lucideLayoutGrid } from '@livedesign/icons/lucide';
import { ButtonContent, buttonClassName } from './Button';
import { lucideGlyph } from './icons/lucide-glyph';

const TemplatesIcon = lucideGlyph(lucideLayoutGrid, 14);

// The site header's primary (docs/specs/019-marketing/marketing-site.md "Header"): Choose Template
// (/new, the encouraged wizard path) for a visitor, Open Explorer (their designs) for someone signed
// in. Who is signed in comes from the api's readable `ldes_signed_in` hint cookie, so the public
// sites never load the session; it only picks a link, it authenticates nothing. The static
// HTML is Choose Template for everyone, and both labels share one cell sized to the wider, so the swap
// after hydration moves nothing in the bar.

// The Explorer is liveworkspace's, served under livedesign's own address while its switch is on
// (@liveworkspace/sites/workspace-proxy), so its Home is this site's /explorer/home.
export const EXPLORER_HOME_HREF = explorerHomeHref('livedesign');

const noSubscription = () => () => {};
const signedInNow = () => signedInFromCookie(document.cookie) === true;
const signedOutOnServer = () => false;

// Whether the hint cookie says someone is signed in: false in the static HTML, read after hydration.
export function useSignedInHint(): boolean {
  return useSyncExternalStore(noSubscription, signedInNow, signedOutOnServer);
}

// Where the label drops its verb: below 430px by default, below `md` in the marketing bar, which holds three
// links and the account menu (SiteHeader's MarketingActions).
const VERB_HIDDEN = { '430px': 'max-[429px]:hidden', md: 'max-md:hidden' } as const;

export function HeaderPrimaryCta({
  ctaSurface,
  explorerWhenSignedIn = true,
  shortBelow = '430px',
  quiet = false,
  className = '',
}: {
  ctaSurface?: CtaSurface;
  // False on a marketing page, whose Explorer link is always beside it: Choose Template for everyone.
  explorerWhenSignedIn?: boolean;
  shortBelow?: keyof typeof VERB_HIDDEN;
  // A marketing bar's: a quiet link like Build with AI beside it, the bar's one filled button being Explorer's
  // (SiteHeader's MarketingActions). Just its icon below `lg`, as theirs.
  quiet?: boolean;
  className?: string;
}) {
  const signedIn = useSignedInHint() && explorerWhenSignedIn;
  if (quiet) {
    return (
      <a
        href={ctaSurface ? ctaHref('/new', `${ctaSurface}.Header`) : '/new'}
        aria-label="Choose Template"
        className={buttonClassName({
          variant: 'ghost',
          size: 'md',
          className: `relative shrink-0 touch-target-y max-lg:px-3 max-[359px]:!px-2.5 !text-slate-600 dark:!text-slate-300 ${className}`,
        })}
      >
        <TemplatesIcon aria-hidden className="text-brand-700 dark:text-brand-400" />
        <span className="text-optical-line max-lg:hidden">Choose Template</span>
      </a>
    );
  }
  const href = signedIn
    ? EXPLORER_HOME_HREF
    : ctaSurface
      ? ctaHref('/new', `${ctaSurface}.Header`)
      : '/new';
  const name = signedIn ? 'Open Explorer' : 'Choose Template';
  // Narrow, each label drops its verb so the bar fits a phone beside the longest wordmark
  // (livedocuments: 421px with the verb); the aria-label keeps it.
  const label = (verb: string, noun: string) => (
    <>
      <span className={VERB_HIDDEN[shortBelow]}>{verb} </span>
      {noun}
    </>
  );
  return (
    <a
      href={href}
      aria-label={name}
      className={buttonClassName({
        size: 'md',
        // A transparent border, so it is the height of Start Blank (a bordered secondary) beside it.
        className: `relative shrink-0 border border-transparent shadow-sm touch-target-y ${className}`,
      })}
    >
      <ButtonContent>
        {explorerWhenSignedIn ? (
          <span className="grid justify-items-center">
            <span className={`text-optical-line [grid-area:1/1] ${signedIn ? 'invisible' : ''}`}>
              {label('Choose', 'Template')}
            </span>
            <span
              aria-hidden
              className={`text-optical-line [grid-area:1/1] ${signedIn ? '' : 'invisible'}`}
            >
              {label('Open', 'Explorer')}
            </span>
          </span>
        ) : (
          <span className="text-optical-line">{label('Choose', 'Template')}</span>
        )}
      </ButtonContent>
    </a>
  );
}
