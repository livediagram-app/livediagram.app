import { describe, expect, it } from 'vitest';
import { addressRange, expandIpv6, visitorAddress } from './network';
import { WORKSPACE_CLIENT_IP_HEADER, WORKSPACE_PROXY_HEADER } from './workspace-proxy';

const request = (headers: Record<string, string>) =>
  new Request('https://liveworkspace.app/api/auth/guest', { headers });

describe('visitorAddress', () => {
  it("is the connection's own address for a direct visitor", () => {
    expect(visitorAddress(request({ 'CF-Connecting-IP': '203.0.113.7' }))).toEqual({
      address: '203.0.113.7',
      via: false,
    });
    expect(visitorAddress(request({}))).toEqual({ address: 'unknown', via: false });
  });

  it("is the address a router names, only beside the router's mark", () => {
    const named = {
      'CF-Connecting-IP': '198.51.100.1',
      [WORKSPACE_CLIENT_IP_HEADER]: '203.0.113.7',
    };
    expect(visitorAddress(request({ ...named, [WORKSPACE_PROXY_HEADER]: 'livediagram' }))).toEqual({
      address: '203.0.113.7',
      via: true,
    });
    expect(visitorAddress(request(named)).address).toBe('198.51.100.1');
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
