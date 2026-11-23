'use client';

import { PageHero } from '@liveworkspace/marketing-site/components/PageHero';
import { buttonClassName, ButtonContent } from '@liveworkspace/ui';
import { SiteSubscription } from '@/components/subscription/SiteSubscription';
import { useSession } from '@/lib/session';
import { Footer } from '../Footer';
import { Header } from '../Header';
import { PricingComparison } from './PricingComparison';
import { PricingFreeFeatures } from './PricingFreeFeatures';
import { PricingHeroArt } from './PricingHeroArt';
import { PricingTiers } from './PricingTiers';

/**
 * The pricing page (liveworkspace/docs/specs/019-subscription/subscription.md "The pricing page"): an illustrated
 * hero holding the three tiers, then every limit side by side in a band of its own. The page's one read of the subscription
 * wraps the header too, so its account menu asks nothing again; a visitor's page asks for the prices alone.
 */
export function PricingPage() {
  const session = useSession();
  return (
    <SiteSubscription account={session.state}>
      <Header />
      <main>
        <PageHero
          eyebrow="Pricing"
          title={
            <>
              {/* Each sentence keeps to its own line where both will not fit on one. */}
              <span className="inline-block">Free for Everyone.</span>{' '}
              <span className="inline-block">Pro When You Need More.</span>
            </>
          }
          lede="Every app is free to use. Pro raises the limits for you, and Pro for Teams raises them for a shared library."
          art={<PricingHeroArt />}
          below={<PricingTiers account={session.state} />}
        >
          <div className="mt-7 flex justify-center lg:justify-start">
            <a
              href="#compare"
              className={buttonClassName({
                variant: 'secondary',
                size: 'cta',
                className: 'shadow-sm',
              })}
            >
              <ButtonContent>See Limits</ButtonContent>
            </a>
          </div>
        </PageHero>
        <div className="bg-slate-50/70 dark:bg-slate-900/40">
          <div className="mx-auto max-w-[70rem] px-4 pt-14 pb-20 sm:px-6 sm:pt-16 sm:pb-24">
            <PricingComparison account={session.state} />
            <PricingFreeFeatures />
          </div>
        </div>
      </main>
      <Footer />
    </SiteSubscription>
  );
}
