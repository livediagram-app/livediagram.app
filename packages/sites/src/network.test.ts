import { describe, expect, it } from 'vitest';
import {
  addressRange,
  expandIpv6,
  trustedClientAddress,
  unmappedAddress,
  visitorAddress,
} from './network';
import {
  WORKSPACE_CLIENT_IP_HEADER,
  WORKSPACE_PROXY_HEADER,
  WORKSPACE_PROXY_SECRET_HEADER,
} from './workspace-proxy';

const request = (headers: Record<string, string>) =>
  new Request('https://liveworkspace.app/api/auth/guest', { headers });

const SECRET = 'router-secret-0123456789';

describe('trustedClientAddress', () => {
  const named = { 'CF-Connecting-IP': '198.51.100.1', [WORKSPACE_CLIENT_IP_HEADER]: '203.0.113.7' };

  it('is null when no address is named', () => {
    expect(trustedClientAddress(request({ 'CF-Connecting-IP': '198.51.100.1' }), SECRET)).toBe(
      null,
    );
    expect(trustedClientAddress(request({ [WORKSPACE_CLIENT_IP_HEADER]: '  ' }), undefined)).toBe(
      null,
    );
  });

  it("believes the named address beside the routers' secret", () => {
    expect(
      trustedClientAddress(request({ ...named, [WORKSPACE_PROXY_SECRET_HEADER]: SECRET }), SECRET),
    ).toBe('203.0.113.7');
    // The receiver's own value is read as it is set, stray spaces and all.
    expect(
      trustedClientAddress(
        request({ ...named, [WORKSPACE_PROXY_SECRET_HEADER]: SECRET }),
        ` ${SECRET}\n`,
      ),
    ).toBe('203.0.113.7');
  });

  it('ignores a spoofed address: no proof, a wrong one, a prefix, a longer one', () => {
    for (const proof of [undefined, 'guess', SECRET.slice(0, -1), `${SECRET}x`, '']) {
      const headers =
        proof === undefined ? named : { ...named, [WORKSPACE_PROXY_SECRET_HEADER]: proof };
      expect(trustedClientAddress(request(headers), SECRET)).toBe(null);
    }
  });

  it('believes it as named while the receiver has no secret set (the rollout)', () => {
    expect(trustedClientAddress(request(named), undefined)).toBe('203.0.113.7');
    expect(trustedClientAddress(request(named), '  ')).toBe('203.0.113.7');
  });
});

describe('visitorAddress', () => {
  it("is the connection's own address for a direct visitor", () => {
    expect(visitorAddress(request({ 'CF-Connecting-IP': '203.0.113.7' }), SECRET)).toEqual({
      address: '203.0.113.7',
      via: false,
    });
    expect(visitorAddress(request({}), SECRET)).toEqual({ address: 'unknown', via: false });
  });

  it("is the address a router names, only beside the router's mark and proof", () => {
    const named = {
      'CF-Connecting-IP': '198.51.100.1',
      [WORKSPACE_CLIENT_IP_HEADER]: '203.0.113.7',
    };
    const marked = { ...named, [WORKSPACE_PROXY_HEADER]: 'livediagram' };
    expect(
      visitorAddress(request({ ...marked, [WORKSPACE_PROXY_SECRET_HEADER]: SECRET }), SECRET),
    ).toEqual({ address: '203.0.113.7', via: true });
    expect(visitorAddress(request(named), undefined).address).toBe('198.51.100.1');
    // A direct caller naming an address and an app, without the proof: its own connection counts.
    expect(visitorAddress(request(marked), SECRET)).toEqual({
      address: '198.51.100.1',
      via: false,
    });
    expect(
      visitorAddress(request({ ...marked, [WORKSPACE_PROXY_SECRET_HEADER]: 'guess' }), SECRET),
    ).toEqual({ address: '198.51.100.1', via: false });
    // No secret set on the receiver: as before.
    expect(visitorAddress(request(marked), undefined)).toEqual({
      address: '203.0.113.7',
      via: true,
    });
  });
});

describe('addressRange', () => {
  it('is the IPv4 /24 and the IPv6 /48, however the address is written', () => {
    expect(addressRange('203.0.113.7')).toBe('203.0.113.0/24');
    expect(addressRange('2001:db8:aaa:1::1')).toBe('2001:0db8:0aaa::/48');
    expect(addressRange('2001:DB8:AAA:ffff:1:2:3:4')).toBe('2001:0db8:0aaa::/48');
    expect(addressRange('2001::1')).toBe('2001:0000:0000::/48');
    expect(addressRange('unknown')).toBe('unknown');
  });

  it('ranges an IPv4-mapped IPv6 address as its IPv4 address', () => {
    expect(addressRange('::ffff:203.0.113.7')).toBe('203.0.113.0/24');
    expect(addressRange('::ffff:198.51.100.7')).toBe('198.51.100.0/24');
  });

  it('reads an IPv4 tail', () => {
    expect(expandIpv6('::ffff:192.0.2.1')).toEqual([
      '0000',
      '0000',
      '0000',
      '0000',
      '0000',
      'ffff',
      'c000',
      '0201',
    ]);
    expect(expandIpv6('1::2::3')).toBeNull();
  });
});

describe('unmappedAddress', () => {
  it('turns an IPv4-mapped IPv6 address back into IPv4, in either notation', () => {
    expect(unmappedAddress('::ffff:192.0.2.1')).toBe('192.0.2.1');
    expect(unmappedAddress(' ::FFFF:c000:0201 ')).toBe('192.0.2.1');
    expect(unmappedAddress('0:0:0:0:0:ffff:ffff:ffff')).toBe('255.255.255.255');
  });

  it('leaves every other address as it is, trimmed', () => {
    expect(unmappedAddress(' 192.0.2.1 ')).toBe('192.0.2.1');
    expect(unmappedAddress('::1')).toBe('::1');
    expect(unmappedAddress('::ffff:0:0:1')).toBe('::ffff:0:0:1');
    expect(unmappedAddress('1::ffff:192.0.2.1')).toBe('1::ffff:192.0.2.1');
    expect(unmappedAddress('unknown')).toBe('unknown');
  });
});
