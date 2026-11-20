import { Brand, WorkspaceWordmark } from '@liveworkspace/brand';
import { PLATFORM_SITE } from '@liveworkspace/sites';
import { AppLogo, brandAppOf } from '@/components/landing/AppLogo';
import { listedApps } from '@/lib/apps';

// An app named by its logo (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard", Naming an app):
// the prism and the wordmark with "live" in the app's accent, as its own site's header draws it. Everywhere the
// dashboard names an app (the chips, a legend, a table row, a card) it is this, never the bare address. The
// wrapper's own `data-app` scopes the accent to it, whichever app is picked around it.
export function AppBrand({ app, size = 'sm' }: { app: string; size?: 'xs' | 'sm' }) {
  // The platform's own events (the Explorer and Settings on liveworkspace.app): its slate wordmark.
  if (app === PLATFORM_SITE.id) return <WorkspaceWordmark size="xs" />;
  const brand = brandAppOf(app);
  if (brand)
    return (
      <span data-app={app} className="inline-flex">
        <Brand app={brand} size={size} />
      </span>
    );
  // An app whose UI package isn't in this repo yet: the shared prism in its accent.
  const listed = listedApps().find((a) => a.id === app);
  return listed ? <AppLogo app={listed} size={size} /> : <>{app}</>;
}

/** The app's name as its logo spells it ('livediagram' for livediagram.app), for a label a logo can't sit in. */
export const appName = (app: string): string => app.replace(/\.app$/, '');
