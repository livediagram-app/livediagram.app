import { lucideLayoutGrid } from '@liveworkspace/icons/lucide';
import { ButtonContent, buttonClassName } from '../Button';
import { lucideGlyph } from '../icons/lucide-glyph';

const TemplatesIcon = /* @__PURE__ */ lucideGlyph(lucideLayoutGrid, 14);

// The site header's primary (docs/specs/019-marketing/marketing-site.md "Header"): Choose Template
// (/new, the encouraged wizard path) for a visitor, Open Explorer (their things) for someone signed
// in. Who is signed in comes from the product's readable hint cookie, so the public sites never load
// the session; it only picks a link, it authenticates nothing. The static HTML is Choose Template for
// everyone, and both labels share one cell sized to the wider, so the swap after hydration moves
// nothing in the bar. Each product binds it (its HeaderPrimaryCta) to its /new href for the page's
// funnel slot, its Explorer Home and its hint cookie.

// Where the label drops its verb: below 430px by default, below `md` in the marketing bar, which holds three
// links and the account menu (SiteHeader's MarketingActions).
const VERB_HIDDEN = { '430px': 'max-[429px]:hidden', md: 'max-md:hidden' } as const;

export type HeaderPrimaryCtaProps = {
  // False on a marketing page, whose Explorer link is always beside it: Choose Template for everyone.
  explorerWhenSignedIn?: boolean;
  shortBelow?: keyof typeof VERB_HIDDEN;
  // A marketing bar's: a quiet link like Build with AI beside it, the bar's one filled button being Explorer's
  // (SiteHeader's MarketingActions). Just its icon below `lg`, as theirs.
  quiet?: boolean;
  className?: string;
};

export function HeaderPrimaryCta({
  newHref,
  explorerHref,
  signedIn: signedInHint,
  explorerWhenSignedIn = true,
  shortBelow = '430px',
  quiet = false,
  className = '',
}: HeaderPrimaryCtaProps & {
  // The wizard, carrying the page's funnel slot (`/new?via=<surface>.Header`) when it has one.
  newHref: string;
  // The product's Explorer Home.
  explorerHref: string;
  // Whether the product's hint cookie says someone is signed in (false until hydrated).
  signedIn: boolean;
}) {
  const signedIn = signedInHint && explorerWhenSignedIn;
  if (quiet) {
    return (
      <a
        href={newHref}
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
  const href = signedIn ? explorerHref : newHref;
  const name = signedIn ? 'Open Explorer' : 'Choose Template';
  // Narrow, each label drops its verb so the bar fits a phone beside the longest wordmark
  // (421px with the verb); the aria-label keeps it.
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
