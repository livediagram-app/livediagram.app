import { BrandGlyph } from '@liveworkspace/brand';
import { APP_ORDER, type AppId, type HelpScope } from '@liveworkspace/help-registry';
import { APP_MARK_CLASS, appMarkStyle, appRingStyle } from '../lib/app-palette';

// The apps' marks as the help centre shows them (liveworkspace/docs/specs/017-help/help-centre.md "The logos"): each
// app's Living Prism glyph (BrandGlyph, stateless, no gradients, no motion), in its own colour. A row puts the
// current app first and rings it in its accent; under All Apps the row keeps the registry's order.

// The prism's top face is its faintest, so its ink sits low of its box: 0.63px at 22px on dark, past the optical
// audit's 0.5px (each product's docs/specs/004-interface-design/optical-alignment.md). Lifting the glyph by 1/44 of
// its size (0.5px at 22px, two device pixels at 4x) puts its ink on the centre of its ring and its row.
export const PRISM_INK_LIFT = 1 / 44;

/** One app's mark, `size` pixels square. `ringed` circles it in the app's accent, for the current app. */
export function AppMark({
  app,
  size = 16,
  ringed = false,
  className = '',
}: {
  app: AppId;
  size?: number;
  ringed?: boolean;
  className?: string;
}) {
  const glyph = (
    <BrandGlyph
      className={`block shrink-0 ${APP_MARK_CLASS} ${ringed ? '' : className}`}
      style={{
        ...appMarkStyle(app),
        width: size,
        height: size,
        transform: `translateY(-${size * PRISM_INK_LIFT}px)`,
      }}
    />
  );
  if (!ringed) return glyph;
  return (
    <span
      className={`inline-flex shrink-0 rounded-full p-0.5 ring-2 ring-(--app-ring) ring-offset-1 ring-offset-white dark:ring-offset-slate-900 ${className}`}
      style={appRingStyle(app)}
    >
      {glyph}
    </span>
  );
}

/** `apps` as a row shows them: the current app first, then the rest in registry order. */
export function rowOrder(apps: readonly AppId[], scope: HelpScope | undefined): AppId[] {
  const ordered = APP_ORDER.filter((a) => apps.includes(a));
  if (!scope || scope === 'all' || !ordered.includes(scope)) return ordered;
  return [scope, ...ordered.filter((a) => a !== scope)];
}

/** A row of marks, the current app first and ringed. Decorative: the line beside it names the apps. */
export function AppMarkRow({
  apps,
  scope,
  size = 16,
  className = '',
}: {
  apps: readonly AppId[];
  scope: HelpScope | undefined;
  size?: number;
  className?: string;
}) {
  return (
    <span aria-hidden className={`inline-flex items-center gap-1 ${className}`}>
      {rowOrder(apps, scope).map((app) => (
        <AppMark key={app} app={app} size={size} ringed={app === scope} />
      ))}
    </span>
  );
}
