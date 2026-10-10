import { ctaHref, type CtaSurface } from '@livediagram/api-schema';
import type { ReactNode } from 'react';
import { Brand } from './Brand';
import { ButtonContent, buttonClassName } from './Button';
import { ProductNav, type ProductNavKey } from './ProductNav';
import { ShareRail } from './ShareRail';
import { StartBlankMenu } from './StartBlankMenu';

// The public site header shared by the marketing landing page, the telemetry
// dashboard and the help centre so the three read as one product. Brand +
// apps-menu dropdown on the left, the CTA pair on the right (a secondary
// "Start Blank", a menu of one blank per editor mode (StartBlankMenu), beside the
// primary "Choose Template", /new, the encouraged wizard path), with the
// ShareRail pinned to the page edge below. Cross-surface navigation (Help,
// Explorer, Telemetry, ...) lives in the apps menu, so the header itself
// carries just those CTAs. The Appearance toggle is never here
// (docs/specs/004-interface-design/appearance.md): it sits on the page-edge rail (xl+), and where there is
// no gutter for the rail it is left out (the device's own setting applies through System).
//
// `productNav` is the current section key for the apps-menu dropdown next to
// the logo (the landing page passes 'home', which reads as "Welcome").
// `center` is an optional slot between the two clusters, shown from `sm` up
// (the help centre's search box). `actions` replaces the default CTA pair
// (no surface uses it today). `shareRail` (default true) puts the
// share links on the page-edge rail; help and Community turn them off, keeping the rail's Appearance card. `wide` matches a surface whose
// pages run max-w-7xl with md:px-8 (help), so the logo lines up with the
// breadcrumb and content below instead of sitting inside a narrower column.
//
// The bar has a fixed height (h-18, 72px) rather than padding around its
// content, so a surface that sticks something under it (help's breadcrumb
// bar, `top-18`) can rely on the number at every breakpoint.
//
// `ctaSurface` names the page for the landing funnel (docs/specs/019-marketing/landing-funnel.md): the default
// pair's hrefs carry `via=<surface>.Header` / `.HeaderDraw` so the editor can
// count which page's header brought somebody in. A surface passing its own
// `actions` tags those links itself.
export function SiteHeader({
  productNav,
  ctaSurface,
  center,
  actions,
  shareRail = true,
  wide = false,
}: {
  productNav?: ProductNavKey;
  ctaSurface?: CtaSurface;
  center?: ReactNode;
  actions?: ReactNode;
  shareRail?: boolean;
  wide?: boolean;
}) {
  return (
    <>
      <header className="sticky top-0 z-50 h-18 border-y border-slate-200/70 bg-slate-50/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80 [view-transition-name:site-header]">
        {/* gap-* guarantees breathing room between the left cluster and the CTA
            even when justify-between collapses to zero on a narrow phone (where
            Brand + the apps-menu dropdown + CTA otherwise sit flush). Mobile
            also trims the side padding to reclaim width, and the CTA is shrink-0
            so it never squishes. The dropdown drops its text label on mobile
            (see ProductNav) so the three never crowd. */}
        <div
          className={`mx-auto flex h-full items-center justify-between gap-2 px-4 sm:gap-4 ${
            wide ? 'max-w-7xl md:px-8' : 'max-w-6xl sm:px-6'
          }`}
        >
          <div className="flex shrink-0 items-center gap-2.5">
            <Brand href="/" size="md" />
            {productNav ? <ProductNav current={productNav} showOnMobile /> : null}
          </div>
          {center ? (
            <div className="hidden min-w-0 flex-1 justify-center sm:flex">
              <div className="w-full max-w-sm">{center}</div>
            </div>
          ) : null}
          <div className="flex shrink-0 items-center gap-2">
            {actions ?? <DefaultActions ctaSurface={ctaSurface} roomy={!center} />}
          </div>
        </div>
      </header>
      {/* The page-edge rail: sharing (unless `shareRail` is off) and, always, the Appearance toggle. */}
      <ShareRail share={shareRail} wide={wide} />
    </>
  );
}

// The default CTA pair. The Start Blank menu is hidden on mobile: Brand + dropdown + the
// primary already fill a narrow bar, and the wizard's own Skip covers the
// escape. `max-sm:hidden` (a variant, so it wins over the base inline-flex). Beside a centre slot (help's
// search) it waits for `md`, so the search box keeps room to read on a small tablet. Below 360px
// (a 320px phone) Brand + dropdown + "Choose Template" overran the bar by ~35px, so the primary
// drops "Choose " there; the aria-label keeps its full name.
function DefaultActions({ ctaSurface, roomy }: { ctaSurface?: CtaSurface; roomy: boolean }) {
  return (
    <>
      <StartBlankMenu
        ctaSurface={ctaSurface}
        className={roomy ? 'max-sm:hidden' : 'max-md:hidden'}
      />
      <a
        href={ctaSurface ? ctaHref('/new', `${ctaSurface}.Header`) : '/new'}
        aria-label="Choose Template"
        className={buttonClassName({ size: 'md', className: 'shrink-0 shadow-sm' })}
      >
        <ButtonContent>
          <span className="text-optical-line">
            <span className="max-[359px]:hidden">Choose </span>Template
          </span>
        </ButtonContent>
      </a>
    </>
  );
}
