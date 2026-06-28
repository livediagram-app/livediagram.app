import { Brand } from './Brand';
import { ProductNav, type ProductNavKey } from './ProductNav';
import { ShareRail } from './ShareRail';

// The public site header shared by the marketing landing page and the
// telemetry dashboard so the two read as one product. Brand + apps-menu
// dropdown on the left, the "Start drawing" CTA on the right, with the
// ShareRail pinned to the page edge below. Cross-surface navigation (Help,
// Explorer, Telemetry, ...) lives in the apps menu, so the header itself
// carries just the one primary CTA.
//
// `productNav` is the current section key for the apps-menu dropdown next to
// the logo (the landing page passes 'home', which reads as "Welcome").
export function SiteHeader({ productNav }: { productNav?: ProductNavKey }) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-slate-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Brand href="/" size="md" />
            {productNav ? <ProductNav current={productNav} showOnMobile /> : null}
          </div>
          <a
            href="/new"
            className="inline-flex items-center rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Start drawing
          </a>
        </div>
      </header>
      <ShareRail />
    </>
  );
}
