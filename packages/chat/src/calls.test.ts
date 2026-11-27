import { describe, expect, it, vi } from 'vitest';
import { isSlackResponseUrl, postToResponseUrl, slackCall, slackOAuthAccess } from './slack-api';
import { createBotTokens, personalConversation, sendToConversation } from './teams-connector';

const answering = (body: unknown, status = 200) =>
  vi.fn(async () =>
    typeof body === 'string' ? new Response(body, { status }) : Response.json(body, { status }),
  );
const throwing = vi.fn(async () => {
  throw new Error('down');
});
const exchange = { clientId: 'c', clientSecret: 's', code: 'k', redirectUri: 'https://x/cb' };

describe('Slack calls', () => {
  it('calls a method with the bot token and reads its answer', async () => {
    const fetcher = answering({ ok: true, ts: '1' });
    expect(await slackCall('chat.postMessage', 'xoxb', { a: 1 }, fetcher)).toEqual({
      ok: true,
      ts: '1',
    });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://slack.com/api/chat.postMessage');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer xoxb');
    expect(init.redirect).toBe('manual');
  });
  it('never throws: a failed status, a body that is not JSON and an unreachable Slack', async () => {
    expect(await slackCall('m', 't', {}, answering('x', 500))).toEqual({
      ok: false,
      error: 'http_500',
    });
    expect(await slackCall('m', 't', {}, answering('nope'))).toEqual({
      ok: false,
      error: 'bad_json',
    });
    expect(await slackCall('m', 't', {}, answering(7))).toEqual({
      ok: false,
      error: 'bad_json',
    });
    expect(await slackCall('m', 't', {}, throwing)).toEqual({
      ok: false,
      error: 'unreachable',
    });
  });
  it('exchanges an install code for the bot token, and refuses what it cannot use', async () => {
    const good = {
      ok: true,
      access_token: 'xoxb-1',
      bot_user_id: 'B1',
      team: { id: 'T1', name: 'Acme' },
    };
    expect(await slackOAuthAccess(exchange, answering(good))).toEqual({
      ok: true,
      install: { token: 'xoxb-1', botUser: 'B1', team: { id: 'T1', name: 'Acme' } },
    });
    expect(
      await slackOAuthAccess(exchange, answering({ ...good, team: { id: 'T1' } })),
    ).toMatchObject({ install: { team: { name: 'T1' } } });
    expect(
      await slackOAuthAccess(exchange, answering({ ok: false, error: 'invalid_code' })),
    ).toEqual({ ok: false, error: 'invalid_code' });
    expect(await slackOAuthAccess(exchange, answering({ ok: false }))).toEqual({
      ok: false,
      error: 'refused',
    });
    expect(
      await slackOAuthAccess(exchange, answering({ ...good, is_enterprise_install: true })),
    ).toEqual({ ok: false, error: 'enterprise_install' });
    expect(await slackOAuthAccess(exchange, answering({ ok: true, team: {} }))).toEqual({
      ok: false,
      error: 'bad_answer',
    });
    expect(await slackOAuthAccess(exchange, throwing)).toEqual({
      ok: false,
      error: 'unreachable',
    });
  });
  it('posts to a response_url only on Slack', async () => {
    expect(isSlackResponseUrl('https://hooks.slack.com/actions/1')).toBe(true);
    expect(isSlackResponseUrl('https://hooks.slack.com:444/x')).toBe(false);
    expect(isSlackResponseUrl('https://evil.example/x')).toBe(false);
    expect(isSlackResponseUrl('nope')).toBe(false);
    const fetcher = answering({});
    expect(await postToResponseUrl('https://hooks.slack.com/a', { text: 'x' }, fetcher)).toBe(true);
    expect(await postToResponseUrl('https://evil.example/a', {}, fetcher)).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await postToResponseUrl('https://hooks.slack.com/a', {}, throwing)).toBe(false);
  });
});

describe('Bot Framework calls', () => {
  const creds = { appId: 'app', password: 'pw' };
  it('mints the bot token once and keeps it until it nearly lapses', async () => {
    const fetcher = answering({ access_token: 'bt', expires_in: 3600 });
    const botToken = createBotTokens(fetcher);
    expect(await botToken(creds, 0)).toBe('bt');
    expect(await botToken(creds, 1000)).toBe('bt');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String((fetcher.mock.calls[0] as unknown as [string])[0])).toContain(
      '/botframework.com/',
    );
    await botToken(creds, 3_600_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const tenant = answering({ access_token: 'bt' });
    await createBotTokens(tenant)({ ...creds, tenant: 'tid' }, 0);
    expect(String((tenant.mock.calls[0] as unknown as [string])[0])).toContain('/tid/');
  });
  it('answers null for a refusal, a bad answer or no network', async () => {
    expect(await createBotTokens(answering({}, 401))(creds)).toBeNull();
    expect(await createBotTokens(answering({}))(creds)).toBeNull();
    expect(await createBotTokens(throwing)(creds)).toBeNull();
  });
  it('sends to a conversation, as a reply or not, only on a Teams service', async () => {
    const fetcher = answering({ id: 'a1' });
    const to = {
      serviceUrl: 'https://smba.trafficmanager.net/emea',
      conversationId: 'c/1',
      token: 't',
    };
    expect(await sendToConversation({ ...to, replyTo: 'r1' }, { type: 'message' }, fetcher)).toBe(
      true,
    );
    expect(String((fetcher.mock.calls[0] as unknown as [string])[0])).toBe(
      'https://smba.trafficmanager.net/emea/v3/conversations/c%2F1/activities/r1',
    );
    await sendToConversation({ ...to, serviceUrl: `${to.serviceUrl}/` }, {}, fetcher);
    expect(String((fetcher.mock.calls[1] as unknown as [string])[0])).toBe(
      'https://smba.trafficmanager.net/emea/v3/conversations/c%2F1/activities',
    );
    expect(
      await sendToConversation({ ...to, serviceUrl: 'https://evil.example/' }, {}, fetcher),
    ).toBe(false);
    expect(await sendToConversation(to, {}, answering({}, 500))).toBe(false);
    expect(await sendToConversation(to, {}, answering('not json'))).toBe(true);
    expect(await sendToConversation(to, {}, answering('7'))).toBe(true);
    expect(await sendToConversation(to, {}, throwing)).toBe(false);
  });
  it('opens the personal chat', async () => {
    const to = {
      serviceUrl: 'https://smba.trafficmanager.net/emea/',
      botId: 'b',
      userId: 'u',
      tenantId: 'tn',
      token: 't',
    };
    expect(await personalConversation(to, answering({ id: 'p1' }))).toBe('p1');
    expect(await personalConversation(to, answering({}))).toBeNull();
    expect(
      await personalConversation(
        { ...to, serviceUrl: 'https://evil.example/' },
        answering({ id: 'p' }),
      ),
    ).toBeNull();
  });
});
