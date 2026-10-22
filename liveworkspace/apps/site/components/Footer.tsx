import { listedApps } from '@/lib/apps';
import { Wordmark } from './Wordmark';

const linkClass =
  'relative touch-target-y text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white';

// The footer (liveworkspace/docs/site.md "The front door"): every app again, and the platform's own
// services.
export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-[2fr_1fr_1fr] sm:px-6">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-xs text-sm text-slate-500 dark:text-slate-400">
            Live collaborative apps for every kind of work in a single platform.
          </p>
        </div>
        <FooterColumn title="Our Apps">
          {listedApps().map((app) => (
            <a key={app.id} href={app.url} className={linkClass}>
              {app.id}
            </a>
          ))}
        </FooterColumn>
        <FooterColumn title="Platform">
          <a href="/telemetry" className={linkClass}>
            Telemetry
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
