// Every server fetch of a URL someone gave refuses the same hosts, by the one shared rule (model-core's private-host;
// liveworkspace/docs/specs/002-architecture/architecture.md "Fetching a URL someone gave"): the webhooks' and live
// status's check (parsePublicHttpsUrl), the image upload by URL (fetchPublicBytes) and the link unfurl (isBlockedHost).
import { parsePublicHttpsUrl } from '@liveworkspace/model-core/public-https-url';
import { describe, expect, it } from 'vitest';
import { fetchPublicBytes, type PublicFetchOptions } from './public-fetch';
import { isBlockedHost, parsePublicHttpUrl } from './unfurl';

// The fetch and the resolver both answer as if the host were public, so only the host's spelling can refuse it.
const spellingOnly = (): PublicFetchOptions & { asked: () => number } => {
  let asked = 0;
  return {
    maxBytes: 16,
    resolve: async () => {
      asked += 1;
      return ['93.184.216.34'];
    },
    fetch: async () => {
      asked += 1;
      return new Response(new Uint8Array([1]));
    },
    asked: () => asked,
  };
};

// Each host as an https URL spells it on 443.
const PRIVATE_HOSTS = [
  // Internal names.
  'localhost',
  'localhost.',
  'app.localhost',
  'printer.local',
  'printer.local.',
  'metadata',
  'instance-data',
  'intranet',
  'metadata.google.internal',
  'db.internal',
  'router.lan',
  'nas.home.arpa',
  'wiki.intranet',
  // IPv4, as typed and as a URL turns other spellings into dotted decimal.
  '0.0.0.0',
  '0.1.2.3',
  '10.1.2.3',
  '100.64.0.1',
  '100.100.100.200',
  '127.0.0.1',
  '127.1',
  '0x7f000001',
  '2130706433',
  '0177.0.0.1',
  '169.254.169.254',
  '172.16.0.1',
  '172.31.255.255',
  '192.0.0.1',
  '192.0.2.1',
  '192.88.99.1',
  '192.168.1.1',
  '198.18.0.1',
  '198.51.100.7',
  '203.0.113.9',
  '224.0.0.1',
  '240.0.0.1',
  '255.255.255.255',
  // IPv6.
  '[::]',
  '[::1]',
  '[::127.0.0.1]',
  '[::ffff:127.0.0.1]',
  '[::ffff:169.254.169.254]',
  '[::ffff:c0a8:1]',
  '[64:ff9b::a9fe:a9fe]',
  '[fc00::1]',
  '[fd00:ec2::254]',
  '[fe80::1]',
  '[febf::1]',
  '[fec0::1]',
  '[ff02::1]',
  '[2001:db8::1]',
  '[2002:7f00:1::1]',
  '[100::1]',
];

describe('one private-host rule for every server fetch', () => {
  it.each(PRIVATE_HOSTS)('refuses every private, internal and metadata host: %s', async (host) => {
    const url = `https://${host}/a.png`;
    const hostname = new URL(url).hostname;
    expect(parsePublicHttpsUrl(url)).toEqual({ ok: false, error: 'private' });
    expect(isBlockedHost(hostname)).toBe(true);
    expect(parsePublicHttpUrl(url)).toBeNull();
    expect(parsePublicHttpUrl(`http://${host}/`)).toBeNull();
    const options = spellingOnly();
    expect(await fetchPublicBytes(url, options)).toMatchObject({
      ok: false,
      reason: 'private_address',
    });
    expect(options.asked()).toBe(0);
  });

  it('lets a public name through all three', async () => {
    const url = 'https://images.example.com/a.png';
    expect(parsePublicHttpsUrl(url)).toMatchObject({ ok: true, host: 'images.example.com' });
    expect(parsePublicHttpUrl(url)).not.toBeNull();
    expect(await fetchPublicBytes(url, spellingOnly())).toMatchObject({ ok: true });
  });

  it.each(['93.184.216.34', '[2606:4700::1111]', '[::ffff:808:808]'])(
    'lets a public IP literal reach an image upload and an unfurl, never a stored webhook or status URL: %s',
    async (host) => {
      const url = `https://${host}/a.png`;
      expect(parsePublicHttpsUrl(url)).toEqual({ ok: false, error: 'private' });
      expect(isBlockedHost(new URL(url).hostname)).toBe(false);
      const options = spellingOnly();
      expect(await fetchPublicBytes(url, options)).toMatchObject({ ok: true });
      // An address is judged as it stands: only the fetch itself, no lookup.
      expect(options.asked()).toBe(1);
    },
  );
});
