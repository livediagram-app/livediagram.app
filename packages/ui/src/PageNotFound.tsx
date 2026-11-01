// The not-found page of the static sites (marketing, help centre, Community; docs/specs/016-platform/router-app.md
// "Not found"): an address that names no page gets the site's own chrome around one calm card with the ways on, not
// a bare "404 | This page could not be found." with no way home. The editor keeps its own card (apps/editor NotFound),
// which offers the Explorer and a new document.
import { buttonClassName } from './Button';
import { EmptyState } from './EmptyState';
import { SearchIcon } from './icons/navigation';

export function PageNotFound({
  homeHref = '/',
  homeLabel = 'Go to the Home Page',
  helpHref = '/help/',
  helpLabel = 'Help Centre',
  inMain = false,
}: {
  // Where the main way back leads: the site's own home (the help centre's front page, the Community gallery).
  homeHref?: string;
  homeLabel?: string;
  // The second way on: the help centre, or (on the help centre itself) its troubleshooting guides.
  helpHref?: string;
  helpLabel?: string;
  // The site's layout already holds its pages in a <main> (the help centre, Community): the card is its content, not a
  // second main landmark inside the first.
  inMain?: boolean;
}) {
  const Landmark = inMain ? 'div' : 'main';
  return (
    <Landmark className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <EmptyState
        icon={<SearchIcon />}
        heading="h1"
        title="Page not found"
        description="There is no page at this address. It may have moved, or the link may have a typo."
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <a href={homeHref} className={buttonClassName({ variant: 'primary', size: 'md' })}>
            {homeLabel}
          </a>
          <a href={helpHref} className={buttonClassName({ variant: 'secondary', size: 'md' })}>
            {helpLabel}
          </a>
        </div>
      </EmptyState>
    </Landmark>
  );
}
