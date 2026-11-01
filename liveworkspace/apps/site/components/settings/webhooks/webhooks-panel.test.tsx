// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WEBHOOK_EVENTS, type Webhook, type WebhookDelivery } from '@liveworkspace/index-client';
import { WebhooksPanel } from './WebhooksPanel';
import { testDeliveryOf, READ_AT } from './useSendTest';
import { deliveryLine, eventName, failureOf, stateOf, webhookError, whenOf } from './webhooks-api';

vi.mock('@/lib/explorer/token', () => ({ workspaceToken: async () => 'tok' }));

// Settings › Webhooks (liveworkspace/docs/specs/010-site/site.md "Settings", Webhooks; liveworkspace/docs/specs/004-index/
// webhooks.md): the card's head, the list, adding one step by step for your own items or a team you run (a plain
// one's secret shown once), Send Test with its result read back, Pause and Resume, Delete asked in a popover, and
// each one's Recent Deliveries.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HOOK: Webhook = {
  id: 'w1',
  name: 'Launch channel',
  kind: 'slack',
  teamId: 'teamA',
  host: 'hooks.slack.com',
  events: ['created', 'card_moved'],
  createdAt: 1_790_000_000_000,
  pausedAt: null,
  pausedReason: null,
  lastDelivery: { state: 'delivered', status: 200, at: 1_790_000_000_000 },
};
const DELIVERY: WebhookDelivery = {
  id: 1,
  type: 'card_moved',
  title: 'Sprint 4',
  state: 'failed',
  attempts: 3,
  status: 500,
  error: null,
  occurredAt: 1_790_000_000_000,
  lastAttemptAt: 1_790_000_100_000,
  nextAttemptAt: null,
};

type Call = { url: string; method: string; body: unknown; auth: string | null };
let calls: Call[];
let webhooks: Webhook[];
let deliveries: () => WebhookDelivery[];
let answer: (call: Call) => Response | null;

const json = (status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  calls = [];
  webhooks = [HOOK];
  deliveries = () => [DELIVERY];
  answer = () => null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      const headers = new Headers(init?.headers);
      const call: Call = {
        url,
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(init.body as string) : null,
        auth: headers.get('authorization'),
      };
      calls.push(call);
      const special = answer(call);
      if (special) return special;
      if (url === '/api/account/teams')
        return json(200, {
          teams: [
            { id: 'teamA', name: 'Design', role: 'admin' },
            { id: 'teamB', name: 'Sales', role: 'member' },
          ],
        });
      if (url.endsWith('/webhooks') && call.method === 'GET') return json(200, { webhooks });
      if (url.endsWith('/webhooks') && call.method === 'POST') {
        const made: Webhook = {
          ...HOOK,
          id: 'w2',
          kind: 'json',
          name: 'Mine',
          teamId: null,
          lastDelivery: null,
        };
        webhooks = [...webhooks, made];
        return json(201, { webhook: made, secret: 'whsec_abc' });
      }
      if (url.endsWith('/deliveries')) return json(200, { deliveries: deliveries() });
      if (url.endsWith('/test')) return json(202, { queued: true });
      if (call.method === 'PATCH') {
        const paused = (call.body as { paused: boolean }).paused;
        return json(200, {
          webhook: { ...HOOK, pausedAt: paused ? 1 : null, pausedReason: paused ? 'paused' : null },
        });
      }
      if (call.method === 'DELETE') {
        webhooks = [];
        return json(204, null);
      }
      return json(404, { error: 'not_found' });
    }),
  );
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// A tick, on the fake clock where a test runs one.
const settle = () =>
  act(async () =>
    vi.isFakeTimers()
      ? void (await vi.advanceTimersByTimeAsync(0))
      : new Promise((r) => setTimeout(r, 0)),
  );
const button = (name: string, within: ParentNode = container) =>
  [...within.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === name || b.getAttribute('aria-label') === name,
  )!;
const press = async (name: string, within: ParentNode = container) => {
  const b = button(name, within);
  b.focus();
  await act(async () => b.click());
  await settle();
};
const type = (input: HTMLInputElement, value: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
// A tile or row by its words: the native radio or checkbox under it.
const choice = (words: string) =>
  [...container.querySelectorAll('label')]
    .find(
      (l) =>
        l.querySelector('input[type=radio],input[type=checkbox]') && l.textContent?.includes(words),
    )!
    .querySelector('input')!;
const field = (label: string) =>
  [...container.querySelectorAll('label')]
    .find((l) => l.firstChild?.textContent === label)!
    .querySelector('input')!;
const render = async () => {
  act(() => root.render(<WebhooksPanel />));
  await settle();
};
const row = (id = 'w1') => container.querySelector(`[data-webhook="${id}"]`)!;

describe('Settings › Webhooks', () => {
  it('says what a webhook is and which apps it covers, by their logos', async () => {
    await render();
    const head = container.querySelector('h4')!;
    expect(head.textContent).toBe('Post Updates Where Your Team Talks');
    const panel = container.querySelector('[data-webhooks-panel]')!;
    const apps = [...panel.querySelectorAll('p, div')].find(
      (el) => el.firstElementChild?.textContent === 'For your work in',
    )!;
    // Each app by its logo: its mark and its wordmark, never the name alone.
    const logos = [...apps.lastElementChild!.children];
    expect(logos).toHaveLength(4);
    ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'].forEach((app, i) =>
      expect(logos[i]!.textContent).toContain(app),
    );
    for (const logo of logos) expect(logo.querySelector('svg')).not.toBeNull();
  });

  it('lists each webhook with its kind, state, whose items, host, last delivery and events, asking as the person', async () => {
    await render();
    expect(row().textContent).toContain('Launch channel');
    expect(row().textContent).toContain('Slack · Design’s items');
    expect(row().querySelector('[data-state="live"]')?.textContent).toBe('Active');
    expect(row().textContent).toContain('hooks.slack.com');
    expect(row().textContent).toMatch(/Delivered \d+ \w{3}/);
    const sends = row().querySelector('[aria-label="What it sends"]')!;
    expect(sends.textContent).toContain('Item Created');
    expect(sends.textContent).toContain('Card Moved');
    expect(sends.textContent).toContain('liveplanner');
    expect(calls.find((c) => c.url === '/api/index/webhooks')?.auth).toBe('Bearer tok');
  });

  it('says Every Event, Nothing sent yet, and a self-paused one needs attention with why', async () => {
    webhooks = [
      {
        ...HOOK,
        events: [...WEBHOOK_EVENTS],
        teamId: null,
        lastDelivery: null,
        pausedAt: 1,
        pausedReason: 'failing',
      },
    ];
    await render();
    expect(row().textContent).toContain('Every Event');
    expect(row().textContent).toContain('Slack · Your own items');
    expect(row().textContent).toContain('Nothing sent yet');
    expect(row().querySelector('[data-state="warn"]')?.textContent).toBe('Needs Attention');
    expect(row().textContent).toContain('20 deliveries in a row failed');
    await press('Resume', row());
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ paused: false });
    expect(row().querySelector('[data-state="live"]')).not.toBeNull();
  });

  it('shows an empty state with Add Webhook when there are none, and the form takes the keyboard', async () => {
    webhooks = [];
    await render();
    expect(container.querySelector('[data-empty-state]')?.textContent).toContain('No Webhooks Yet');
    await press('Add Webhook');
    expect(document.activeElement).toBe(choice('Slack'));
    expect((document.activeElement as HTMLInputElement).checked).toBe(true);
    await press('Cancel');
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('[data-empty-state]')).not.toBeNull();
  });

  it('adds one step by step, offering only the teams the person runs, and shows its secret once', async () => {
    await render();
    await press('Add Webhook');
    const form = container.querySelector('form')!;
    // Whose items: their own, and Design (run by them), never Sales (only a member).
    const scopes = [...form.querySelectorAll<HTMLInputElement>('input[name="webhook-scope"]')];
    expect(scopes.map((r) => r.closest('label')!.textContent)).toEqual([
      expect.stringContaining('Your Own Items'),
      expect.stringContaining('Design'),
    ]);
    // Each destination brings its own field and how to get the address.
    act(() => choice('Microsoft Teams').click());
    expect(field('Teams Workflow URL')).toBeTruthy();
    expect(form.textContent).toContain('Workflows');
    act(() => choice('Your Own Service').click());
    expect(field('HTTPS Address')).toBeTruthy();
    const submit = button('Add Webhook', form);
    expect(submit.disabled).toBe(true);
    expect(form.textContent).toContain('Add a name to finish.');
    type(field('Name'), 'Mine');
    expect(form.textContent).toContain('Add an address to finish.');
    type(field('HTTPS Address'), 'https://hooks.example.com/in');
    act(() => choice('Design').click());
    // What it sends: every event to begin with; Clear, Select All and one unticked.
    expect(form.textContent).toContain('9 of 9');
    expect(button('Select All', form).disabled).toBe(true);
    await press('Clear', form);
    expect(form.textContent).toContain('0 of 9');
    expect(form.textContent).toContain('Pick at least one thing to send.');
    expect(submit.disabled).toBe(true);
    await press('Select All', form);
    act(() => choice('Item Created').click());
    expect(form.textContent).toContain('8 of 9');
    expect(submit.disabled).toBe(false);
    await press('Add Webhook', form);
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/webhooks'))!;
    expect(post.body).toMatchObject({
      name: 'Mine',
      kind: 'json',
      url: 'https://hooks.example.com/in',
      teamId: 'teamA',
    });
    expect((post.body as { events: string[] }).events).not.toContain('created');
    expect((post.body as { events: string[] }).events).toHaveLength(8);
    expect(container.textContent).toContain('whsec_abc');
    await press('Done');
    expect(container.textContent).not.toContain('whsec_abc');
    expect(document.activeElement?.textContent).toBe('Post Updates Where Your Team Talks');
    expect(container.querySelectorAll('[data-webhook]')).toHaveLength(2);
    // The new one invites a test.
    expect(row('w2').textContent).toContain('Added. Send a test to check it reaches your service.');
  });

  it('isolates each name (<bdi>), so a right-to-left or overriding one never turns the words around it', async () => {
    webhooks = [{ ...HOOK, name: '\u202Eevil' }];
    await render();
    expect(row().querySelector('h5 > bdi')?.textContent).toBe('\u202Eevil');
    await press('Add Webhook');
    type(field('Slack Webhook URL'), 'https://hooks.slack.com/services/T/B/x');
    type(field('Name'), 'Mine');
    await press('Add Webhook', container.querySelector('form')!);
    expect(container.querySelector('[role=status] bdi')?.textContent).toBe('Mine');
  });

  it('says what was wrong with the address, by where it sends', async () => {
    answer = (c) => (c.method === 'POST' ? json(400, { error: 'webhook_url_invalid' }) : null);
    await render();
    await press('Add Webhook');
    type(field('Slack Webhook URL'), 'https://example.com');
    type(field('Name'), 'x');
    await press('Add Webhook', container.querySelector('form')!);
    expect(container.querySelector('[role=alert]')?.textContent).toContain(
      'hooks.slack.com/services',
    );
  });

  it('reads recent deliveries only when opened, in words, and says when there are none', async () => {
    await render();
    expect(calls.some((c) => c.url.endsWith('/deliveries'))).toBe(false);
    const toggle = button('Recent Deliveries', row());
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await press('Recent Deliveries', row());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const item = row().querySelector('[data-delivery="failed"]')!;
    expect(item.textContent).toContain('Card Moved');
    expect(item.textContent).toContain('Sprint 4');
    expect(item.textContent).toContain('Failed: answered 500 · 3 tries');
    await press('Recent Deliveries', row());
    deliveries = () => [];
    await press('Recent Deliveries', row());
    expect(row().textContent).toContain('No Deliveries Yet');
  });

  describe('Send Test', () => {
    const ping = (over: Partial<WebhookDelivery>): WebhookDelivery => ({
      ...DELIVERY,
      id: 9,
      type: 'ping',
      title: 'Test',
      occurredAt: Date.now(),
      ...over,
    });
    const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

    it('reads the deliveries back until the test arrives, and says so in the channel’s words', async () => {
      vi.useFakeTimers();
      let reads = 0;
      deliveries = () => (++reads < 2 ? [DELIVERY] : [ping({ state: 'delivered', status: 200 })]);
      await render();
      await wait(0);
      await press('Send Test', row());
      await wait(0);
      expect(calls.some((c) => c.url === '/api/index/webhooks/w1/test')).toBe(true);
      expect(row().querySelector('[role=status]')?.textContent).toBe('Sending a test…');
      expect(button('Send Test', row()).disabled).toBe(true);
      await wait(READ_AT[0]);
      expect(reads).toBe(1);
      expect(row().querySelector('[role=status]')?.textContent).toBe('Sending a test…');
      await wait(READ_AT[1] - READ_AT[0]);
      expect(reads).toBe(2);
      expect(row().querySelector('[role=status]')?.textContent).toBe(
        'Test delivered. Look for it in your Slack channel.',
      );
      await wait(60_000);
      expect(reads).toBe(2);
    });

    it('says why a test failed, and that one still waiting is queued', async () => {
      vi.useFakeTimers();
      deliveries = () => [ping({ state: 'failed', status: 404 })];
      await render();
      await wait(0);
      await press('Send Test', row());
      await wait(READ_AT[0]);
      expect(row().querySelector('[role=status]')?.textContent).toContain(
        'The test didn’t arrive: answered 404.',
      );
      // Nothing back after every read: queued.
      deliveries = () => [ping({ state: 'pending', attempts: 0 })];
      await press('Send Test', row());
      await wait(READ_AT.at(-1)!);
      expect(row().querySelector('[role=status]')?.textContent).toBe(
        'Test queued. It shows in Recent Deliveries once it’s sent.',
      );
      expect(calls.filter((c) => c.url.endsWith('/deliveries'))).toHaveLength(1 + READ_AT.length);
    });

    it('stops reading once the row is gone', async () => {
      vi.useFakeTimers();
      deliveries = () => [];
      await render();
      await wait(0);
      await press('Send Test', row());
      act(() => root.unmount());
      root = createRoot(container);
      await wait(30_000);
      expect(calls.some((c) => c.url.endsWith('/deliveries'))).toBe(false);
    });

    it('says why a test was refused', async () => {
      answer = (c) => (c.url.endsWith('/test') ? json(409, { error: 'webhook_paused' }) : null);
      await render();
      await press('Send Test', row());
      expect(row().querySelector('[role=alert]')?.textContent).toContain('Resume it');
    });
  });

  it('pauses and resumes from its icon button, a paused one saying nothing is sent', async () => {
    await render();
    await press('Pause Webhook', row());
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ paused: true });
    expect(row().querySelector('[data-state="paused"]')?.textContent).toBe('Paused');
    expect(row().textContent).toContain('Paused. Nothing is sent until you resume it.');
    expect(button('Send Test', row()).disabled).toBe(true);
    await press('Resume Webhook', row());
    expect(calls.filter((c) => c.method === 'PATCH').at(-1)?.body).toEqual({ paused: false });
    expect(button('Pause Webhook', row())).toBeTruthy();
  });

  it('deletes after asking in a popover, and keeps it on Cancel', async () => {
    await render();
    await press('Delete Webhook', row());
    const popover = document.querySelector('[data-confirm-popover]')!;
    expect(popover.textContent).toContain('Delete “Launch channel”?');
    expect(document.activeElement).toBe(button('Delete', popover));
    await press('Cancel', popover);
    expect(document.querySelector('[data-confirm-popover]')).toBeNull();
    expect(document.activeElement).toBe(button('Delete Webhook', row()));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    await press('Delete Webhook', row());
    await press('Delete', document.querySelector('[data-confirm-popover]')!);
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
    expect(container.querySelector('[data-empty-state]')).not.toBeNull();
  });

  it('shows a refused list in words, with Try Again', async () => {
    answer = (c) =>
      c.url.endsWith('/webhooks') ? json(403, { error: 'webhooks_need_account' }) : null;
    await render();
    expect(container.querySelector('[role=alert]')?.textContent).toContain(
      'Sign in to your account',
    );
    answer = () => null;
    await press('Try Again');
    await settle();
    expect(row()).not.toBeNull();
  });
});

describe('words', () => {
  it('names each state, failure and delivery', () => {
    expect(stateOf(HOOK)).toEqual({ label: 'Active', tone: 'live' });
    expect(stateOf({ ...HOOK, pausedAt: 1, pausedReason: null })).toEqual({
      label: 'Paused',
      tone: 'paused',
    });
    expect(stateOf({ ...HOOK, pausedAt: 1, pausedReason: 'creator_left' })).toMatchObject({
      label: 'Needs Attention',
      tone: 'warn',
      note: expect.stringContaining('no longer runs the team'),
    });
    expect(stateOf({ ...HOOK, pausedAt: 1, pausedReason: 'gone' }).note).toContain(
      'add the webhook again',
    );
    expect(failureOf({ status: null, error: null })).toBeNull();
    expect(failureOf({ status: 502, error: 'network' })).toBe('answered 502, couldn’t connect');
    expect(failureOf({ status: null, error: 'brand_new' })).toBe('brand_new');
    expect(deliveryLine({ ...DELIVERY, state: 'delivered', status: 204 })).toBe('Delivered (204)');
    expect(deliveryLine({ ...DELIVERY, state: 'delivered', status: null })).toBe('Delivered');
    expect(deliveryLine({ ...DELIVERY, status: null, error: 'timeout' })).toBe(
      'Failed: no answer in 10 seconds',
    );
    expect(deliveryLine({ ...DELIVERY, status: null })).toBe('Failed');
    expect(deliveryLine({ ...DELIVERY, state: 'pending', attempts: 0 })).toBe('Waiting to send');
    expect(deliveryLine({ ...DELIVERY, state: 'pending', status: 503 })).toBe(
      'Retrying after it answered 503',
    );
    expect(deliveryLine({ ...DELIVERY, state: 'pending', status: null })).toBe('Retrying');
    expect(eventName('ping')).toBe('Test');
    expect(eventName('card_moved')).toBe('Card Moved');
    expect(webhookError('something_new')).toMatch(/Something went wrong/);
    expect(webhookError('webhook_url_invalid', 'teams')).toContain('logic.azure.com');
    expect(webhookError('offline')).toBe('Couldn’t connect. Check your connection and try again.');
  });

  it('says when, relatively within a week and by date past it', () => {
    const now = Date.UTC(2026, 9, 30, 12);
    expect(whenOf(now - 2 * 3_600_000, now)).toMatch(/2 hours ago|2h/);
    expect(whenOf(now - 10 * 86_400_000, now)).toBe('20 Oct');
    expect(whenOf(now + 60_000, now)).toBe('30 Oct');
  });

  it('finds the test this row sent, never an older one', () => {
    const sentAt = 1_000_000_000;
    const old = { ...DELIVERY, type: 'ping' as const, occurredAt: sentAt - 120_000 };
    const mine = { ...old, id: 2, occurredAt: sentAt + 10 };
    expect(testDeliveryOf([DELIVERY, old], sentAt)).toBeNull();
    expect(testDeliveryOf([mine, old], sentAt)).toBe(mine);
  });
});
