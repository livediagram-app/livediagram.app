import type { ReactNode } from 'react';
import { Brand } from './Brand';
import { buttonClassName } from './Button';
import { ProductNav, type ProductNavKey } from './ProductNav';
import { ShareRail } from './ShareRail';

// The public site header shared by the marketing landing page, the telemetry
// dashboard and the help centre so the three read as one product. Brand +
// apps-menu dropdown on the left, the CTA pair on the right (a secondary
// "Just Draw", straight to a blank canvas at /new?blank=1, spec/14, beside the
// primary "Choose Template", /new, the encouraged wizard path), with the
// ShareRail pinned to the page edge below. Cross-surface navigation (Help,
// Explorer, Telemetry, ...) lives in the apps menu, so the header itself
// carries just those CTAs.
//
// `productNav` is the current section key for the apps-menu dropdown next to
// the logo (the landing page passes 'home', which reads as "Welcome").
// `center` is an optional slot between the two clusters, shown from `sm` up
// (the help centre's search box). `actions` replaces the default CTA pair
// (help keeps its single "Start drawing"). `shareRail` (default true) mounts
// the page-edge ShareRail; help leaves it off.
//
// The bar has a fixed height (h-18, 72px) rather than padding around its
// content, so a surface that sticks something under it (help's breadcrumb
// bar, `top-18`) can rely on the number at every breakpoint.
export function SiteHeader({
  productNav,
  center,
  actions,
  shareRail = true,
}: {
  productNav?: ProductNavKey;
  center?: ReactNode;
  actions?: ReactNode;
  shareRail?: boolean;
}) {
  return (
    <>
      <header className="sticky top-0 z-50 h-18 border-y border-slate-200/70 bg-slate-50/80 backdrop-blur">
        {/* gap-* guarantees breathing room between the left cluster and the CTA
            even when justify-between collapses to zero on a narrow phone (where
            Brand + the apps-menu dropdown + CTA otherwise sit flush). Mobile
            also trims the side padding to reclaim width, and the CTA is shrink-0
            so it never squishes. The dropdown drops its text label on mobile
            (see ProductNav) so the three never crowd. */}
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
          <div className="flex shrink-0 items-center gap-2.5">
            <Brand href="/" size="md" />
            {productNav ? <ProductNav current={productNav} showOnMobile /> : null}
          </div>
          {center ? (
            <div className="hidden min-w-0 flex-1 justify-center sm:flex">
              <div className="w-full max-w-sm">{center}</div>
            </div>
          ) : null}
          <div className="flex shrink-0 items-center gap-2">{actions ?? <DefaultActions />}</div>
        </div>
      </header>
      {shareRail ? <ShareRail /> : null}
    </>
  );
}

// The default CTA pair. Just Draw is hidden on mobile: Brand + dropdown + the
// primary already fill a narrow bar, and the wizard's own Skip covers the
// escape. `max-sm:hidden` (a variant, so it wins over the base inline-flex).
function DefaultActions() {
  return (
    <>
      <a
        href="/new?blank=1"
        className={buttonClassName({
          variant: 'secondary',
          size: 'md',
          className: 'shrink-0 shadow-sm max-sm:hidden',
        })}
      >
        Just Draw
      </a>
      <a href="/new" className={buttonClassName({ size: 'md', className: 'shrink-0 shadow-sm' })}>
        Choose Template
      </a>
    </>
  );
}
