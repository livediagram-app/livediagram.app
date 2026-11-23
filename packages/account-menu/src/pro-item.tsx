'use client';

import { ProBadge, useSubscription, useUpgrade } from '@liveworkspace/subscription-ui';
import { proOn } from '@liveworkspace/subscription-ui/flag';
import { ITEM, ItemBody } from './menu-item';

// The account menu's two marks of Pro (liveworkspace/docs/specs/019-subscription/subscription.md "What people see"),
// both absent with Pro off in the build. They read the page's SubscriptionProvider and ask the service nothing of
// their own: a page without one (an app's marketing page) shows no badge, and its item leads to the pricing page.

/** The solid badge beside the name, for someone who has Pro. */
export function AccountProBadge() {
  const load = useSubscription();
  if (load.status !== 'ready' || load.me.personal.tier === 'free') return null;
  return <ProBadge form="solid" size="sm" />;
}

/**
 * A quiet item for a signed-in person on Free: Upgrade to Pro, opening the page's upgrade dialog. Where the page has
 * no provider the menu cannot know their tier, so the item is See Pro and leads to the pricing page, which is right
 * for a subscriber too.
 */
export function ProItem({ close }: { close: () => void }) {
  const load = useSubscription();
  const upgrade = useUpgrade();
  if (!proOn()) return null;
  if (!upgrade.inPlace) {
    return (
      <a href={upgrade.pricingHref} role="menuitem" tabIndex={-1} className={ITEM}>
        <ItemBody icon={ProIcon} label="See Pro" hint="Compare Free, Pro and Pro for Teams" />
      </a>
    );
  }
  if (load.status !== 'ready' || load.me.personal.tier !== 'free') return null;
  const owner = load.me.personal.owner;
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-haspopup="dialog"
      onClick={() => {
        close();
        upgrade.openUpgrade({ owner });
      }}
      className={`${ITEM} cursor-pointer`}
    >
      <ItemBody icon={ProIcon} label="Upgrade to Pro" hint="Higher limits in every app" />
    </button>
  );
}

// An arrow rising in a ring: moving up a tier. Drawn as the menu's other glyphs are.
function ProIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16V8" />
      <path d="m8.5 11.5 3.5-3.5 3.5 3.5" />
    </svg>
  );
}
