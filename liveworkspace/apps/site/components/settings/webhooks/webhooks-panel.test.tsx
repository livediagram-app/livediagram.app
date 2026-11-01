// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Webhook, WebhookDelivery } from '@liveworkspace/index-client';
import { WebhooksPanel } from './WebhooksPanel';
import { deliveryLine, stateOf, webhookError } from './webhooks-api';

vi.mock('@/lib/explorer/token', () => ({ workspaceToken: async () => 'tok' }));

// Settings › Webhooks (liveworkspace/docs/specs/004-index/webhooks.md "Settings"): the list, adding one for your own
// items or a team you run (its secret shown once), Send Test, Pause and Resume, Delete, and the recent deliveries.
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
let answer: (call: Call) => Response | null;

const json = (status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  calls = [];
  webhooks = [HOOK];
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
        const made: Webhook = { ...HOOK, id: 'w2', kind: 'json', name: 'Mine', teamId: null };
        webhooks = [...webhooks, made];
        return json(201, { webhook: made, secret: 'whsec_abc' });
      }
      if (url.endsWith('/deliveries')) return json(200, { deliveries: [DELIVERY] });
      if (url.endsWith('/test')) return json(202, { queued: true });
      if (call.method === 'PATCH')
        return json(200, {
          webhook: {
            ...HOOK,
            pausedAt: 1,
            pausedReason: (call.body as { paused: boolean }).paused ? 'paused' : null,
          },
        });
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
  vi.unstubAllGlobals();
});

const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const button = (name: string) =>
  [...container.querySelectorAll('button')].find(
    (b) => b.textContent === name || b.getAttribute('aria-label') === name,
  )!;
const press = async (name: string) => {
  const b = button(name);
  b.focus();
  await act(async () => b.click());
  await settle();
};
const type = (input: HTMLInputElement | HTMLSelectElement, value: string) =>
  act(() => {
    const proto = input instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(
      new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }),
    );
  });
const render = async () => {
  act(() => root.render(<WebhooksPanel />));
  await settle();
};

describe('Settings › Webhooks', () => {
  it('lists each webhook with its kind, state, whose items, host and events, asking as the person', async () => {
    await render();
    const row = container.querySelector('[data-webhook="w1"]')!;
    expect(row.textContent).toContain('Launch channel');
    expect(row.textContent).toContain('Slack');
    expect(row.textContent).toContain('Active');
    expect(row.textContent).toContain('Design’s items');
    expect(row.textContent).toContain('hooks.slack.com');
    expect(row.textContent).toContain('Item Created, Card Moved (liveplanner)');
    expect(calls.find((c) => c.url === '/api/index/webhooks')?.auth).toBe('Bearer tok');
  });

  it('shows an empty state with Add Webhook when there are none', async () => {
    webhooks = [];
    await render();
    expect(container.querySelector('[data-empty-state]')?.textContent).toContain('No webhooks yet');
    await press('Add Webhook');
    expect(document.activeElement?.closest('label')?.textContent).toContain('Name');
    // Cancel puts the form away.
    await press('Cancel');
    expect(container.querySelector('form')).toBeNull();
  });

  it('adds one, offering only the teams the person runs, and shows its secret once', async () => {
    await render();
    await press('Add Webhook');
    const select = container.querySelector('select')!;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Your own items',
      'Design’s items',
    ]);
    await press('Microsoft Teams');
    expect(container.textContent).toContain('Workflows');
    await press('Webhook');
    const [name, url] = [
      ...container.querySelectorAll<HTMLInputElement>('form input:not([type=checkbox])'),
    ];
    type(name!, 'Mine');
    type(url!, 'https://hooks.example.com/in');
    type(select, 'teamA');
    // Untick one event.
    const boxes = [...container.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    act(() => boxes[0]!.click());
    await press('Add Webhook');
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/webhooks'))!;
    expect(post.body).toMatchObject({
      name: 'Mine',
      kind: 'json',
      url: 'https://hooks.example.com/in',
      teamId: 'teamA',
    });
    expect((post.body as { events: string[] }).events).not.toContain('created');
    expect(container.textContent).toContain('whsec_abc');
    await press('Done');
    expect(container.textContent).not.toContain('whsec_abc');
    expect(document.activeElement?.textContent).toBe('Your Webhooks');
    expect(container.querySelectorAll('[data-webhook]')).toHaveLength(2);
  });

  it('says what was wrong with the address, by where it sends', async () => {
    answer = (c) => (c.method === 'POST' ? json(400, { error: 'webhook_url_invalid' }) : null);
    await render();
    await press('Add Webhook');
    await press('Slack');
    const [name, url] = [
      ...container.querySelectorAll<HTMLInputElement>('form input:not([type=checkbox])'),
    ];
    type(name!, 'x');
    type(url!, 'https://example.com');
    await press('Add Webhook');
    expect(container.querySelector('[role=alert]')?.textContent).toContain(
      'hooks.slack.com/services',
    );
  });

  it('sends a test, pauses, and reads recent deliveries when opened', async () => {
    await render();
    await press('Send Test');
    expect(calls.some((c) => c.url === '/api/index/webhooks/w1/test')).toBe(true);
    expect(container.textContent).toContain('Test sent');
    expect(calls.some((c) => c.url.endsWith('/deliveries'))).toBe(false);
    await press('Recent Deliveries');
    expect(container.textContent).toContain('Card Moved (liveplanner): Sprint 4');
    expect(container.textContent).toContain('Failed: 500');
    expect(container.textContent).toContain('3 tries');
    // A test sent while it is open reads them again.
    await press('Send Test');
    expect(calls.filter((c) => c.url.endsWith('/deliveries'))).toHaveLength(2);
    await press('Pause');
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ paused: true });
    expect(button('Resume')).toBeTruthy();
    expect(button('Send Test').disabled).toBe(true);
  });

  it('deletes after asking, and says why when a call is refused', async () => {
    await render();
    await press('Delete');
    expect(document.activeElement).toBe(button('Keep'));
    await press('Delete now');
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
    expect(container.querySelector('[data-empty-state]')).not.toBeNull();
  });

  it('shows a refused list and a refused test in words', async () => {
    answer = (c) =>
      c.url.endsWith('/webhooks') ? json(403, { error: 'webhooks_need_account' }) : null;
    await render();
    expect(container.querySelector('[role=alert]')?.textContent).toContain(
      'Sign in to your account',
    );
    answer = (c) => (c.url.endsWith('/test') ? json(409, { error: 'webhook_paused' }) : null);
    await act(async () => root.unmount());
    root = createRoot(container);
    await render();
    await press('Send Test');
    expect(container.querySelector('[role=alert]')?.textContent).toContain('Resume it');
  });
});

describe('words', () => {
  it('names each state and delivery', () => {
    expect(stateOf({ ...HOOK, pausedAt: 1, pausedReason: 'creator_left' })).toEqual({
      label: 'Paused: whoever added it no longer runs the team',
      tone: 'warn',
    });
    expect(stateOf({ ...HOOK, pausedAt: 1, pausedReason: null }).tone).toBe('paused');
    expect(deliveryLine({ ...DELIVERY, state: 'delivered', status: 204 })).toBe('Delivered (204)');
    expect(deliveryLine({ ...DELIVERY, state: 'delivered', status: null })).toBe('Delivered');
    expect(deliveryLine({ ...DELIVERY, status: null, error: 'timeout' })).toBe(
      'Failed: no answer in 10 seconds',
    );
    expect(deliveryLine({ ...DELIVERY, status: null })).toBe('Failed');
    expect(deliveryLine({ ...DELIVERY, state: 'pending', attempts: 0 })).toBe('Waiting to send');
    expect(deliveryLine({ ...DELIVERY, state: 'pending', status: 503 })).toBe('Retrying after 503');
    expect(deliveryLine({ ...DELIVERY, state: 'pending', status: null })).toBe('Retrying');
    expect(webhookError('something_new')).toMatch(/Something went wrong/);
    expect(webhookError('webhook_url_invalid', 'teams')).toContain('logic.azure.com');
  });
});
