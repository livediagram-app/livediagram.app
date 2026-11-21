// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IndexError,
  WEBHOOKS_PER_DOCUMENT_MAX,
  type App,
  type IndexClient,
  type Webhook,
  type WebhookDelivery,
} from '@liveworkspace/index-client';
import { Connections, ConnectionsDialog } from './index';
import { testDeliveryOf, READ_AT } from './useSendTest';
import {
  deliveryLine,
  deliveryName,
  documentWebhooksApi,
  failureOf,
  stateOf,
  webhookError,
  whenOf,
} from './connections-api';

// An item's Connections list (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"): the list, adding one
// step by step (where it posts, its address, a name: no events, no Who Did It), your own service's secret shown once,
// Send Test with its result read back, Pause and Resume, Delete asked in a popover, each one's Recent Deliveries, the
// limit and the refusals.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ITEM_ID = 'item-1';
const SHARE = { code: 'abc123' };

const HOOK: Webhook = {
  id: 'w1',
  itemId: ITEM_ID,
  app: 'livediagram',
  name: 'Launch channel',
  kind: 'slack',
  host: 'hooks.slack.com',
  mine: true,
  createdAt: 1_790_000_000_000,
  pausedAt: null,
  pausedReason: null,
  lastDelivery: { state: 'delivered', status: 200, at: 1_790_000_000_000 },
};
const DELIVERY: WebhookDelivery = {
  id: 1,
  type: 'automation',
  app: 'livediagram',
  title: 'Roadmap',
  state: 'failed',
  attempts: 3,
  status: 500,
  error: null,
  occurredAt: 1_790_000_000_000,
  lastAttemptAt: 1_790_000_100_000,
  nextAttemptAt: null,
};

type Call = { method: string; args: unknown[] };
let calls: Call[];
let webhooks: Webhook[];
let deliveries: () => WebhookDelivery[];
// A refusal for a method, by its name, or nothing.
let refuse: (method: string) => string | null;

const fail = (code: string) => Promise.reject(new IndexError(403, code));

function fakeClient(): IndexClient {
  const record = (method: string, args: unknown[]) => {
    calls.push({ method, args });
    return refuse(method);
  };
  return {
    listWebhooks: (...args: unknown[]) => {
      const refused = record('listWebhooks', args);
      return refused ? fail(refused) : Promise.resolve({ webhooks });
    },
    createWebhook: (...args: unknown[]) => {
      const refused = record('createWebhook', args);
      if (refused) return fail(refused);
      const input = args[1] as { name: string; kind: Webhook['kind'] };
      const made: Webhook = {
        ...HOOK,
        id: 'w2',
        name: input.name,
        kind: input.kind,
        lastDelivery: null,
      };
      webhooks = [...webhooks, made];
      return Promise.resolve({ webhook: made, secret: input.kind === 'json' ? 'whsec_abc' : null });
    },
    updateWebhook: (...args: unknown[]) => {
      const refused = record('updateWebhook', args);
      if (refused) return fail(refused);
      const [id, input] = args as [string, { paused?: boolean }];
      const was = webhooks.find((w) => w.id === id) ?? HOOK;
      const next: Webhook = {
        ...was,
        ...(input.paused === undefined
          ? {}
          : { pausedAt: input.paused ? 1 : null, pausedReason: input.paused ? 'paused' : null }),
      };
      webhooks = webhooks.map((w) => (w.id === id ? next : w));
      return Promise.resolve({ webhook: next });
    },
    deleteWebhook: (...args: unknown[]) => {
      const refused = record('deleteWebhook', args);
      if (refused) return fail(refused);
      webhooks = webhooks.filter((w) => w.id !== args[0]);
      return Promise.resolve();
    },
    testWebhook: (...args: unknown[]) => {
      const refused = record('testWebhook', args);
      return refused
        ? Promise.reject(new IndexError(409, refused))
        : Promise.resolve({ queued: true });
    },
    webhookDeliveries: (...args: unknown[]) => {
      const refused = record('webhookDeliveries', args);
      return refused ? fail(refused) : Promise.resolve({ deliveries: deliveries() });
    },
  } as unknown as IndexClient;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  calls = [];
  webhooks = [HOOK];
  deliveries = () => [DELIVERY];
  refuse = () => null;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
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
const press = async (name: string, within: ParentNode = document.body) => {
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
// A destination by its words: the native radio under its card.
// Add Connection opens in a popover on the page's body, so the helpers look there.
const choice = (words: string, within: ParentNode = document.body) =>
  [...within.querySelectorAll('label')]
    .find((l) => l.querySelector('input[type=radio]') && l.textContent?.includes(words))!
    .querySelector('input')!;
const field = (label: string) =>
  [...document.body.querySelectorAll('label')]
    .find((l) => l.firstChild?.textContent === label)!
    .querySelector('input')!;
const render = async (app: App = 'livediagram', share: { code: string } | null = SHARE) => {
  act(() =>
    root.render(<Connections client={fakeClient()} itemId={ITEM_ID} app={app} share={share} />),
  );
  await settle();
};
const row = (id = 'w1') => container.querySelector(`[data-webhook="${id}"]`)!;
const created = () => calls.find((c) => c.method === 'createWebhook')!;
const updates = () => calls.filter((c) => c.method === 'updateWebhook');

describe('An item’s connections', () => {
  it('names the list for assistive technology and counts it, read through its link', async () => {
    await render();
    expect(container.querySelector('h3')?.textContent).toBe('Connections');
    expect(container.querySelector('h3')?.className).toContain('sr-only');
    expect(container.textContent).toContain('1 connection');
    expect(calls[0]).toEqual({
      method: 'listWebhooks',
      args: [ITEM_ID, { code: 'abc123', password: null }],
    });
  });

  it('speaks in the item’s own words: a plan’s', async () => {
    webhooks = [];
    await render('liveplanner', null);
    expect(container.textContent).toContain(
      'Give this plan’s rules somewhere to post: Slack, Teams or your own service. Only this plan: your other plans have their own.',
    );
    expect(calls[0]).toEqual({ method: 'listWebhooks', args: [ITEM_ID, undefined] });
  });

  it('lists each connection with its kind, who added it, state, host and last delivery, and no events', async () => {
    webhooks = [HOOK, { ...HOOK, id: 'w3', name: 'Theirs', mine: false }];
    await render();
    expect(row().textContent).toContain('Launch channel');
    expect(row().textContent).toContain('Slack · Added by you');
    expect(row().querySelector('[data-state="live"]')?.textContent).toBe('Active');
    expect(row().textContent).toContain('hooks.slack.com');
    expect(row().textContent).toMatch(/Delivered (\d+ \w{3,4}|\w{3,4} \d+)/);
    expect(row('w3').textContent).toContain('Slack · Added by another editor');
    // What it sends is a rule's to say: no events, no Who Did It, nothing to edit.
    expect(container.querySelector('[aria-label="What it sends"]')).toBeNull();
    expect(container.querySelector('[data-webhook-who]')).toBeNull();
    expect(button('Edit Events')).toBeUndefined();
    expect(container.textContent).not.toMatch(/Sends|Every Event|By anyone/);
  });

  it('says Nothing sent yet, and a self-paused one needs attention with why', async () => {
    webhooks = [{ ...HOOK, lastDelivery: null, pausedAt: 1, pausedReason: 'failing' }];
    await render();
    expect(row().textContent).toContain('Nothing sent yet');
    expect(row().querySelector('[data-state="warn"]')?.textContent).toBe('Needs Attention');
    expect(row().textContent).toContain('20 deliveries in a row failed');
    await press('Resume', row());
    expect(updates()[0]!.args).toEqual([
      'w1',
      { paused: false },
      { code: 'abc123', password: null },
    ]);
    expect(row().querySelector('[data-state="live"]')).not.toBeNull();
  });

  it('shows an empty state with Add Connection when there are none, and the form takes the keyboard', async () => {
    webhooks = [];
    await render();
    expect(container.querySelector('[data-empty-state]')?.textContent).toContain(
      'No connections yet',
    );
    expect(container.querySelector('[data-empty-state]')?.textContent).toContain('this canvas');
    await press('Add Connection');
    expect(document.activeElement).toBe(choice('Slack'));
    expect((document.activeElement as HTMLInputElement).checked).toBe(true);
    await press('Cancel');
    expect(document.querySelector('form')).toBeNull();
    expect(container.querySelector('[data-empty-state]')).not.toBeNull();
  });

  it('adds one in two steps: where it posts, its address and a name, and its secret once', async () => {
    await render();
    await press('Add Connection');
    const form = document.querySelector('form')!;
    expect(form.closest('[role="dialog"]')?.querySelector('h2')?.textContent).toBe(
      'Add a Connection',
    );
    // Each destination brings its own Connect panel, field and how to get the address.
    act(() => choice('Microsoft Teams').click());
    expect(form.querySelector('[data-connect="teams"]')?.textContent).toContain(
      'Connect Microsoft Teams',
    );
    expect(field('Teams Workflow URL')).toBeTruthy();
    expect(form.textContent).toContain('Workflows');
    act(() => choice('Your Own Service').click());
    expect(form.querySelector('[data-connect="json"]')?.textContent).toContain(
      'Connect Your Service',
    );
    // No "What Should It Send?", no "Who Did It": two steps, three destinations, nothing to tick.
    expect([...form.querySelectorAll('[role="group"]')].map((g) => g.textContent)).toHaveLength(2);
    expect(form.textContent).not.toMatch(/What Should It Send|Who Did It|Select All|Only Me/);
    expect(form.querySelector('[data-webhook-events]')).toBeNull();
    expect(form.querySelectorAll('input[type=checkbox]')).toHaveLength(0);
    expect(form.querySelectorAll('input[type=radio]')).toHaveLength(3);
    const submit = button('Add Connection', form);
    expect(submit.disabled).toBe(true);
    expect(form.textContent).toContain('Add a name to finish.');
    type(field('Name'), 'Mine');
    expect(form.textContent).toContain('Add an address to finish.');
    type(field('HTTPS Address'), 'https://hooks.example.com/in');
    expect(form.textContent).not.toContain('to finish.');
    expect(submit.disabled).toBe(false);
    await press('Add Connection', form);
    expect(created().args).toEqual([
      ITEM_ID,
      { name: 'Mine', kind: 'json', url: 'https://hooks.example.com/in' },
      { code: 'abc123', password: null },
    ]);
    expect(container.textContent).toContain('whsec_abc');
    expect(document.activeElement?.textContent).toBe('Copy');
    await press('Done');
    expect(container.textContent).not.toContain('whsec_abc');
    expect(document.activeElement?.textContent).toBe('Connections');
    expect(container.querySelectorAll('[data-webhook]')).toHaveLength(2);
    expect(row('w2').textContent).toContain('Added. Send a test to check it reaches your service.');
  });

  it('adds a Slack one with no secret to show', async () => {
    webhooks = [];
    await render('liveplanner');
    await press('Add Connection');
    const form = document.querySelector('form')!;
    type(field('Slack Webhook URL'), 'https://hooks.slack.com/services/T/B/x');
    type(field('Name'), 'Board');
    await press('Add Connection', form);
    expect(created().args[1]).toEqual({
      name: 'Board',
      kind: 'slack',
      url: 'https://hooks.slack.com/services/T/B/x',
    });
    expect(container.textContent).not.toContain('whsec_abc');
    expect(row('w2').textContent).toContain('Added. Send a test to check it reaches your channel.');
  });

  it('isolates each name (<bdi>), so a right-to-left or overriding one never turns the words around it', async () => {
    webhooks = [{ ...HOOK, name: '‮evil' }];
    await render();
    expect(row().querySelector('h5 > bdi')?.textContent).toBe('‮evil');
  });

  it('says what was wrong with the address, by where it sends', async () => {
    refuse = (m) => (m === 'createWebhook' ? 'webhook_url_invalid' : null);
    await render();
    await press('Add Connection');
    const form = document.querySelector('form')!;
    type(field('Slack Webhook URL'), 'https://example.com');
    type(field('Name'), 'x');
    await press('Add Connection', form);
    const url = field('Slack Webhook URL');
    const alert = document.body.querySelector('[role=alert]')!;
    expect(alert.textContent).toContain('hooks.slack.com/services');
    // Said by the address, which is marked invalid and takes the keyboard (Work Tracker 1025).
    expect(url.getAttribute('aria-invalid')).toBe('true');
    expect(url.getAttribute('aria-describedby')).toContain(alert.id);
    expect(document.activeElement).toBe(url);
    // Typing a new address clears it.
    type(url, 'https://hooks.slack.com/services/x');
    expect(url.hasAttribute('aria-invalid')).toBe(false);
    expect(document.body.querySelector('[role=alert]')).toBeNull();
  });

  it('says a host that does not resolve could not be found, by the address', async () => {
    refuse = (m) => (m === 'createWebhook' ? 'webhook_url_unresolved' : null);
    await render();
    await press('Add Connection');
    const form = document.querySelector('form')!;
    type(field('Slack Webhook URL'), 'https://hooks.slak.com/services/x');
    type(field('Name'), 'x');
    await press('Add Connection', form);
    const alert = document.body.querySelector('[role=alert]')!;
    expect(alert.textContent).toBe('We couldn’t find that address. Check the domain.');
    expect(document.activeElement).toBe(field('Slack Webhook URL'));
    // Cancel and Add Connection stay in the form's sticky foot.
    expect(button('Cancel', form)).toBeTruthy();
    expect(button('Add Connection', form).closest('.sticky')).not.toBeNull();
  });

  it('keeps a refusal that is not the address above the buttons, the keyboard on Add Connection', async () => {
    refuse = (m) => (m === 'createWebhook' ? 'webhook_limit' : null);
    await render();
    await press('Add Connection');
    const form = document.querySelector('form')!;
    type(field('Slack Webhook URL'), 'https://hooks.slack.com/services/x');
    type(field('Name'), 'x');
    await press('Add Connection', form);
    expect(document.body.querySelector('[role=alert]')?.textContent).toContain(
      'up to 10 connections',
    );
    expect(field('Slack Webhook URL').hasAttribute('aria-invalid')).toBe(false);
    expect(document.activeElement).toBe(button('Add Connection', form));
  });

  it('reads recent deliveries only when opened, naming each a rule’s message or a test', async () => {
    await render();
    expect(calls.some((c) => c.method === 'webhookDeliveries')).toBe(false);
    const toggle = button('Recent Deliveries', row());
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await press('Recent Deliveries', row());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const item = row().querySelector('[data-delivery="failed"]')!;
    expect(item.textContent).toContain('Automation');
    expect(item.querySelector('[data-logotype]')).toBeNull();
    expect(item.textContent).toContain('Failed: answered 500 · 3 tries');
    await press('Recent Deliveries', row());
    deliveries = () => [];
    await press('Recent Deliveries', row());
    expect(row().textContent).toContain('No deliveries yet');
    expect(row().textContent).toContain('wait for a rule to send through it');
  });

  it('says why recent deliveries could not be read, and reads them again on Try Again', async () => {
    await render();
    refuse = (method) => (method === 'webhookDeliveries' ? 'webhooks_unavailable' : null);
    await press('Recent Deliveries', row());
    expect(row().querySelector('[aria-busy]')).toBeNull();
    expect(row().textContent).toContain('Connections aren’t available just now.');
    // The read never marks the row's own buttons busy.
    expect(button('Send Test', row()).getAttribute('aria-busy')).toBeNull();
    refuse = () => null;
    await press('Try Again', row());
    expect(row().querySelector('[data-delivery="failed"]')).toBeTruthy();
    expect(row().textContent).not.toContain('Connections aren’t available just now.');
  });

  it('reads recent deliveries even while a pause is on its way', async () => {
    await render();
    let resolve: () => void = () => {};
    const client = fakeClient();
    const slow = client.updateWebhook;
    client.updateWebhook = (...args) =>
      new Promise((r) => {
        resolve = () => r(slow(...args));
      });
    act(() =>
      root.render(<Connections client={client} itemId={ITEM_ID} app="livediagram" share={SHARE} />),
    );
    await settle();
    await press('Pause Connection', row());
    await press('Recent Deliveries', row());
    expect(row().querySelector('[data-delivery="failed"]')).toBeTruthy();
    await act(async () => resolve());
    await settle();
  });

  describe('Send Test', () => {
    const ping = (over: Partial<WebhookDelivery>): WebhookDelivery => ({
      ...DELIVERY,
      id: 9,
      type: 'ping',
      app: 'liveworkspace',
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
      expect(calls.find((c) => c.method === 'testWebhook')?.args).toEqual([
        'w1',
        { code: 'abc123', password: null },
      ]);
      expect(row().querySelector('[role=status]')?.textContent).toBe('Sending a test…');
      const sendTest = button('Send Test', row());
      expect(sendTest.getAttribute('aria-disabled')).toBe('true');
      expect(sendTest.disabled).toBe(false);
      await press('Send Test', row());
      expect(calls.filter((c) => c.method === 'testWebhook')).toHaveLength(1);
      await wait(READ_AT[0]);
      expect(reads).toBe(1);
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
      deliveries = () => [ping({ state: 'pending', attempts: 0 })];
      await press('Send Test', row());
      await wait(READ_AT.at(-1)!);
      expect(row().querySelector('[role=status]')?.textContent).toBe(
        'Test queued. It shows in Recent Deliveries once it’s sent.',
      );
    });

    it('stops reading once the dialog is gone', async () => {
      vi.useFakeTimers();
      deliveries = () => [];
      await render();
      await wait(0);
      await press('Send Test', row());
      act(() => root.unmount());
      root = createRoot(container);
      await wait(30_000);
      expect(calls.some((c) => c.method === 'webhookDeliveries')).toBe(false);
    });

    it('says why a test was refused', async () => {
      refuse = (m) => (m === 'testWebhook' ? 'webhook_paused' : null);
      await render();
      await press('Send Test', row());
      expect(row().querySelector('[role=alert]')?.textContent).toContain('Resume it');
    });
  });

  it('pauses and resumes from its icon button, keeping the keyboard on it', async () => {
    await render();
    await press('Pause Connection', row());
    expect(updates()[0]!.args[1]).toEqual({ paused: true });
    expect(row().querySelector('[data-state="paused"]')?.textContent).toBe('Paused');
    expect(row().textContent).toContain('Paused. Nothing is sent until you resume it.');
    expect(button('Send Test', row()).disabled).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Resume Connection');
    await press('Resume Connection', row());
    expect(updates().at(-1)!.args[1]).toEqual({ paused: false });
    expect(button('Pause Connection', row())).toBeTruthy();
  });

  it('deletes after asking in a popover, and keeps it on Cancel', async () => {
    await render();
    await press('Delete Connection', row());
    const popover = document.querySelector('[data-confirm-popover]')!;
    expect(popover.textContent).toContain('Delete “Launch channel”?');
    await press('Cancel', popover);
    expect(document.querySelector('[data-confirm-popover]')).toBeNull();
    expect(document.activeElement).toBe(button('Delete Connection', row()));
    expect(calls.some((c) => c.method === 'deleteWebhook')).toBe(false);
    await press('Delete Connection', row());
    await press('Delete', document.querySelector('[data-confirm-popover]')!);
    expect(calls.find((c) => c.method === 'deleteWebhook')?.args).toEqual([
      'w1',
      { code: 'abc123', password: null },
    ]);
    expect(container.querySelector('[data-empty-state]')).not.toBeNull();
  });

  it('hides Add Connection at the limit, and says so', async () => {
    webhooks = Array.from({ length: WEBHOOKS_PER_DOCUMENT_MAX }, (_, i) => ({
      ...HOOK,
      id: `w${i + 1}`,
    }));
    await render();
    expect(container.querySelectorAll('[data-webhook]')).toHaveLength(WEBHOOKS_PER_DOCUMENT_MAX);
    expect(button('Add Connection')).toBeUndefined();
    expect(container.textContent).toContain(
      'A canvas can have up to 10 connections. Delete one to add another.',
    );
  });

  it('says who may manage them when the index refuses, with no Try Again', async () => {
    refuse = (m) => (m === 'listWebhooks' ? 'webhooks_need_editor' : null);
    await render();
    expect(document.body.querySelector('[role=alert]')?.textContent).toContain(
      'Only people who can edit all of this document can manage its connections.',
    );
    expect(button('Try Again')).toBeUndefined();
    expect(button('Add Connection')).toBeUndefined();
  });

  it('offers Try Again for a passing failure', async () => {
    refuse = (m) => (m === 'listWebhooks' ? 'webhooks_unavailable' : null);
    await render();
    expect(document.body.querySelector('[role=alert]')?.textContent).toContain(
      'aren’t available just now',
    );
    refuse = () => null;
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
      note: expect.stringContaining('can no longer edit this document'),
    });
    expect(stateOf({ ...HOOK, pausedAt: 1, pausedReason: 'gone' }).note).toContain(
      'add the connection again',
    );
    expect(failureOf({ status: null, error: null })).toBeNull();
    expect(failureOf({ status: 502, error: 'network' })).toBe('answered 502, couldn’t connect');
    expect(failureOf({ status: null, error: 'brand_new' })).toBe('brand_new');
    expect(deliveryLine({ ...DELIVERY, state: 'delivered', status: 204 })).toBe('Delivered (204)');
    expect(deliveryLine({ ...DELIVERY, state: 'delivered', status: null })).toBe('Delivered');
    expect(deliveryLine({ ...DELIVERY, status: null, error: 'timeout' })).toBe(
      'Failed: no answer in 10 seconds',
    );
    expect(deliveryLine({ ...DELIVERY, state: 'pending', attempts: 0 })).toBe('Waiting to send');
    expect(deliveryLine({ ...DELIVERY, state: 'pending', status: 503 })).toBe(
      'Retrying after it answered 503',
    );
    expect(deliveryName('ping')).toBe('Test');
    expect(deliveryName('automation')).toBe('Automation');
    // A row from before connections (a local database's) reads as its stored type.
    expect(deliveryName('renamed' as never)).toBe('renamed');
    expect(webhookError('something_new')).toMatch(/Something went wrong/);
    expect(webhookError('webhook_url_invalid', 'teams')).toContain('logic.azure.com');
    expect(webhookError('webhook_limit')).toContain('A document can have up to 10 connections');
    expect(webhookError('offline')).toBe('Couldn’t connect. Check your connection and try again.');
  });

  it('binds every call to the document and its link', async () => {
    const seen: [string, unknown[]][] = [];
    const spy = new Proxy(
      {},
      {
        get:
          (_t, name: string) =>
          (...args: unknown[]) => {
            seen.push([name, args]);
            return Promise.resolve({});
          },
      },
    ) as IndexClient;
    const api = documentWebhooksApi(spy, 'doc', { code: 'c' });
    await api.list();
    await api.create({ name: 'n', kind: 'json', url: 'https://x.test' });
    await api.update('w', { paused: true });
    await api.remove('w');
    await api.test('w');
    await api.deliveries('w');
    expect(seen.map(([name]) => name)).toEqual([
      'listWebhooks',
      'createWebhook',
      'updateWebhook',
      'deleteWebhook',
      'testWebhook',
      'webhookDeliveries',
    ]);
    expect(seen[0]![1]).toEqual(['doc', { code: 'c' }]);
    expect(seen[1]![1][0]).toBe('doc');
    expect(seen[2]![1]).toEqual(['w', { paused: true }, { code: 'c' }]);
    for (const [, args] of seen.slice(3)) expect(args).toEqual(['w', { code: 'c' }]);
  });

  it('says when, relatively within a week and by date past it', () => {
    const now = Date.UTC(2026, 9, 30, 12);
    expect(whenOf(now - 2 * 3_600_000, now)).toMatch(/2 hours ago|2h/);
    const day = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
    expect(whenOf(now - 10 * 86_400_000, now)).toBe(day.format(now - 10 * 86_400_000));
  });

  it('finds the test this row sent, never an older one', () => {
    const sentAt = 1_000_000_000;
    const old = { ...DELIVERY, type: 'ping' as const, occurredAt: sentAt - 120_000 };
    const mine = { ...old, id: 2, occurredAt: sentAt + 10 };
    expect(testDeliveryOf([DELIVERY, old], sentAt)).toBeNull();
    expect(testDeliveryOf([mine, old], sentAt)).toBe(mine);
  });
});

describe('the Connections dialog', () => {
  it('heads the list with the item, and closes', async () => {
    const onClose = vi.fn();
    act(() =>
      root.render(
        <ConnectionsDialog
          onClose={onClose}
          client={fakeClient()}
          itemId="item-1"
          app="liveplanner"
          title="Sprint 4"
          share={{ code: 'abc123' }}
        />,
      ),
    );
    await settle();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.querySelector('h2')?.textContent).toBe('Connections for “\u2068Sprint 4\u2069”');
    expect(calls[0]).toMatchObject({ method: 'listWebhooks' });
    act(() => (dialog.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click());
    expect(onClose).toHaveBeenCalled();
  });

  it('names an unnamed item Untitled', async () => {
    act(() =>
      root.render(
        <ConnectionsDialog
          onClose={() => {}}
          client={fakeClient()}
          itemId="item-1"
          app="livediagram"
          title=""
        />,
      ),
    );
    await settle();
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toContain('Untitled');
  });
});
