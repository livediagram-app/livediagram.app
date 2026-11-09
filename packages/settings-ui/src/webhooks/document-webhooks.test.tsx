// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IndexError,
  WEBHOOKS_PER_DOCUMENT_MAX,
  webhookEventsOf,
  type App,
  type IndexClient,
  type Webhook,
  type WebhookDelivery,
} from '@liveworkspace/index-client';
import { DocumentWebhooks } from './DocumentWebhooks';
import { DocumentWebhooksDialog } from './DocumentWebhooksDialog';
import { testDeliveryOf, READ_AT } from './useSendTest';
import {
  deliveryLine,
  documentWebhooksApi,
  eventName,
  failureOf,
  stateOf,
  webhookError,
  whenOf,
} from './webhooks-api';

// A document's Webhooks dialog body (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"): the line saying
// they are this document's alone, the list, adding one step by step (the document's app's events in its own words,
// none chosen at first, and Who Did It), a plain one's secret shown once, Send Test with its result read back, Pause
// and Resume, Delete asked in a popover, Edit Events, each one's Recent Deliveries, the limit and the refusals.
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
  events: ['renamed', 'commented'],
  who: 'anyone',
  mine: true,
  createdAt: 1_790_000_000_000,
  pausedAt: null,
  pausedReason: null,
  lastDelivery: { state: 'delivered', status: 200, at: 1_790_000_000_000 },
};
const DELIVERY: WebhookDelivery = {
  id: 1,
  type: 'renamed',
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
      const input = args[1] as {
        name: string;
        kind: Webhook['kind'];
        events: Webhook['events'];
        who?: Webhook['who'];
      };
      const made: Webhook = {
        ...HOOK,
        id: 'w2',
        name: input.name,
        kind: input.kind,
        events: input.events,
        who: input.who ?? 'anyone',
        lastDelivery: null,
      };
      webhooks = [...webhooks, made];
      return Promise.resolve({ webhook: made, secret: input.kind === 'json' ? 'whsec_abc' : null });
    },
    updateWebhook: (...args: unknown[]) => {
      const refused = record('updateWebhook', args);
      if (refused) return fail(refused);
      const [id, input] = args as [
        string,
        { paused?: boolean; events?: Webhook['events']; who?: Webhook['who'] },
      ];
      const was = webhooks.find((w) => w.id === id) ?? HOOK;
      const next: Webhook = {
        ...was,
        ...(input.events ? { events: input.events } : {}),
        ...(input.who ? { who: input.who } : {}),
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
const choice = (words: string, within: ParentNode = container) =>
  [...within.querySelectorAll('label')]
    .find(
      (l) =>
        l.querySelector('input[type=radio],input[type=checkbox]') && l.textContent?.includes(words),
    )!
    .querySelector('input')!;
const field = (label: string) =>
  [...container.querySelectorAll('label')]
    .find((l) => l.firstChild?.textContent === label)!
    .querySelector('input')!;
const render = async (app: App = 'livediagram', share: { code: string } | null = SHARE) => {
  act(() =>
    root.render(
      <DocumentWebhooks client={fakeClient()} itemId={ITEM_ID} app={app} share={share} />,
    ),
  );
  await settle();
};
const row = (id = 'w1') => container.querySelector(`[data-webhook="${id}"]`)!;
const created = () => calls.find((c) => c.method === 'createWebhook')!;
const updates = () => calls.filter((c) => c.method === 'updateWebhook');

describe('A document’s webhooks', () => {
  it('says what a webhook does here and that they are this document’s alone, read through its link', async () => {
    await render();
    expect(container.querySelector('h3')?.textContent).toBe('Post Updates Where Your Team Talks');
    expect(container.textContent).toContain('when something happens to this canvas');
    expect(container.querySelector('[data-webhooks-scope]')?.textContent).toBe(
      'Only for this canvas. Your other canvases have their own.',
    );
    expect(calls[0]).toEqual({
      method: 'listWebhooks',
      args: [ITEM_ID, { code: 'abc123', password: null }],
    });
  });

  it('speaks in the document’s own words: a plan’s', async () => {
    webhooks = [];
    await render('liveplanner', null);
    expect(container.querySelector('[data-webhooks-scope]')?.textContent).toBe(
      'Only for this plan. Your other plans have their own.',
    );
    expect(calls[0]).toEqual({ method: 'listWebhooks', args: [ITEM_ID, undefined] });
  });

  it('lists each webhook with its kind, who added it, state, host, last delivery and what it sends', async () => {
    webhooks = [HOOK, { ...HOOK, id: 'w3', name: 'Theirs', mine: false, who: 'me' }];
    await render();
    expect(row().textContent).toContain('Launch channel');
    expect(row().textContent).toContain('Slack · Added by you');
    expect(row().querySelector('[data-state="live"]')?.textContent).toBe('Active');
    expect(row().textContent).toContain('hooks.slack.com');
    expect(row().textContent).toMatch(/Delivered (\d+ \w{3,4}|\w{3,4} \d+)/);
    const sends = row().querySelector('[aria-label="What it sends"]')!;
    expect(sends.textContent).toContain('Canvas Renamed');
    expect(sends.textContent).toContain('Comment Added');
    // No app named on an event: the dialog is the document's.
    expect(sends.querySelector('[data-logotype]')).toBeNull();
    expect(sends.querySelector('[data-webhook-who]')?.textContent).toBe('By anyone');
    expect(row('w3').textContent).toContain('Slack · Added by another editor');
    expect(row('w3').querySelector('[data-webhook-who]')?.textContent).toBe(
      'Only what its creator does',
    );
  });

  it('says Every Event, Only what you do, Nothing sent yet, and a self-paused one needs attention with why', async () => {
    webhooks = [
      {
        ...HOOK,
        events: webhookEventsOf('livediagram'),
        who: 'me',
        lastDelivery: null,
        pausedAt: 1,
        pausedReason: 'failing',
      },
    ];
    await render();
    expect(row().textContent).toContain('Every Event');
    expect(row().querySelector('[data-webhook-who]')?.textContent).toBe('Only what you do');
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

  it('shows an empty state with Add Webhook when there are none, and the form takes the keyboard', async () => {
    webhooks = [];
    await render();
    expect(container.querySelector('[data-empty-state]')?.textContent).toContain('No Webhooks Yet');
    expect(container.querySelector('[data-empty-state]')?.textContent).toContain('this canvas');
    await press('Add Webhook');
    expect(document.activeElement).toBe(choice('Slack'));
    expect((document.activeElement as HTMLInputElement).checked).toBe(true);
    await press('Cancel');
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('[data-empty-state]')).not.toBeNull();
  });

  it('adds one step by step: the canvas’s events, none chosen, Who Did It, and its secret once', async () => {
    await render();
    await press('Add Webhook');
    const form = container.querySelector('form')!;
    expect(form.textContent).toContain('It posts only what happens to this canvas.');
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
    const submit = button('Add Webhook', form);
    expect(submit.disabled).toBe(true);
    expect(form.textContent).toContain('Add a name to finish.');
    type(field('Name'), 'Mine');
    expect(form.textContent).toContain('Add an address to finish.');
    type(field('HTTPS Address'), 'https://hooks.example.com/in');
    // What it sends: the canvas's events in its own words, no app header or logo, and no card or form events.
    const picker = form.querySelector('[data-webhook-events]')!;
    expect(picker.textContent).toContain('This Canvas');
    expect(picker.textContent).toContain('Canvas Renamed');
    expect(picker.textContent).toContain('Canvas Moved to the Trash');
    expect(picker.textContent).toContain('Action Assigned');
    expect(picker.textContent).not.toContain('Card Moved');
    expect(picker.textContent).not.toContain('Form Response');
    expect(picker.textContent).not.toContain('Created');
    expect(picker.textContent).not.toContain('Mentioned');
    expect(picker.querySelector('[data-logotype]')).toBeNull();
    expect(form.querySelector('[data-webhook-app]')).toBeNull();
    // Nothing is chosen until the person picks it.
    const boxes = [...form.querySelectorAll<HTMLInputElement>('input[name^="webhook-event-"]')];
    expect(boxes).toHaveLength(7);
    for (const box of boxes) expect(box.checked).toBe(false);
    expect(form.textContent).toContain('0 of 7');
    expect(button('Clear', form).disabled).toBe(true);
    expect(form.textContent).toContain('Pick at least one thing to send.');
    expect(submit.disabled).toBe(true);
    await press('Select All', form);
    expect(form.textContent).toContain('7 of 7');
    expect(button('Select All', form).disabled).toBe(true);
    await press('Clear', form);
    expect(form.textContent).toContain('0 of 7');
    act(() => choice('Canvas Renamed', form).click());
    act(() => choice('Share Link Made', form).click());
    expect(form.textContent).toContain('2 of 7');
    // Who Did It: Anyone at first.
    expect(choice('Anyone', form).checked).toBe(true);
    expect(choice('Only Me', form).checked).toBe(false);
    expect(submit.disabled).toBe(false);
    await press('Add Webhook', form);
    expect(created().args).toEqual([
      ITEM_ID,
      {
        name: 'Mine',
        kind: 'json',
        url: 'https://hooks.example.com/in',
        events: ['renamed', 'shared'],
        who: 'anyone',
      },
      { code: 'abc123', password: null },
    ]);
    expect(container.textContent).toContain('whsec_abc');
    expect(document.activeElement?.textContent).toBe('Copy');
    await press('Done');
    expect(container.textContent).not.toContain('whsec_abc');
    expect(document.activeElement?.textContent).toBe('Post Updates Where Your Team Talks');
    expect(container.querySelectorAll('[data-webhook]')).toHaveLength(2);
    expect(row('w2').textContent).toContain('Added. Send a test to check it reaches your service.');
  });

  it('sends Only Me as who: me, and offers a plan its card moves and form responses', async () => {
    webhooks = [];
    await render('liveplanner');
    await press('Add Webhook');
    const form = container.querySelector('form')!;
    const picker = form.querySelector('[data-webhook-events]')!;
    expect(picker.textContent).toContain('Plan Renamed');
    expect(picker.textContent).toContain('Card Moved');
    expect(picker.textContent).toContain('Form Response');
    expect(picker.textContent).toContain('Action or Card Assigned');
    expect(form.textContent).toContain('0 of 9');
    type(field('Slack Webhook URL'), 'https://hooks.slack.com/services/T/B/x');
    type(field('Name'), 'Board');
    act(() => choice('Card Moved', form).click());
    act(() => choice('Only Me', form).click());
    await press('Add Webhook', form);
    expect(created().args[1]).toMatchObject({ kind: 'slack', events: ['card_moved'], who: 'me' });
    // A Slack one has no secret to show.
    expect(container.textContent).not.toContain('whsec_abc');
  });

  it('isolates each name (<bdi>), so a right-to-left or overriding one never turns the words around it', async () => {
    webhooks = [{ ...HOOK, name: '‮evil' }];
    await render();
    expect(row().querySelector('h5 > bdi')?.textContent).toBe('‮evil');
  });

  it('says what was wrong with the address, by where it sends', async () => {
    refuse = (m) => (m === 'createWebhook' ? 'webhook_url_invalid' : null);
    await render();
    await press('Add Webhook');
    const form = container.querySelector('form')!;
    type(field('Slack Webhook URL'), 'https://example.com');
    type(field('Name'), 'x');
    act(() => choice('Canvas Renamed', form).click());
    await press('Add Webhook', form);
    expect(container.querySelector('[role=alert]')?.textContent).toContain(
      'hooks.slack.com/services',
    );
    expect(document.activeElement).toBe(button('Add Webhook', form));
  });

  it('edits its events and Who Did It in place, saving both', async () => {
    await render();
    await press('Edit Events', row());
    const editor = row().querySelector('[data-events-editor]')!;
    expect(editor.textContent).not.toContain('Card Moved');
    expect(choice('Canvas Renamed', editor).checked).toBe(true);
    expect(button('Save', editor).disabled).toBe(true);
    act(() => choice('Share Link Made', editor).click());
    act(() => choice('Only Me', editor).click());
    await press('Save', editor);
    expect(updates()[0]!.args).toEqual([
      'w1',
      { events: ['renamed', 'shared', 'commented'], who: 'me' },
      { code: 'abc123', password: null },
    ]);
    expect(row().querySelector('[data-events-editor]')).toBeNull();
    const sends = row().querySelector('[aria-label="What it sends"]')!;
    expect(sends.textContent).toContain('Share Link Made');
    expect(sends.querySelector('[data-webhook-who]')?.textContent).toBe('Only what you do');
  });

  it('won’t save an edit with nothing chosen', async () => {
    await render();
    await press('Edit Events', row());
    const editor = row().querySelector('[data-events-editor]')!;
    await press('Clear', editor);
    expect(editor.textContent).toContain('Pick at least one thing to send.');
    expect(button('Save', editor).disabled).toBe(true);
    await press('Cancel', editor);
    expect(row().querySelector('[data-events-editor]')).toBeNull();
    expect(updates()).toHaveLength(0);
  });

  it('treats the saved events as unchanged whatever order the server lists them in', async () => {
    webhooks = [{ ...HOOK, events: ['commented', 'renamed'] }];
    await render();
    await press('Edit Events', row());
    const editor = row().querySelector('[data-events-editor]')!;
    expect(button('Save', editor).disabled).toBe(true);
    act(() => choice('Share Link Made', editor).click());
    expect(button('Save', editor).disabled).toBe(false);
    act(() => choice('Share Link Made', editor).click());
    expect(button('Save', editor).disabled).toBe(true);
  });

  it('reads recent deliveries only when opened, naming each in the canvas’s words', async () => {
    await render();
    expect(calls.some((c) => c.method === 'webhookDeliveries')).toBe(false);
    const toggle = button('Recent Deliveries', row());
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await press('Recent Deliveries', row());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const item = row().querySelector('[data-delivery="failed"]')!;
    expect(item.textContent).toContain('Canvas Renamed');
    expect(item.querySelector('[data-logotype]')).toBeNull();
    expect(item.textContent).toContain('Failed: answered 500 · 3 tries');
    await press('Recent Deliveries', row());
    deliveries = () => [];
    await press('Recent Deliveries', row());
    expect(row().textContent).toContain('No Deliveries Yet');
  });

  it('says why recent deliveries could not be read, and reads them again on Try Again', async () => {
    await render();
    refuse = (method) => (method === 'webhookDeliveries' ? 'webhooks_unavailable' : null);
    await press('Recent Deliveries', row());
    expect(row().querySelector('[aria-busy]')).toBeNull();
    expect(row().textContent).toContain('Webhooks aren’t available just now.');
    // The read never marks the row's own buttons busy.
    expect(button('Send Test', row()).getAttribute('aria-busy')).toBeNull();
    refuse = () => null;
    await press('Try Again', row());
    expect(row().querySelector('[data-delivery="failed"]')).toBeTruthy();
    expect(row().textContent).not.toContain('Webhooks aren’t available just now.');
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
      root.render(
        <DocumentWebhooks client={client} itemId={ITEM_ID} app="livediagram" share={SHARE} />,
      ),
    );
    await settle();
    await press('Pause Webhook', row());
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
    await press('Pause Webhook', row());
    expect(updates()[0]!.args[1]).toEqual({ paused: true });
    expect(row().querySelector('[data-state="paused"]')?.textContent).toBe('Paused');
    expect(row().textContent).toContain('Paused. Nothing is sent until you resume it.');
    expect(button('Send Test', row()).disabled).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Resume Webhook');
    await press('Resume Webhook', row());
    expect(updates().at(-1)!.args[1]).toEqual({ paused: false });
    expect(button('Pause Webhook', row())).toBeTruthy();
  });

  it('deletes after asking in a popover, and keeps it on Cancel', async () => {
    await render();
    await press('Delete Webhook', row());
    const popover = document.querySelector('[data-confirm-popover]')!;
    expect(popover.textContent).toContain('Delete “Launch channel”?');
    await press('Cancel', popover);
    expect(document.querySelector('[data-confirm-popover]')).toBeNull();
    expect(document.activeElement).toBe(button('Delete Webhook', row()));
    expect(calls.some((c) => c.method === 'deleteWebhook')).toBe(false);
    await press('Delete Webhook', row());
    await press('Delete', document.querySelector('[data-confirm-popover]')!);
    expect(calls.find((c) => c.method === 'deleteWebhook')?.args).toEqual([
      'w1',
      { code: 'abc123', password: null },
    ]);
    expect(container.querySelector('[data-empty-state]')).not.toBeNull();
  });

  it('hides Add Webhook at the limit, and says so', async () => {
    webhooks = Array.from({ length: WEBHOOKS_PER_DOCUMENT_MAX }, (_, i) => ({
      ...HOOK,
      id: `w${i + 1}`,
    }));
    await render();
    expect(container.querySelectorAll('[data-webhook]')).toHaveLength(WEBHOOKS_PER_DOCUMENT_MAX);
    expect(button('Add Webhook')).toBeUndefined();
    expect(container.textContent).toContain(
      'A canvas can have up to 10 webhooks. Delete one to add another.',
    );
  });

  it('says who may manage them when the index refuses, with no Try Again', async () => {
    refuse = (m) => (m === 'listWebhooks' ? 'webhooks_need_editor' : null);
    await render();
    expect(container.querySelector('[role=alert]')?.textContent).toContain(
      'Only people who can edit all of this document can manage its webhooks.',
    );
    expect(button('Try Again')).toBeUndefined();
    expect(button('Add Webhook')).toBeUndefined();
  });

  it('offers Try Again for a passing failure', async () => {
    refuse = (m) => (m === 'listWebhooks' ? 'webhooks_unavailable' : null);
    await render();
    expect(container.querySelector('[role=alert]')?.textContent).toContain(
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
    expect(deliveryLine({ ...DELIVERY, state: 'pending', attempts: 0 })).toBe('Waiting to send');
    expect(deliveryLine({ ...DELIVERY, state: 'pending', status: 503 })).toBe(
      'Retrying after it answered 503',
    );
    expect(eventName('livediagram', 'ping')).toBe('Test');
    expect(eventName('livediagram', 'renamed')).toBe('Canvas Renamed');
    expect(eventName('livedocuments', 'trashed')).toBe('Document Moved to the Trash');
    expect(eventName('liveplanner', 'card_moved')).toBe('Card Moved');
    expect(eventName('liveplanner', 'form_response')).toBe('Form Response');
    expect(eventName('liveplanner', 'action_assigned')).toBe('Action or Card Assigned');
    expect(eventName('livediagram', 'action_assigned')).toBe('Action Assigned');
    expect(eventName('livediagram', 'shared')).toBe('Share Link Made');
    expect(webhookError('something_new')).toMatch(/Something went wrong/);
    expect(webhookError('webhook_url_invalid', 'teams')).toContain('logic.azure.com');
    expect(webhookError('webhook_limit')).toContain('A document can have up to 10 webhooks');
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
    await api.create({ name: 'n', kind: 'json', url: 'https://x.test', events: ['renamed'] });
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

describe('the Webhooks dialog', () => {
  it('heads the body with the document, says the webhooks are its alone, and closes', async () => {
    const onClose = vi.fn();
    act(() =>
      root.render(
        <DocumentWebhooksDialog
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
    expect(dialog.querySelector('h2')?.textContent).toBe('Webhooks for “\u2068Sprint 4\u2069”');
    expect(dialog.textContent).toContain('Plan · These apply to this plan only');
    expect(calls[0]).toMatchObject({ method: 'listWebhooks' });
    act(() => (dialog.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click());
    expect(onClose).toHaveBeenCalled();
  });
});
