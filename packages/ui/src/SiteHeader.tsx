import { Brand } from './Brand';
import { ProductNav, type ProductNavKey } from './ProductNav';
import { ShareRail } from './ShareRail';

// The public site header shared by the marketing landing page and the
// telemetry dashboard so the two read as one product. Brand + apps-menu
// dropdown on the left, the CTA pair on the right — a secondary "Just
// Draw" (straight to a blank canvas, /new?blank=1, spec/14) beside the
// primary "Choose Template" (/new, the encouraged wizard path) — with the
// ShareRail pinned to the page edge below. Cross-surface navigation (Help,
// Explorer, Telemetry, ...) lives in the apps menu, so the header itself
// carries just those CTAs.
//
// `productNav` is the current section key for the apps-menu dropdown next to
// the logo (the landing page passes 'home', which reads as "Welcome").
export function SiteHeader({ productNav }: { productNav?: ProductNavKey }) {
  return (
    <>
      <header className="sticky top-0 z-50 border-y border-slate-200/70 bg-slate-50/80 backdrop-blur">
        {/* gap-* guarantees breathing room between the left cluster and the CTA
            even when justify-between collapses to zero on a narrow phone (where
            Brand + the apps-menu dropdown + CTA otherwise sit flush). Mobile
            also trims the side padding to reclaim width, and the CTA is shrink-0
            so it never squishes. The dropdown drops its text label on mobile
            (see ProductNav) so the three never crowd. */}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:gap-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Brand href="/" size="md" />
            {productNav ? <ProductNav current={productNav} showOnMobile /> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Hidden on mobile: Brand + dropdown + the primary already fill
                a narrow bar, and the wizard's own Skip covers the escape. */}
            <a
              href="/new?blank=1"
              className="hidden shrink-0 items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 sm:inline-flex"
            >
              Just Draw
            </a>
            <a
              href="/new"
              className="inline-flex shrink-0 items-center rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              Choose Template
            </a>
          </div>
        </div>
      </header>
      <ShareRail />
    </>
  );
}
