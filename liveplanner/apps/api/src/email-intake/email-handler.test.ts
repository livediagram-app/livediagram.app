import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailIntakeResponse } from '@liveplanner/api-schema';
import { FROM_EMAIL_FIELD, defaultCatalogue, type Item } from '@liveplanner/items';
import {
  automationWorld,
  type AutomationWorld,
} from '../plan-room/automations/test-automation-world';
import { setPlanItemTypes } from '../plan-room/plan-content';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import type { PlanEnv } from '../types';
import {
  INTAKE_MESSAGE_MAX,
  REJECTIONS,
  handleIntakeEmail,
  type IntakeMessage,
} from './email-handler';
import { intakesOf } from './intake-store';

// A message to a board's address, end to end through the worker's door and the plan's room
// (docs/specs/026-plan/email-to-board.md "Which mail is taken" and "What a message makes").
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);
const members = vi.hoisted(() => ({ answer: new Set<string>() as Set<string> | 'unavailable' }));
vi.mock('./intake-members', () => ({ planMemberAddresses: async () => members.answer }));

const DOMAIN = 'in.liveplanner.test';
const AUTH_PASS = 'Authentication-Results: mx.cloudflare.net; dkim=pass; spf=pass; dmarc=pass';

let w: AutomationWorld;
let address = '';
const planEnv = (): PlanEnv => w.plans.get('A')!.room.requireEnv();

const turnOn = async (senders: 'members' | 'anyone') => {
  const res = await w.as('owner', 'PUT', '/email-intake/b1', { senders });
  address = (await res.json<EmailIntakeResponse>()).intake.address;
};

beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  w = await automationWorld('A');
  await setPlanItemTypes(planEnv(), 'A', defaultCatalogue());
  Reflect.set(w.env, 'EMAIL_INTAKE_DOMAIN', DOMAIN);
  Reflect.set(planEnv(), 'EMAIL_INTAKE_DOMAIN', DOMAIN);
  members.answer = new Set(['ada@example.com']);
  await turnOn('members');
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

function message(
  lines: string[],
  opts: { to?: string; from?: string; rawSize?: number } = {},
): IntakeMessage & { rejected: string | null } {
  const bytes = new TextEncoder().encode(lines.join('\r\n'));
  const m = {
    from: opts.from ?? 'ada@example.com',
    to: opts.to ?? address,
    rawSize: opts.rawSize ?? bytes.byteLength,
    raw: new Response(bytes).body!,
    rejected: null as string | null,
    setReject(reason: string) {
      m.rejected = reason;
    },
  };
  return m;
}

const plain = (body: string[], subject = 'Printer is broken', from = 'Ada <Ada@Example.com>') => [
  AUTH_PASS,
  `From: ${from}`,
  `Subject: ${subject}`,
  'Content-Type: text/plain; charset=utf-8',
  '',
  ...body,
];

const deliver = async (m: IntakeMessage) => handleIntakeEmail(m, w.env);
const cards = async (): Promise<Item[]> => w.items('A');

describe('what a message makes', () => {
  it('makes a card in the first column, its reply stripped and its sender kept', async () => {
    const m = message(plain(['It jams on page 2.', '', 'On Mon, Bo <b@x.com> wrote:', '> old']));
    await deliver(m);
    expect(m.rejected).toBeNull();
    const [card] = await cards();
    expect(card).toMatchObject({ type: 'task', fields: { status: 'backlog' } });
    expect(card!.fields['title']).toBe('Printer is broken');
    expect(card!.fields['description']).toBe('It jams on page 2.');
    expect(card!.fields[FROM_EMAIL_FIELD]).toBe('ada@example.com');
    expect(card!.createdBy).toMatchObject({ name: 'ada@example.com' });
    const [row] = await intakesOf(planEnv(), 'A');
    expect(row).toMatchObject({ made: 1, refused: 0, dropped: 0 });
    expect(row!.lastAt).toBeGreaterThan(0);
  });

  it('takes anyone with the address when the board allows it', async () => {
    await w.as('owner', 'PUT', '/email-intake/b1', { senders: 'anyone' });
    members.answer = 'unavailable';
    const m = message(plain(['hi'], '', 'stranger@else.com'), { from: 'stranger@else.com' });
    await deliver(m);
    expect(m.rejected).toBeNull();
    expect((await cards())[0]!.fields['title']).toBe('Email from stranger@else.com');
  });

  it('attaches pictures and lists what it dropped', async () => {
    Reflect.set(planEnv(), 'MEDIA_KEY', 'k');
    const uploads: string[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      uploads.push(new Headers(init.headers).get('Content-Type') ?? '');
      return Response.json({
        image: { id: `img_${uploads.length}`, app: 'liveplanner.app' },
        deduped: false,
      });
    });
    const png = btoa(
      String.fromCharCode(
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        0,
        0,
        0,
        13,
        0x49,
        0x48,
        0x44,
        0x52,
        0,
        0,
        0,
        2,
        0,
        0,
        0,
        3,
        8,
        6,
        0,
        0,
        0,
      ),
    );
    const m = message([
      AUTH_PASS,
      'From: ada@example.com',
      'Subject: Screens',
      'Content-Type: multipart/mixed; boundary=b',
      '',
      '--b',
      'Content-Type: text/plain',
      '',
      'See attached.',
      '--b',
      'Content-Type: image/png; name=shot.png',
      'Content-Transfer-Encoding: base64',
      '',
      png,
      '--b',
      'Content-Type: application/pdf; name=report.pdf',
      '',
      'not a picture',
      '--b--',
    ]);
    await deliver(m);
    expect(m.rejected).toBeNull();
    expect(uploads).toEqual(['image/png']);
    const [card] = await cards();
    expect(card!.fields['attachments']).toEqual([
      { id: 'img_1', name: 'shot.png', size: 29, type: 'image/png' },
    ]);
    expect(card!.fields['description']).toBe(
      'See attached.\n\nNot attached: report.pdf (1 KB, not a picture).',
    );
  });
});

describe('which mail is taken', () => {
  it('refuses an address that is not one', async () => {
    for (const to of [
      'board-abc@in.liveplanner.test',
      address.replace(DOMAIN, 'other.test'),
      'hello@in.liveplanner.test',
      `board-${'a'.repeat(26)}@${DOMAIN}`,
    ]) {
      const m = message(plain(['x']), { to });
      await deliver(m);
      expect(m.rejected).toBe(REJECTIONS.no_address);
    }
    expect(await cards()).toEqual([]);
  });

  it('refuses a message too big, as declared or as read', async () => {
    const big = message(plain(['x']), { rawSize: INTAKE_MESSAGE_MAX + 1 });
    await deliver(big);
    expect(big.rejected).toBe(REJECTIONS.too_big);
  });

  it("refuses at the sender's rate", async () => {
    Reflect.set(w.env, 'FORM_RATE_LIMITER', { limit: async () => ({ success: false }) });
    const m = message(plain(['x']));
    await deliver(m);
    expect(m.rejected).toBe(REJECTIONS.sender_rate);
  });

  it('drops and counts mail that fails its checks, saying nothing', async () => {
    const lines = plain(['x']).slice(1);
    for (const m of [
      message(lines),
      message(['Authentication-Results: mx.cloudflare.net; dmarc=fail', ...lines]),
    ]) {
      await deliver(m);
      expect(m.rejected).toBeNull();
    }
    expect(await cards()).toEqual([]);
    expect((await intakesOf(planEnv(), 'A'))[0]).toMatchObject({ dropped: 2, made: 0 });
  });

  it("refuses and counts a sender who isn't a plan member, or when accounts can't say", async () => {
    const m = message(plain(['x'], 'Hi', 'eve@example.com'), { from: 'eve@example.com' });
    await deliver(m);
    expect(m.rejected).toBe(REJECTIONS.refused_sender);
    members.answer = 'unavailable';
    const later = message(plain(['x']));
    await deliver(later);
    expect(later.rejected).toBe(REJECTIONS.unavailable);
    expect(await cards()).toEqual([]);
    expect((await intakesOf(planEnv(), 'A'))[0]).toMatchObject({ refused: 1, made: 0 });
  });

  it('refuses mail to an address turned off, or replaced', async () => {
    const old = address;
    await w.as('owner', 'POST', '/email-intake/b1/new-address');
    const toOld = message(plain(['x']), { to: old });
    await deliver(toOld);
    expect(toOld.rejected).toBe(REJECTIONS.no_address);
    await w.as('owner', 'DELETE', '/email-intake/b1');
    const m = message(plain(['x']));
    await deliver(m);
    expect(m.rejected).toBe(REJECTIONS.no_address);
  });

  it('refuses mail once the board has gone', async () => {
    expect((await w.send('DELETE', '/api/projects/A/tabs/t1')).status).toBeLessThan(300);
    const m = message(plain(['x']));
    await deliver(m);
    expect(m.rejected).toBe(REJECTIONS.no_address);
  });

  it('refuses past the hour caps for one sender', async () => {
    for (let i = 0; i < 20; i++) {
      const m = message(plain([`n ${i}`]));
      await deliver(m);
      expect(m.rejected).toBeNull();
    }
    const over = message(plain(['one more']));
    await deliver(over);
    expect(over.rejected).toBe(REJECTIONS.busy);
    expect(await cards()).toHaveLength(20);
  });
});
