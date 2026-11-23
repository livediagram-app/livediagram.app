'use client';

import { useEffect, useState } from 'react';
import { lucideArrowLeft } from '@liveworkspace/icons/lucide';
import type { MockPortal, MockPortalRequest } from '@liveworkspace/subscription';
import { Button, buttonClassName, ButtonContent, lucideGlyph } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { useLocationSearch } from '@/lib/location-search';
import { BillingLoading, BillingMessage, BillingShell } from './BillingShell';
import { BillingSubscription } from './BillingSubscription';
import { BillingTestControls } from './BillingTestControls';
import { actionDone, actionRefused, type ActionSaid } from './billing-copy';
import { isGone, mockBilling, sessionFrom } from './mock-client';

const BackIcon = lucideGlyph(lucideArrowLeft, 14);

type Load =
  | { kind: 'loading' }
  | { kind: 'gone' }
  | { kind: 'error' }
  | { kind: 'ready'; portal: MockPortal };

/**
 * The mock billing portal (subscription.md "Billing", Manage Billing): the subscription and its state, Cancel
 * Subscription and Resume, a team's seats, and, set apart, the Test Controls that stand in for what the payment
 * provider will report (a failed renewal, a recovered payment, grace running out, the period ending, a renewal, a
 * change of seats). Every action answers with the subscription as it now stands, and the page draws that.
 */
export function MockBillingPage() {
  const session = sessionFrom(useLocationSearch());
  const [loaded, setLoaded] = useState<Load>({ kind: 'loading' });
  const [acting, setActing] = useState<MockPortalRequest['action'] | null>(null);
  // What the last action did, read out as a status; or that it failed.
  const [said, setSaid] = useState<ActionSaid | { tone: 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!session) return;
    let live = true;
    mockBilling.mockPortal(session).then(
      (portal) => live && setLoaded({ kind: 'ready', portal }),
      (error: unknown) => live && setLoaded({ kind: isGone(error) ? 'gone' : 'error' }),
    );
    return () => {
      live = false;
    };
  }, [session]);

  const load: Load = session ? loaded : { kind: 'gone' };

  const act = (request: MockPortalRequest) => {
    if (!session) return;
    setActing(request.action);
    setSaid(null);
    mockBilling.actOnMockPortal(session, request).then(
      (portal) => {
        setLoaded({ kind: 'ready', portal });
        setSaid(actionDone(request.action, portal));
        setActing(null);
      },
      (error: unknown) => {
        setSaid({ tone: 'error', text: actionRefused(error) });
        setActing(null);
      },
    );
  };

  return (
    <BillingShell>
      {load.kind === 'loading' ? (
        <BillingLoading label="Opening billing…" />
      ) : load.kind === 'gone' ? (
        <BillingMessage
          title="This Billing Link Has Closed"
          action={
            <a href="/" className={buttonClassName({ size: 'md' })}>
              <ButtonContent>Go to the Home Page</ButtonContent>
            </a>
          }
        >
          A billing link works for a short while. Open Manage Billing again from Settings, under
          Subscription.
        </BillingMessage>
      ) : load.kind === 'error' ? (
        <BillingMessage
          title="Couldn’t Open Billing"
          action={
            <Button size="md" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          }
        >
          Check your connection and try again. Nothing was changed.
        </BillingMessage>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Billing
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {load.portal.ownerName}
                {load.portal.members === null ? ', personal library' : ', team library'}
              </p>
            </div>
            <a
              href={load.portal.returnTo}
              className={buttonClassName({ variant: 'secondary', size: 'md' })}
            >
              <BackIcon aria-hidden />
              <ButtonContent>Back</ButtonContent>
            </a>
          </div>
          {said ? (
            <Callout tone={said.tone} size="md" role={said.tone === 'error' ? 'alert' : 'status'}>
              {said.text}
            </Callout>
          ) : null}
          <BillingSubscription portal={load.portal} acting={acting} onAct={act} />
          <BillingTestControls portal={load.portal} acting={acting} onAct={act} />
        </div>
      )}
    </BillingShell>
  );
}
