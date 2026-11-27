import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REPLAY_KEEP_MS } from '@liveworkspace/chat';
import {
  activity,
  botBearer,
  chatKit,
  command,
  connectSlack,
  linkUser,
  teams,
  type ChatKit,
} from './chat-test-kit';
import { NO_ACCESS } from './chat-answer';
import { NOT_CONNECTED } from './chat-slack';

// docs/specs/030-knowledgebase/chat-apps.md and blueprints/chat-apps.md "Tests".
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const responses = (kit: ChatKit) =>
  kit.sent.filter((s) => s.url.startsWith('https://hooks.slack.com/'));
const lastResponse = (kit: ChatKit) => JSON.stringify(responses(kit).at(-1)?.body ?? {});
const linkIn = (text: string) =>
  /https:\/\/www\.liveknowledge\.app\/chat\/link\?code=[^"\\]+/.exec(text)![0];

/** A Slack user linked to `account` through the app's own prompt. */
async function linked(kit: ChatKit, account: string, user = 'U1') {
  await kit.slack('commands', command('hello?', user));
  await kit.drain();
  expect((await linkUser(kit, linkIn(lastResponse(kit)), account)).status).toBe(200);
}

describe("Slack's request check", () => {
  it('refuses an unsigned, a forged, an old and an oversized request before reading it', async () => {
    const kit = await chatKit();
    await connectSlack(kit);
    const body = command('When do we deploy?');
    expect((await kit.hook('POST', '/api/chat/slack/commands', body)).status).toBe(401);
    expect((await kit.slack('commands', body, { secret: 'wrong' })).status).toBe(401);
    expect((await kit.slack('commands', body, { at: Date.now() - 301_000 })).status).toBe(401);
    expect((await kit.slack('commands', 'x'.repeat(70_000))).status).toBe(413);
    await kit.drain();
    expect(kit.asked).toHaveLength(0);
  });

  it('answers a request it has seen before with nothing, once inside the window', async () => {
    const kit = await chatKit();
    await connectSlack(kit);
    const event = JSON.stringify({
      type: 'event_callback',
      team_id: 'T1',
      event_id: 'Ev1',
      event: { type: 'app_mention', user: 'U1', text: '<@B1> when?', channel: 'C1' },
    });
    expect((await kit.slack('events', event)).status).toBe(200);
    expect((await kit.slack('events', event)).status).toBe(200);
    expect(await kit.workspace('slack:T1').seen('event:Ev1', Date.now() + REPLAY_KEEP_MS + 1)).toBe(
      false,
    );
    const jobs = kit.workspace('slack:T1').sql.exec('SELECT kind FROM jobs').toArray();
    expect(jobs).toEqual([{ kind: 'slack-ask' }]);
  });

  it("answers Slack's URL check", async () => {
    const kit = await chatKit();
    const res = await kit.slack(
      'events',
      JSON.stringify({ type: 'url_verification', challenge: 'abc' }),
    );
    expect(await res.json()).toEqual({ challenge: 'abc' });
  });
});

describe('connecting', () => {
  it('is an Editor’s, in person: the menu row’s routes refuse every other role', async () => {
    const kit = await chatKit();
    for (const who of ['participant', 'viewer', 'link', 'agent'] as const) {
      expect((await kit.call(who, 'GET', '/api/documents/kb/chat')).status).toBe(403);
      expect((await kit.call(who, 'POST', '/api/documents/kb/chat/slack')).status).toBe(403);
    }
    const apps = await kit.call('editor', 'GET', '/api/documents/kb/chat');
    expect(await apps.json()).toEqual({
      slack: { offered: true, connection: null },
      teams: { offered: true, connection: null, appLink: null },
    });
  });

  it('says what this server does not offer, and refuses to start it', async () => {
    const kit = await chatKit({ SLACK_SIGNING_SECRET: undefined, TEAMS_APP_PASSWORD: undefined });
    const apps = await (await kit.call('editor', 'GET', '/api/documents/kb/chat')).json();
    expect(apps).toMatchObject({ slack: { offered: false }, teams: { offered: false } });
    expect((await kit.call('editor', 'POST', '/api/documents/kb/chat/slack')).status).toBe(503);
    expect((await kit.hook('POST', '/api/chat/slack/commands', '')).status).toBe(503);
    expect((await kit.hook('POST', '/api/chat/teams/messages', '{}')).status).toBe(503);
  });

  it('connects a Slack workspace through its install, and back to the knowledgebase', async () => {
    const kit = await chatKit();
    const back = await connectSlack(kit);
    expect(back.status).toBe(302);
    expect(back.headers.get('Location')).toBe(
      'https://www.liveknowledge.app/document/kb?chat=connected',
    );
    const apps = await (await kit.call('editor', 'GET', '/api/documents/kb/chat')).json();
    expect(apps).toMatchObject({ slack: { connection: { name: 'Acme' } } });
    // The bot token is kept sealed, never as it came.
    expect(
      JSON.stringify(kit.workspace('slack:T1').sql.exec('SELECT * FROM install').toArray()),
    ).not.toContain('xoxb-test');
  });

  it('refuses a forged or failed install', async () => {
    const kit = await chatKit();
    const forged = await kit.hook('GET', '/api/chat/slack/oauth?code=good&state=forged', '');
    expect(forged.headers.get('Location')).toBe('https://www.liveknowledge.app/?chat=failed');
    const start = await (
      await kit.call('editor', 'POST', '/api/documents/kb/chat/slack')
    ).json<{ url: string }>();
    const state = new URL(start.url).searchParams.get('state')!;
    const bad = await kit.hook(
      'GET',
      `/api/chat/slack/oauth?code=bad&state=${encodeURIComponent(state)}`,
      '',
    );
    expect(bad.headers.get('Location')).toContain('chat=failed');
    const denied = await kit.hook(
      'GET',
      `/api/chat/slack/oauth?error=access_denied&state=${encodeURIComponent(state)}`,
      '',
    );
    expect(denied.headers.get('Location')).toContain('chat=denied');
  });

  it('keeps a workspace to one knowledgebase', async () => {
    const kit = await chatKit();
    await connectSlack(kit);
    kit.workspace('slack:T1').sql.exec("UPDATE install SET knowledgebase = 'other'");
    const again = await connectSlack(kit);
    expect(again.headers.get('Location')).toContain('chat=taken');
  });
});

describe('asking from Slack', () => {
  it('gives an unlinked person the Connect prompt and nothing else', async () => {
    const kit = await chatKit();
    await connectSlack(kit);
    const ack = await kit.slack('commands', command('When do we deploy?'));
    expect(JSON.stringify(await ack.json())).toContain('Looking that up');
    await kit.drain();
    expect(kit.asked).toHaveLength(0);
    const prompt = lastResponse(kit);
    expect(prompt).toContain('Connect Your Account');
    expect(prompt).not.toContain('Tuesdays');
  });

  it('answers a linked Editor with sources, trust and links, and sends the gap to Unanswered Questions', async () => {
    const kit = await chatKit();
    await connectSlack(kit);
    await kit.call('editor', 'POST', '/api/documents/kb/pages/deploys/verify');
    await linked(kit, 'user_o');
    await kit.slack('commands', command('When do we deploy?'));
    await kit.drain();
    const answer = lastResponse(kit);
    expect(answer).toContain('Deploys go out on Tuesdays');
    expect(answer).toContain('<https://www.liveknowledge.app/document/kb#t=deploys|[1]>');
    expect(answer).toContain('Verified 15 Jun');
    expect(answer).toContain('Who approves a deploy?');
    expect(answer).toContain('share_answer');
    const questions = kit.db.sql.prepare('SELECT question FROM questions').all();
    expect(JSON.stringify(questions)).toContain('Who approves a deploy?');
  });

  it("answers a linked Viewer from what they can read, and nobody without the knowledgebase's grant", async () => {
    const kit = await chatKit();
    await connectSlack(kit);
    await linked(kit, 'user_v', 'U2');
    await kit.slack('commands', command('When do we deploy?', 'U2'));
    await kit.drain();
    expect(lastResponse(kit)).toContain('Tuesdays');
    // Linked to an account the index grants one page: Ask reads the whole knowledgebase, so it is refused.
    await linked(kit, 'user_page', 'U3');
    await kit.slack('commands', command('When do we deploy?', 'U3'));
    await kit.drain();
    expect(lastResponse(kit)).not.toContain('Tuesdays');
    expect(lastResponse(kit)).toContain('only some pages');
    // Linked to an account with no access at all.
    await linked(kit, 'user_x', 'U4');
    await kit.slack('commands', command('When do we deploy?', 'U4'));
    await kit.drain();
    expect(lastResponse(kit)).toContain(NO_ACCESS.slice(0, 30));
  });

  it('answers nothing once disconnected, and forgets who was linked', async () => {
    const kit = await chatKit();
    await connectSlack(kit);
    await linked(kit, 'user_o');
    await kit.slack('commands', command('When do we deploy?'));
    const res = await kit.call('editor', 'DELETE', '/api/documents/kb/chat/slack');
    expect(await res.json()).toMatchObject({ slack: { connection: null } });
    expect(kit.sent.some((s) => s.url === 'https://slack.com/api/auth.revoke')).toBe(true);
    await kit.drain();
    expect(kit.asked).toHaveLength(0);
    const after = await kit.slack('commands', command('When do we deploy?'));
    expect(JSON.stringify(await after.json())).toContain(NOT_CONNECTED.slice(0, 30));
    expect(kit.workspace('slack:T1').sql.exec('SELECT * FROM links').toArray()).toEqual([]);
  });

  it('says help, and unlinks on request', async () => {
    const kit = await chatKit();
    await connectSlack(kit);
    expect(JSON.stringify(await (await kit.slack('commands', command(''))).json())).toContain(
      '/ask',
    );
    await linked(kit, 'user_o');
    expect(JSON.stringify(await (await kit.slack('commands', command('unlink'))).json())).toContain(
      'no longer connected',
    );
    await kit.slack('commands', command('When?'));
    await kit.drain();
    expect(lastResponse(kit)).toContain('Connect Your Account');
  });

  it('shares an answer in the channel once, for its asker alone', async () => {
    const kit = await chatKit();
    await connectSlack(kit);
    await linked(kit, 'user_o');
    await kit.slack('commands', command('When do we deploy?'));
    await kit.drain();
    const id = /"value":"([0-9a-f-]{36})"/.exec(lastResponse(kit))![1]!;
    const press = (user: string) =>
      kit.slack(
        'interactions',
        new URLSearchParams({
          payload: JSON.stringify({
            type: 'block_actions',
            user: { id: user },
            team: { id: 'T1' },
            response_url: 'https://hooks.slack.com/actions/T1/2/xyz',
            actions: [{ action_id: 'share_answer', value: id }],
          }),
        }).toString(),
      );
    await press('U9');
    expect(lastResponse(kit)).toContain('can no longer be shared');
    await press('U1');
    const shared = responses(kit).at(-2)!.body;
    expect(shared).toMatchObject({ response_type: 'in_channel' });
    expect(JSON.stringify(shared)).toContain('Shared by <@U1>');
    expect(responses(kit).at(-1)!.body).toEqual({ delete_original: true });
    await press('U1');
    expect(lastResponse(kit)).toContain('can no longer be shared');
  });

  it('answers a direct message and a mention, never a bot', async () => {
    const kit = await chatKit();
    await connectSlack(kit);
    await linked(kit, 'user_o');
    const event = (id: string, e: object) =>
      kit.slack(
        'events',
        JSON.stringify({ type: 'event_callback', team_id: 'T1', event_id: id, event: e }),
      );
    await event('E1', {
      type: 'message',
      channel_type: 'im',
      user: 'U1',
      channel: 'D1',
      text: 'When do we deploy?',
    });
    await event('E2', {
      type: 'message',
      channel_type: 'im',
      user: 'U1',
      channel: 'D1',
      text: 'hi',
      bot_id: 'B2',
    });
    await event('E3', { type: 'app_mention', user: 'U1', channel: 'C1', text: '<@B1> help' });
    await kit.drain();
    const methods = kit.sent
      .filter((s) => s.url.startsWith('https://slack.com/api/chat.'))
      .map((s) => s.url);
    expect(methods).toEqual([
      'https://slack.com/api/chat.postMessage',
      'https://slack.com/api/chat.postEphemeral',
    ]);
    expect(kit.asked).toHaveLength(1);
  });
});

describe('link previews', () => {
  const shared = (user: string, url: string) =>
    JSON.stringify({
      type: 'event_callback',
      team_id: 'T1',
      event_id: `L-${user}-${url.length}`,
      event: { type: 'link_shared', user, channel: 'C1', message_ts: '1.2', links: [{ url }] },
    });

  it("previews a page in the paster's access, and asks an unlinked paster to connect", async () => {
    const kit = await chatKit();
    await connectSlack(kit);
    await kit.call('editor', 'POST', '/api/documents/kb/pages/deploys/verify');
    await kit.slack('events', shared('U7', 'https://www.liveknowledge.app/document/kb#t=deploys'));
    await kit.drain();
    const asked = kit.sent
      .filter((s) => s.url === 'https://slack.com/api/chat.unfurl')
      .at(-1)!.body;
    expect(asked).toMatchObject({ user_auth_required: true, unfurls: {} });
    await linked(kit, 'user_o', 'U7');
    await kit.slack('events', shared('U7', 'https://liveknowledge.app/document/kb#t=deploys'));
    await kit.drain();
    const unfurl = JSON.stringify(
      kit.sent.filter((s) => s.url === 'https://slack.com/api/chat.unfurl').at(-1)!.body,
    );
    expect(unfurl).toContain('Deploys');
    expect(unfurl).toContain('Tuesdays after the morning standup');
    expect(unfurl).toContain('Verified 15 Jun');
  });

  it('previews nothing a paster cannot read, nor another knowledgebase or site', async () => {
    const kit = await chatKit();
    await connectSlack(kit);
    await linked(kit, 'user_page', 'U3');
    const before = kit.sent.length;
    await kit.slack('events', shared('U3', 'https://www.liveknowledge.app/document/kb#t=deploys'));
    await kit.slack(
      'events',
      shared('U3', 'https://www.liveknowledge.app/document/other#t=deploys'),
    );
    await kit.slack('events', shared('U3', 'https://evil.example/document/kb#t=deploys'));
    await kit.drain();
    expect(
      kit.sent.slice(before).filter((s) => s.url === 'https://slack.com/api/chat.unfurl'),
    ).toEqual([]);
    await kit.slack('events', shared('U3', 'https://www.liveknowledge.app/document/kb#t=holidays'));
    await kit.drain();
    expect(JSON.stringify(kit.sent.at(-1))).toContain('Holidays');
  });
});

describe('the account link', () => {
  it('shows what it links, takes a signed-in account once, and never a guest', async () => {
    const kit = await chatKit();
    await connectSlack(kit);
    await kit.slack('commands', command('When?'));
    await kit.drain();
    const url = linkIn(lastResponse(kit));
    const path = url.replace('https://www.liveknowledge.app/chat/link', '/api/chat/link');
    expect(await (await kit.link('GET', path, null)).json()).toEqual({
      platform: 'slack',
      workspace: 'Acme',
      userName: 'ana',
    });
    expect((await linkUser(kit, url, 'guest_1')).status).toBe(401);
    expect((await linkUser(kit, url, null)).status).toBe(401);
    expect((await linkUser(kit, url, 'user_o')).status).toBe(200);
    expect((await linkUser(kit, url, 'user_v')).status).toBe(410);
    expect((await kit.link('GET', '/api/chat/link?code=forged', null)).status).toBe(410);
  });

  it('lapses after 30 minutes', async () => {
    const kit = await chatKit();
    await connectSlack(kit);
    await kit.slack('commands', command('When?'));
    await kit.drain();
    const url = linkIn(lastResponse(kit));
    vi.setSystemTime(Date.now() + 1_800_001);
    expect((await linkUser(kit, url, 'user_o')).status).toBe(410);
  });
});

describe('Teams', () => {
  async function connectTeams(kit: ChatKit) {
    const { code } = await (
      await kit.call('editor', 'POST', '/api/documents/kb/chat/teams')
    ).json<{ code: string }>();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    await teams(kit, activity({ text: `connect ${code.toLowerCase()}` }));
    return code;
  }
  const said = (kit: ChatKit) =>
    kit.sent.filter((s) => s.url.includes('/v3/conversations/')).map((s) => JSON.stringify(s.body));

  it("refuses an activity the Bot Framework didn't sign for this app and this service", async () => {
    const kit = await chatKit();
    expect((await teams(kit, activity(), 'Bearer nope')).status).toBe(401);
    expect(
      (await teams(kit, activity(), await botBearer('https://smba.trafficmanager.net/other/')))
        .status,
    ).toBe(401);
    expect(
      (await teams(kit, activity(), await botBearer(undefined, { aud: 'someone-else' }))).status,
    ).toBe(401);
    const elsewhere = activity({ serviceUrl: 'https://evil.example/' });
    expect((await teams(kit, elsewhere, await botBearer('https://evil.example/'))).status).toBe(
      401,
    );
  });

  it('connects with the code once, then answers a linked person in their personal chat', async () => {
    const kit = await chatKit();
    const code = await connectTeams(kit);
    await kit.drain();
    expect(said(kit).at(-1)).toContain('Connected.');
    const apps = await (await kit.call('editor', 'GET', '/api/documents/kb/chat')).json();
    expect(apps).toMatchObject({ teams: { connection: { name: 'Microsoft Teams' } } });
    await teams(kit, activity({ text: `connect ${code}` }));
    await kit.drain();
    expect(said(kit).at(-1)).toContain('expired or was used');
    await teams(kit, activity());
    await kit.drain();
    const prompt = said(kit).at(-1)!;
    expect(prompt).toContain('Connect Your Account');
    expect(kit.asked).toHaveLength(0);
    expect((await linkUser(kit, linkIn(prompt), 'user_o')).status).toBe(200);
    await teams(kit, activity({ text: '<at>liveknowledge</at> When do we deploy?' }));
    await kit.drain();
    expect(said(kit).at(-1)).toContain('Deploys go out on Tuesdays');
  });

  it('answers a channel mention in the personal chat, and nothing once disconnected', async () => {
    const kit = await chatKit();
    await connectTeams(kit);
    await kit.drain();
    await teams(kit, activity());
    await kit.drain();
    await linkUser(kit, linkIn(said(kit).at(-1)!), 'user_o');
    await teams(
      kit,
      activity({
        conversation: { id: 'channel-1', conversationType: 'channel', tenantId: 'tenant-1' },
      }),
    );
    await kit.drain();
    expect(kit.sent.some((s) => s.url.endsWith('/v3/conversations'))).toBe(true);
    const answered = kit.sent.find((s) =>
      s.url.includes('/v3/conversations/personal-1/activities'),
    );
    expect(JSON.stringify(answered?.body)).toContain('Deploys go out on Tuesdays');
    expect(said(kit).at(-1)).toContain('I sent you the answer in a private chat.');
    await kit.call('editor', 'DELETE', '/api/documents/kb/chat/teams');
    const asked = kit.asked.length;
    await teams(kit, activity());
    await kit.drain();
    expect(kit.asked).toHaveLength(asked);
    expect(said(kit).at(-1)).toContain("isn't connected");
  });

  it("previews a pasted page link in the paster's access", async () => {
    const kit = await chatKit();
    await connectTeams(kit);
    const invoke = (over = {}) =>
      teams(
        kit,
        activity({
          type: 'invoke',
          name: 'composeExtension/queryLink',
          value: { url: 'https://www.liveknowledge.app/document/kb#t=deploys' },
          ...over,
        }),
      );
    expect(JSON.stringify(await (await invoke()).json())).toContain('"type":"auth"');
    await teams(kit, activity());
    await kit.drain();
    await linkUser(kit, linkIn(said(kit).at(-1)!), 'user_o');
    const card = JSON.stringify(await (await invoke()).json());
    expect(card).toContain('Deploys');
    expect(card).toContain('Tuesdays after the morning standup');
  });
});
