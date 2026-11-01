'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebhookDelivery } from '@liveworkspace/index-client';
import { attempt, webhooksClient } from './webhooks-api';

// Send Test's result, shown on the webhook's row (liveworkspace/docs/specs/010-site/site.md "Settings", Webhooks). The
// index queues a test as it would an event and answers 202 at once, so the row reads the webhook's deliveries back a
// few times, at most READ_AT.length reads over about 20 seconds, until the test's own delivery has an outcome: sent
// and answered, or failed and why. Still waiting after the last read, it says the test is queued. Nothing is read
// once the row is gone.

export type TestResult =
  | { state: 'sending' }
  | { state: 'delivered'; status: number | null }
  | { state: 'failed'; delivery: WebhookDelivery }
  | { state: 'queued' }
  | { state: 'refused'; error: string };

// When each read happens, in ms after the test was queued.
export const READ_AT = [1_500, 4_000, 9_000, 20_000] as const;
// A test delivery counts as this one's if it was queued no earlier than this before Send Test was pressed (the
// index's clock and this browser's can differ by a little).
const CLOCK_SLACK_MS = 60_000;

/** The test this row sent: the newest test delivery queued since it was pressed. */
export function testDeliveryOf(
  deliveries: readonly WebhookDelivery[],
  sentAt: number,
): WebhookDelivery | null {
  return (
    deliveries.find((d) => d.type === 'ping' && d.occurredAt >= sentAt - CLOCK_SLACK_MS) ?? null
  );
}

export function useSendTest(
  webhookId: string,
  // Every list read on the way, so an open Recent Deliveries shows the test too.
  onRead: (deliveries: WebhookDelivery[]) => void,
) {
  const [result, setResult] = useState<TestResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped by each send and on unmount, so a read that lands late is dropped.
  const run = useRef(0);
  const onReadRef = useRef(onRead);
  useEffect(() => {
    onReadRef.current = onRead;
  });

  useEffect(
    () => () => {
      run.current += 1;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const send = useCallback(async () => {
    const mine = ++run.current;
    if (timer.current) clearTimeout(timer.current);
    setResult({ state: 'sending' });
    const sentAt = Date.now();
    const queued = await attempt(() => webhooksClient.testWebhook(webhookId));
    if (mine !== run.current) return;
    if (!queued.ok) {
      setResult({ state: 'refused', error: queued.error });
      return;
    }
    const read = async (n: number) => {
      const listed = await attempt(() => webhooksClient.webhookDeliveries(webhookId));
      if (mine !== run.current) return;
      const test = listed.ok ? testDeliveryOf(listed.data.deliveries, sentAt) : null;
      if (listed.ok) onReadRef.current(listed.data.deliveries);
      if (test?.state === 'delivered') setResult({ state: 'delivered', status: test.status });
      else if (test?.state === 'failed') setResult({ state: 'failed', delivery: test });
      else if (n + 1 < READ_AT.length) schedule(n + 1);
      else setResult({ state: 'queued' });
    };
    const schedule = (n: number) => {
      const wait = READ_AT[n]! - (Date.now() - sentAt);
      timer.current = setTimeout(() => void read(n), Math.max(0, wait));
    };
    schedule(0);
  }, [webhookId]);

  const clear = useCallback(() => {
    run.current += 1;
    if (timer.current) clearTimeout(timer.current);
    setResult(null);
  }, []);

  return { result, send, clear };
}
