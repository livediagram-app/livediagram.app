// Where a webhook may send: HTTPS on 443 to a name resolving only to public addresses (webhooks.md "Security").
import { describe, expect, it } from 'vitest';
import { parseWebhookUrl } from './address';

describe('parseWebhookUrl', () => {
  it('takes an HTTPS URL on 443 with a host name, keeping its host', () => {
    const ok = parseWebhookUrl('https://Hooks.Example.com:443/in?x=1', 'json');
    expect(ok).toMatchObject({ ok: true, host: 'hooks.example.com' });
    expect(parseWebhookUrl('https://example.com./x', 'json')).toMatchObject({
      host: 'example.com',
    });
  });

  it.each([
    ['not a string', 42],
    ['empty', ''],
    ['too long', `https://example.com/${'a'.repeat(2048)}`],
    ['not a URL', 'example.com/hook'],
    ['plain HTTP', 'http://example.com/hook'],
    ['credentials', 'https://user:pass@example.com/hook'],
    ['another port', 'https://example.com:8443/hook'],
  ])('refuses %s as invalid', (_, url) => {
    expect(parseWebhookUrl(url, 'json')).toEqual({ ok: false, error: 'webhook_url_invalid' });
  });

  it.each([
    'https://127.0.0.1/hook',
    'https://0x7f000001/hook',
    'https://8.8.8.8/hook',
    'https://[::1]/hook',
    'https://localhost/hook',
    'https://intranet/hook',
    'https://printer.local/hook',
    'https://db.internal/hook',
    'https://nas.home.arpa/hook',
    'https://router.lan/hook',
    'https://a.localhost/hook',
  ])('refuses %s as private: an address, or a name that never leaves a network', (url) => {
    expect(parseWebhookUrl(url, 'json')).toEqual({ ok: false, error: 'webhook_url_private' });
  });

  it('holds Slack and Teams to their own hosts', () => {
    expect(parseWebhookUrl('https://hooks.slack.com/services/T/B/x', 'slack').ok).toBe(true);
    expect(parseWebhookUrl('https://hooks.slack.com/other', 'slack').ok).toBe(false);
    expect(parseWebhookUrl('https://example.com/services/T', 'slack').ok).toBe(false);
    const flow =
      'https://prod-01.westus.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke';
    expect(parseWebhookUrl(flow, 'teams').ok).toBe(true);
    const direct =
      'https://default1.ab.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/1';
    expect(parseWebhookUrl(direct, 'teams').ok).toBe(true);
    expect(parseWebhookUrl('https://outlook.office.com/webhook/x', 'teams').ok).toBe(false);
  });
});
