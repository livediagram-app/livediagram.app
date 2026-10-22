import { SITES } from '@liveworkspace/sites';
import { listedApps } from '@/lib/apps';
import { Wordmark } from './Wordmark';

const linkClass =
  'relative touch-target-y text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white';

// The footer (liveworkspace/docs/marketing-site.md "The page"): every site again, the platform's own
// services, and each app's privacy policy.
export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-[1.5fr_1fr_1fr_1fr] sm:px-6">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-xs text-sm text-slate-500 dark:text-slate-400">
            Live apps for every kind of work, under one roof.
          </p>
        </div>
        <FooterColumn title="Sites">
          {SITES.map((site) => (
            <a key={site.id} href={site.url} className={linkClass}>
              {site.id}
            </a>
          ))}
        </FooterColumn>
        <FooterColumn title="Platform">
          <a href="/telemetry" className={linkClass}>
            Telemetry
          </a>
          <a href="https://liveworkspace.app/sign-in" className={linkClass}>
            Accounts
          </a>
        </FooterColumn>
        <FooterColumn title="Privacy">
          {listedApps().map((app) => (
            <a key={app.id} href={app.privacy} className={linkClass}>
              {app.name}
            </a>
          ))}
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
