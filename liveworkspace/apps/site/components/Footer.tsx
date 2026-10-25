import { TERMS_LABEL } from '@liveworkspace/sites';
import { listedApps } from '@/lib/apps';
import { AppLogo } from './landing/AppLogo';
import { Wordmark } from './Wordmark';

const linkClass =
  'relative touch-target-y text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white';

// The footer (liveworkspace/docs/site.md "The front door"): every app again, the platform's own
// pages and services (Comparison, which points at each app's comparisons), and the privacy
// policy and terms that cover all of them, and the site's third-party licences.
export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-[2fr_1fr_1fr_1fr] sm:px-6">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-xs text-sm text-slate-500 dark:text-slate-400">
            Live collaborative apps for every kind of work in a single platform.
          </p>
        </div>
        <FooterColumn title="Our Apps">
          {listedApps().map((app) => (
            <a
              key={app.id}
              href={app.url}
              aria-label={app.id}
              className="relative touch-target-y rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <AppLogo app={app} size="sm" />
            </a>
          ))}
        </FooterColumn>
        <FooterColumn title="Platform">
          <a href="/compare" className={linkClass}>
            Comparison
          </a>
          <a href="/telemetry" className={linkClass}>
            Telemetry
          </a>
        </FooterColumn>
        <FooterColumn title="Legal">
          <a href="/privacy" className={linkClass}>
            Privacy Policy
          </a>
          <a href="/terms" className={linkClass}>
            {TERMS_LABEL}
          </a>
          {/* Third-party licences (liveworkspace/docs/site.md "Licences"). */}
          <a href="/licences" className={linkClass}>
            Licences
          </a>
        </FooterColumn>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      <div className="mt-3 flex flex-col items-start gap-2 text-sm">{children}</div>
    </div>
  );
}
