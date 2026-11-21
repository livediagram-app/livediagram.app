'use client';

// The screen's Connections tab (liveworkspace/docs/specs/018-automations/automations.md "Connections"; blueprint
// ui.md "The Connections tab"): the item's connections, listed and managed by the index's own list
// (@liveworkspace/settings-ui/connections), which fills the tab's panel and pins Add Connection at its foot. Reached
// from a message step's Add a Connection…, it says the rule is kept and offers the way back to it. Connections are
// an account's: a guest is told to sign in.

import { lazy, Suspense } from 'react';
import { Callout } from '@liveworkspace/ui/callout';
import { CompactEmptyState } from '@liveworkspace/ui';
import { BoltIcon } from './glyphs';
import type { AutomationsScope } from './kit';
import { useAutomationsKit, type KeptRule } from './kit-context';

// The list loads with the tab, the first time it opens: the screen's own chunk does not carry it. It draws its own
// loading state once here, so nothing stands in for the moment its code arrives.
const Connections = lazy(() =>
  import('@liveworkspace/settings-ui/connections').then((m) => ({ default: m.Connections })),
);

const LINK =
  'touch-target-y relative cursor-pointer rounded font-semibold text-brand-700 underline-offset-2 hover:text-brand-800 hover:underline dark:text-brand-300 dark:hover:text-brand-200';

export function ConnectionsTab({
  scope,
  signedIn,
  phone,
  kept,
  onBackToRule,
}: {
  scope: AutomationsScope;
  signedIn: boolean;
  phone: boolean;
  // The rule left for Add a Connection…, kept as it stood.
  kept: KeptRule | null;
  onBackToRule: () => void;
}) {
  const kit = useAutomationsKit();
  const signInHref = kit.connections.useSignInHref();
  if (!signedIn)
    return (
      <CompactEmptyState
        role="status"
        icon={<BoltIcon size={18} />}
        title="Sign In to See Connections"
        description="Connections belong to an account, so only someone signed in can add or pick one."
        action={
          <a href={signInHref} className={LINK}>
            Sign In
          </a>
        }
      />
    );
  return (
    <div data-automations-connections="" className="flex min-h-0 flex-1 flex-col">
      {kept ? (
        <Callout
          tone="info"
          size="md"
          role="status"
          className={`mt-3 ${phone ? 'mx-4' : 'mx-6'}`}
          action={{ label: 'Back to Rule', onSelect: onBackToRule }}
        >
          “{kept.body.name}” is kept as you left it, its unsaved changes too.
        </Callout>
      ) : null}
      <Suspense fallback={null}>
        <Connections
          client={kit.connections.client}
          itemId={scope.itemId}
          app={kit.connections.app}
          share={scope.shareCode ? { code: scope.shareCode } : null}
        />
      </Suspense>
    </div>
  );
}
