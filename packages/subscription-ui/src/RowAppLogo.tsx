'use client';

import { BrandMark } from '@liveworkspace/brand';
import { APP_SITES } from '@liveworkspace/sites';
import { rowAppsName, type RowApp } from '@liveworkspace/subscription';
import { Tooltip } from '@liveworkspace/ui';

// Each app's accent, from the one list of the apps (@liveworkspace/sites).
const ACCENTS = new Map(APP_SITES.map((site) => [site.name, site.accent]));
const accentOf = (app: RowApp): string | undefined => ACCENTS.get(app);

/** The line under a row's name: "Every app", "Every app but livehuddle", "liveknowledge", or the apps by name. */
export const rowAppName = rowAppsName;

// The column every row's logos take, so each row's name starts at the same place: the widest block is three small
// marks across (six apps, three by two). One app's mark is drawn larger, in the middle of it.
const COLUMN = 'w-[46px]';
const SMALL = 'size-3.5';

/** One app's mark, named in its tooltip and to a screen reader. */
function AppMark({ app, className }: { app: RowApp; className: string }) {
  return (
    <Tooltip label={app}>
      <span role="img" aria-label={app} data-row-app={app} className="inline-flex shrink-0">
        <BrandMark app={app} accentColor={accentOf(app)} className={className} />
      </span>
    </Tooltip>
  );
}

/**
 * The logos of the apps a comparison row applies to (`LimitRow.apps`; owner, 2026-11-22: each app's own, never
 * liveworkspace's for a shared limit). One app's mark, or a small block of each of them, three across, every mark named
 * in a tooltip.
 */
export function RowAppLogo({
  apps,
  className = 'size-6',
}: {
  apps: readonly RowApp[];
  /** One app's mark size. */
  className?: string;
}) {
  return (
    <span data-row-apps={apps.join(' ')} className={`flex shrink-0 justify-center ${COLUMN}`}>
      {apps.length === 1 ? (
        <AppMark app={apps[0]!} className={className} />
      ) : (
        <span className="grid grid-cols-3 gap-0.5">
          {apps.map((app) => (
            <AppMark key={app} app={app} className={SMALL} />
          ))}
        </span>
      )}
    </span>
  );
}
