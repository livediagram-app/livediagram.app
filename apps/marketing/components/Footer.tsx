import { Brand } from '@livediagram/ui';

const REPO_URL = 'https://github.com/livediagram-app/monorepo';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
        <div>
          <Brand size="sm" />
          <p className="mt-1 text-sm text-slate-500">
            Diagrams and mindmaps for teams who think together.
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-500">
          <a href="/alternatives" className="hover:text-slate-900">
            Compare
          </a>
          <a href="/faq" className="hover:text-slate-900">
            FAQ
          </a>
          <a href="/terms" className="hover:text-slate-900">
            Terms
          </a>
          <a href="/privacy" className="hover:text-slate-900">
            Privacy
          </a>
          <a href="mailto:hello@livediagram.app" className="hover:text-slate-900">
            Contact
          </a>
        </div>
      </div>
      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-6 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2">
            <span>&copy; {new Date().getFullYear()} livediagram. MIT licensed.</span>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="livediagram on GitHub"
              className="text-slate-400 transition hover:text-slate-700"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 0C3.6 0 0 3.6 0 8c0 3.5 2.3 6.5 5.5 7.6.4.1.5-.2.5-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8.6-.2 1.3-.3 2-.3.7 0 1.4.1 2 .3 1.5-1 2.2-.8 2.2-.8.5 1.1.2 1.9.1 2.1.5.5.8 1.2.8 2.1 0 3-1.8 3.7-3.6 3.9.3.3.6.8.6 1.6v2.3c0 .2.1.5.6.4C13.7 14.5 16 11.5 16 8c0-4.4-3.6-8-8-8z" />
              </svg>
            </a>
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
