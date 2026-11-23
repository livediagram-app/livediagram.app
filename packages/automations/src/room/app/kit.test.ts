import { describe, expect, it, vi } from 'vitest';
import { ANA } from '../item/test-kit';
import {
  RULE_TABS_MAX,
  TAB_TOO_LARGE,
  TEMPLATE_FAILED,
  TEMPLATE_GONE,
  addTemplateTab,
  tabLimitWords,
  type AddTemplateTabInput,
} from './kit-add-tab';
import { itemHookUrl, kitMail, optOutDoorUrl, optOutPageUrl, type KitMailInput } from './kit-mail';
import { kitSends } from './kit-sends';
import {
  SNAPSHOT_UNREADABLE,
  kitSnapshots,
  snapshotNotStartedWords,
  snapshotTooLargeWords,
  type KitSnapshotsInput,
} from './kit-snapshots';

describe('a rule’s messages', () => {
  it('go to the index with their rule and subject, and nowhere without an index', async () => {
    expect(kitSends(null)).toBeNull();
    const push = vi.fn(async (_item: string, messages: { key: string }[]) => ({
      results: messages.map((m) => ({ key: m.key, queued: true as const })),
    }));
    const sends = kitSends({ pushAutomationSends: push })!;
    const message = {
      key: 'k1',
      webhookId: 'w1',
      rule: 'Weekly',
      subject: { title: 'Board', url: 'https://app.example/d/1#t=t1' },
      text: 'Hello',
      at: 5,
      extra: 'never sent',
    };
    expect(await sends.push('item-1', [message as never])).toEqual([{ key: 'k1', queued: true }]);
    expect(push).toHaveBeenCalledWith('item-1', [
      {
        key: 'k1',
        webhookId: 'w1',
        rule: 'Weekly',
        subject: message.subject,
        text: 'Hello',
        at: 5,
      },
    ]);
    // A check (Pro's spend, before the real push) says so to the index.
    await sends.push('item-1', [message], { check: true });
    expect(push).toHaveBeenLastCalledWith('item-1', expect.any(Array), { check: true });
  });
});

describe('a rule’s snapshot steps', () => {
  const input = (over: Partial<KitSnapshotsInput> = {}): KitSnapshotsInput => ({
    itemWord: 'document',
    list: async () => [{ id: 's1', name: 'Clean', extra: 1 } as never],
    exportFile: async () => '{"file":true}',
    kept: () => ['s9'],
    take: vi.fn(async () => ({ ok: true })),
    revert: async () => ({ ok: true }),
    ...over,
  });

  it('lists the item’s snapshots by id and name', async () => {
    expect(await kitSnapshots(input()).list()).toEqual([{ id: 's1', name: 'Clean' }]);
  });

  it('takes one of the item’s file, keeping what the rules name', async () => {
    const take = vi.fn(async () => ({ ok: true }));
    expect(await kitSnapshots(input({ take })).take('Daily', ANA)).toEqual({ ok: true });
    expect(take).toHaveBeenCalledWith({
      text: '{"file":true}',
      name: 'Daily',
      author: ANA,
      keptIds: ['s9'],
    });
    expect(
      await kitSnapshots(input({ take: async () => ({ ok: false }) })).take('Daily', ANA),
    ).toEqual({ ok: false, reason: snapshotTooLargeWords('document') });
    expect(await kitSnapshots(input({ exportFile: async () => null })).take('Daily', ANA)).toEqual({
      ok: false,
      reason: snapshotNotStartedWords('document'),
    });
  });

  it('reverts through the app’s door, and says why it could not', async () => {
    expect(await kitSnapshots(input()).revert('s1', ANA)).toEqual({ ok: true });
    const failing = (reason: string) =>
      kitSnapshots(input({ revert: async () => ({ ok: false, reason }) })).revert('s1', ANA);
    expect(await failing('item_missing')).toEqual({
      ok: false,
      reason: snapshotNotStartedWords('document'),
    });
    expect(await failing('unreadable')).toEqual({ ok: false, reason: SNAPSHOT_UNREADABLE });
    expect(await failing('too_large')).toEqual({
      ok: false,
      reason: snapshotTooLargeWords('document'),
    });
    expect(await failing('snapshot_missing')).toEqual({ ok: false, reason: 'snapshot_missing' });
  });
});

describe('a rule’s email', () => {
  const sent: Record<string, unknown>[] = [];
  const input: KitMailInput = {
    look: {
      shell: (s) => JSON.stringify(s),
      manageNotificationsFooter: (reason) => reason,
      profileUrl: 'https://app.example/profile',
      noun: 'document',
      product: 'liveexample',
      linkColour: '#000000',
    },
    baseUrl: 'https://app.example',
    itemId: 'd 1',
    itemName: async () => 'Launch',
    itemUrl: 'https://app.example/document/d1',
    addressOf: async (personId) => (personId === 'ana' ? 'ana@example.com' : undefined),
    send: async (email) => void sent.push(email),
  };
  const message = { subject: 'Hello', body: 'Body', rule: 'Weekly' };

  it('is not sent where email is not set up', () => {
    expect(kitMail(null)).toBeNull();
  });

  it('names its doors under the app’s address', () => {
    const mail = kitMail(input)!;
    expect(mail.optOutDoor('tok')).toBe('https://app.example/api/email-optout/d%201/tok');
    expect(mail.optOutPage('tok')).toBe('https://app.example/email-optout?d=d%201&t=tok');
    expect(optOutDoorUrl('https://a.example', 'd1', 't')).toBe(
      'https://a.example/api/email-optout/d1/t',
    );
    expect(optOutPageUrl('https://a.example', 'd1', 't')).toBe(
      'https://a.example/email-optout?d=d1&t=t',
    );
    expect(itemHookUrl('https://a.example', 'd 1', 'r/1')).toBe(
      'https://a.example/api/hooks/automations/d%201/r%2F1',
    );
  });

  it('goes to a person only at the address the app answers for them', async () => {
    const mail = kitMail(input)!;
    expect(await mail.sendToPerson('nobody', message)).toBe(false);
    expect(sent).toEqual([]);
    expect(await mail.sendToPerson('ana', message)).toBe(true);
    expect(sent[0]).toMatchObject({
      to: 'ana@example.com',
      kind: 'AutomationEmail',
      subject: 'Hello',
      unsubscribeUrl: 'https://app.example/profile',
    });
    expect(String(sent[0]!['html'])).toContain('Launch');
  });

  it('goes to a typed-in address with its own unsubscribe', async () => {
    const mail = kitMail(input)!;
    await mail.sendToAddress('kim@example.com', message, {
      unsubscribeUrl: 'https://app.example/api/email-optout/d1/tok',
      unsubscribePage: 'https://app.example/email-optout?d=d1&t=tok',
    });
    expect(sent.at(-1)).toMatchObject({
      to: 'kim@example.com',
      oneClick: true,
      unsubscribeUrl: 'https://app.example/api/email-optout/d1/tok',
    });
  });
});

describe('Add a Tab from a Template', () => {
  type Tab = { id: string; name: string; kind: string };
  const written: Tab[] = [];
  const input = (over: Partial<AddTemplateTabInput<Tab>> = {}): AddTemplateTabInput<Tab> => ({
    itemWord: 'document',
    tabCount: async () => 3,
    kindOf: (template) =>
      template === 'old-retro' ? 'retro' : template === 'retro' ? 'retro' : null,
    storedName: (name) => name.trim(),
    build: (tab) => tab,
    tooLarge: () => false,
    write: async (tab) => void written.push(tab),
    ...over,
  });

  it('makes the tab from the template, a retired one as its replacement, under the stored name', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const added = await addTemplateTab(input(), 'old-retro', ' Retro ');
    expect(added).toMatchObject({ name: 'Retro' });
    expect(written.at(-1)).toMatchObject({ name: 'Retro', kind: 'retro' });
    expect(await addTemplateTab(input(), 'retro', '  ')).toMatchObject({ name: 'Untitled' });
    vi.restoreAllMocks();
  });

  it('fails for an item not started, at its limit, a template gone or refused, and a tab too large', async () => {
    const failed = async (over: Partial<AddTemplateTabInput<Tab>>, template = 'retro') =>
      addTemplateTab(input(over), template, 'Retro');
    const before = written.length;
    expect(await failed({ tabCount: async () => null })).toEqual({ failed: TEMPLATE_FAILED });
    expect(await failed({ tabCount: async () => RULE_TABS_MAX })).toEqual({
      failed: tabLimitWords('document'),
    });
    expect(await failed({}, 'nope')).toEqual({ failed: TEMPLATE_GONE });
    expect(await failed({ build: () => null })).toEqual({ failed: TEMPLATE_FAILED });
    expect(await failed({ tooLarge: () => true })).toEqual({ failed: TAB_TOO_LARGE });
    expect(written).toHaveLength(before);
  });

  it('says page, never tab, for a knowledgebase', async () => {
    const failed = async (over: Partial<AddTemplateTabInput<Tab>>) =>
      addTemplateTab(input({ itemWord: 'knowledgebase', ...over }), 'retro', 'Retro');
    expect(await failed({ tabCount: async () => RULE_TABS_MAX })).toEqual({
      failed: 'This knowledgebase has 200 pages, the most a rule adds to',
    });
    expect(await failed({ build: () => null })).toEqual({
      failed: "Couldn't make a page from that template",
    });
    expect(await failed({ tooLarge: () => true })).toEqual({
      failed: 'The page came out too large to store',
    });
  });
});
