import { Brand } from './Brand';

// The public site footer shared by the marketing landing page and the
// telemetry dashboard. Brand + tagline on the left, the site nav + GitHub on
// the right, and a thin legal/credits strip below.
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
        <div>
          <Brand size="sm" />
          <p className="mt-1 text-sm text-slate-500">
            Free diagrams and mindmaps for teams who think together.
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500"
        >
          <a href="/alternatives" className="hover:text-slate-900">
            Compare
          </a>
          <a href="/faq" className="hover:text-slate-900">
            FAQ
          </a>
          <a href="/help/policies/terms/" className="hover:text-slate-900">
            Terms
          </a>
          <a href="/help/policies/privacy-policy/" className="hover:text-slate-900">
            Privacy
          </a>
          <a href="/status" className="hover:text-slate-900">
            Status
          </a>
          <a href="mailto:hello@livediagram.app" className="hover:text-slate-900">
            Contact
          </a>
          <a
            href="https://github.com/livediagram-app/monorepo"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="livediagram on GitHub"
            className="inline-flex items-center hover:text-slate-900"
          >
            <GitHubIcon />
          </a>
        </nav>
      </div>
      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-6 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span>&copy; {new Date().getFullYear()} livediagram. MIT licensed.</span>
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span>
              Managing a team?{' '}
              <a
                href="https://manager-toolkit.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-500 hover:text-brand-600"
              >
                Try Manager Toolkit
              </a>
            </span>
            <span aria-hidden="true">&middot;</span>
            <span>
              Built by{' '}
              <a
                href="https://www.tommcclean.me"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-500 hover:text-brand-600"
              >
                Tom McClean
              </a>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.335-5.467-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
