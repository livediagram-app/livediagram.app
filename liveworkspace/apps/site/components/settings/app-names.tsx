import { listedApps } from '@/lib/apps';
import { AppLogo } from '@/components/landing/AppLogo';

// The apps named by their logos in Settings (Webhooks, Your Data), as the home page lists them, never as plain text.

// The apps, by the brand package's name.
const APPS = new Map(listedApps().map((app) => [app.id.replace(/\.app$/, ''), app]));

/** An app named by its logo and wordmark, at the size of the words around it. */
export function AppName({ app }: { app: string }) {
  const listed = APPS.get(app);
  return listed ? <AppLogo app={listed} size="xs" /> : <span>{app}</span>;
}

/** Every app, by their logos. */
export function EveryAppName() {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {[...APPS.values()].map((app) => (
        <AppLogo key={app.id} app={app} size="xs" />
      ))}
    </span>
  );
}
