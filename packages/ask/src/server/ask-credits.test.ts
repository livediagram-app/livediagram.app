import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpendResult } from '@liveworkspace/subscription';
import { fakeSubscription } from '@liveworkspace/subscription/testing';
import {
  ASK_CREDITS_WORDS,
  askCreditsOf,
  askPayer,
  chargeAsk,
  type AskCreditsDoor,
  type AskGrant,
} from './ask-credits';

// Who pays for a built-in question, and its one spend (liveworkspace/docs/specs/020-ask/ask.md "AI credits").
const NOW = Date.UTC(2026, 10, 23);
const OWNER = 'user_owner';
const ASKER = 'user_asker';

const grantOf = (level: string, over: Partial<AskGrant> = {}): AskGrant => ({
  level,
  owner: OWNER,
  team: null,
  ...over,
});

const ok: SpendResult = { ok: true, used: 1, limit: 50, tier: 'free' };

function doorOf(grant: AskGrant | null | Error, over: Partial<AskCreditsDoor> = {}) {
  const spend = vi.fn(async (..._args: unknown[]): Promise<SpendResult> => ok);
  const byOthers = vi.fn(async (): Promise<boolean | 'unavailable'> => true);
  const asked: string[] = [];
  const door: AskCreditsDoor = {
    client: { spend },
    teams: [],
    grant: async (itemId) => {
      asked.push(itemId);
      if (grant instanceof Error) throw grant;
      return grant;
    },
    byOthers,
    ...over,
  };
  return { door, spend, byOthers, asked };
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('who pays for a built-in question (share roles)', () => {
  it("lends an Editor and a Participant the owner's credits, the owner's own month for the owner", async () => {
    for (const level of ['edit', 'participate']) {
      const { door } = doorOf(grantOf(level));
      expect(await askPayer(door, ASKER, 'doc_1')).toEqual({
        scope: `p:${OWNER}`,
        theirs: false,
        others: 'doc_1',
      });
    }
    const { door } = doorOf(grantOf('edit'));
    expect(await askPayer(door, OWNER, 'doc_1')).toEqual({
      scope: `p:${OWNER}`,
      theirs: true,
      others: null,
    });
  });

  it('lends a Viewer nothing: their own month pays', async () => {
    const { door } = doorOf(grantOf('view'));
    expect(await askPayer(door, ASKER, 'doc_1')).toEqual({
      scope: `p:${ASKER}`,
      theirs: true,
      others: null,
    });
  });

  it("charges a team's item to the team, theirs for a member", async () => {
    const { door } = doorOf(grantOf('participate', { team: 'team_1' }), { teams: ['team_1'] });
    expect(await askPayer(door, ASKER, 'doc_1')).toEqual({
      scope: 't:team_1',
      theirs: true,
      others: null,
    });
    const outside = doorOf(grantOf('edit', { team: 'team_1' }));
    expect(await askPayer(outside.door, ASKER, 'doc_1')).toMatchObject({
      scope: 't:team_1',
      theirs: false,
      others: 'doc_1',
    });
  });

  it("charges nobody for a guest's item", async () => {
    const { door } = doorOf(grantOf('edit', { owner: 'guest_1' }));
    expect(await askPayer(door, ASKER, 'doc_1')).toBeNull();
  });

  it('charges the asker where no item, no grant, a failed grant or no owner names anyone else', async () => {
    const own = { scope: `p:${ASKER}`, theirs: true, others: null };
    const none = doorOf(null);
    expect(await askPayer(none.door, ASKER, null)).toEqual(own);
    expect(none.asked).toEqual([]);
    expect(await askPayer(none.door, ASKER, 'doc_1')).toEqual(own);
    expect(await askPayer(doorOf(new Error('index down')).door, ASKER, 'doc_1')).toEqual(own);
    expect(await askPayer(doorOf(grantOf('edit', { owner: null })).door, ASKER, 'doc_1')).toEqual(
      own,
    );
  });
});

describe('the spend', () => {
  it('spends one credit from the payer and goes ahead', async () => {
    const { door, spend, byOthers } = doorOf(grantOf('edit'));
    expect(await chargeAsk(door, OWNER, 'doc_1', NOW)).toBeNull();
    expect(spend).toHaveBeenCalledWith(`p:${OWNER}`, 'aiCredits', 1);
    expect(byOthers).not.toHaveBeenCalled();
  });

  it("spends nothing on a guest's item", async () => {
    const { door, spend } = doorOf(grantOf('edit', { owner: 'guest_1' }));
    expect(await chargeAsk(door, ASKER, 'doc_1', NOW)).toBeNull();
    expect(spend).not.toHaveBeenCalled();
  });

  it("takes someone else's question from the item's day first, refusing past it", async () => {
    const { door, spend, byOthers } = doorOf(grantOf('participate'));
    expect(await chargeAsk(door, ASKER, 'doc_1', NOW)).toBeNull();
    expect(byOthers).toHaveBeenCalledWith('doc_1', NOW);
    byOthers.mockResolvedValueOnce(false);
    expect(await chargeAsk(door, ASKER, 'doc_1', NOW)).toEqual({
      status: 429,
      error: 'ask_by_others_limit',
      message: ASK_CREDITS_WORDS.byOthers,
    });
    byOthers.mockResolvedValueOnce('unavailable');
    expect(await chargeAsk(door, ASKER, 'doc_1', NOW)).toMatchObject({
      status: 503,
      error: 'ask_unavailable',
    });
    expect(spend).toHaveBeenCalledTimes(1);
  });

  it("refuses at the month's end: the numbers to the owner's side, the scope to anyone", async () => {
    const used: SpendResult = { ok: false, used: 50, limit: 50, tier: 'free' };
    const mine = doorOf(grantOf('edit'));
    mine.spend.mockResolvedValue(used);
    expect(await chargeAsk(mine.door, OWNER, 'doc_1', NOW)).toEqual({
      status: 429,
      error: 'ai_credits_used',
      message: ASK_CREDITS_WORDS.used,
      more: { limit: 'aiCreditsPerMonth', owner: `p:${OWNER}`, used: 50, max: 50 },
    });
    const theirs = doorOf(grantOf('participate'));
    theirs.spend.mockResolvedValue({ ...used, limit: null });
    expect(await chargeAsk(theirs.door, ASKER, 'doc_1', NOW)).toMatchObject({
      more: { limit: 'aiCreditsPerMonth', owner: `p:${OWNER}` },
    });
    expect((await chargeAsk(theirs.door, ASKER, 'doc_1', NOW))!.more).not.toHaveProperty('used');
    const unlimited = doorOf(grantOf('edit'));
    unlimited.spend.mockResolvedValue({ ...used, limit: null });
    expect((await chargeAsk(unlimited.door, OWNER, 'doc_1', NOW))!.more).toMatchObject({ max: 0 });
  });

  it('says a refused request as unchecked, never as credits used', async () => {
    const { door, spend } = doorOf(grantOf('edit'));
    spend.mockResolvedValue({ ok: false, used: 0, limit: 0, tier: 'free', unmetered: 'refused' });
    expect(await chargeAsk(door, OWNER, 'doc_1', NOW)).toEqual({
      status: 503,
      error: 'ask_unavailable',
      message: ASK_CREDITS_WORDS.unchecked,
    });
  });
});

describe("an app's door", () => {
  const rooms = { idFromName: (name: string) => name, get: () => ({ spendAsk: async () => true }) };

  it('is null with Pro off: no grant read, no client', async () => {
    const grant = vi.fn();
    for (const PRO_ENABLED of [undefined, 'false'])
      expect(
        askCreditsOf({ env: { PRO_ENABLED }, app: 'livediagram.app', rooms, teams: [], grant }),
      ).toBeNull();
    expect(grant).not.toHaveBeenCalled();
  });

  it("with Pro on, reads the index's grant (a refusal as none) and the joined teams", async () => {
    const service = fakeSubscription();
    const answers: (AskGrant | Response | null)[] = [
      new Response(null, { status: 403 }),
      grantOf('edit'),
    ];
    const door = askCreditsOf({
      env: {
        PRO_ENABLED: 'true',
        SUBSCRIPTION_KEY: 'app-key',
        SUBSCRIPTION_URL: 'https://subscription.test/ask',
        SUBSCRIPTION: service.fetcher,
      },
      app: 'livediagram.app',
      rooms,
      teams: [{ id: 'team_1' }],
      grant: async () => answers.shift()!,
    })!;
    expect(door.teams).toEqual(['team_1']);
    expect(await door.grant('doc_1')).toBeNull();
    expect(await door.grant('doc_1')).toEqual(grantOf('edit'));
    expect(await door.byOthers('doc_1', NOW)).toBe(true);
    expect(await chargeAsk(door, OWNER, null, NOW)).toBeNull();
    expect(service.to('spend')).toEqual([
      expect.objectContaining({ owner: `p:${OWNER}`, meter: 'aiCredits', amount: 1 }),
    ]);
    const noTeams = askCreditsOf({
      env: { PRO_ENABLED: 'true' },
      app: 'livediagram.app',
      rooms,
      teams: null,
      grant: async () => null,
    })!;
    expect(noTeams.teams).toEqual([]);
  });
});
