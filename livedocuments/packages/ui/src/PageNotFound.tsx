// The not-found page of the static sites (marketing, help centre; docs/specs/016-platform/router-app.md
// "Not found"): an address that names no page gets the site's own chrome around one calm card with the ways on, not
// a bare "404 | This page could not be found." with no way home. The editor keeps its own card (apps/live NotFound),
// which offers the Explorer and a new document.
import { buttonClassName } from './Button';
import { EmptyState } from './EmptyState';
import { SearchIcon } from './icons';

export function PageNotFound({
  homeHref = '/',
  homeLabel = 'Go to the Home Page',
  helpHref = '/help/',
  helpLabel = 'Help Centre',
}: {
  // Where the main way back leads: the site's own home (the help centre's front page).
  homeHref?: string;
  homeLabel?: string;
  // The second way on: the help centre, or (on the help centre itself) its troubleshooting guides.
  helpHref?: string;
  helpLabel?: string;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <EmptyState
        icon={<SearchIcon />}
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
    </main>
  );
}
