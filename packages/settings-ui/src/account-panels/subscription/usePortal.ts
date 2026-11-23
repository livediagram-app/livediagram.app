'use client';

import { useCallback, useState } from 'react';
import type { OwnerScope } from '@liveworkspace/subscription';
import { billingErrorMessage, useBilling } from '@liveworkspace/subscription-ui';

/**
 * Opening the billing portal from a Subscription cell (Manage Billing, Update Payment, Keep Pro): which owner's is on
 * its way, and what the service said when it refused. The button stays busy until the page goes.
 */
export function usePortal(): {
  open: (owner: OwnerScope) => void;
  opening: OwnerScope | null;
  error: string | null;
} {
  const billing = useBilling();
  const [opening, setOpening] = useState<OwnerScope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = useCallback(
    (owner: OwnerScope) => {
      if (!billing) return;
      setOpening(owner);
      setError(null);
      billing.portal(owner).catch((failure: unknown) => {
        setOpening(null);
        setError(billingErrorMessage(failure));
      });
    },
    [billing],
  );
  return { open, opening, error };
}
