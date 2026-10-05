import { describe, expect, it } from 'vitest';
import { communityNetwork } from './community-network';

describe('communityNetwork', () => {
  it('keeps an IPv4 address to its /24', () => {
    expect(communityNetwork('203.0.113.7')).toBe('203.0.113.0/24');
    expect(communityNetwork('203.0.113.250')).toBe('203.0.113.0/24');
    expect(communityNetwork('203.0.114.7')).toBe('203.0.114.0/24');
  });

  it('keeps an IPv6 address to its /56, however it is written', () => {
    const net = '2001:0db8:0aaa:bb00::/56';
    expect(communityNetwork('2001:db8:aaa:bb12::1')).toBe(net);
    expect(communityNetwork('2001:db8:aaa:bbff:1:2:3:4')).toBe(net);
    expect(communityNetwork('2001:DB8:AAA:BB00:0:0:0:9')).toBe(net);
    expect(communityNetwork('2001:db8:aaa:bc00::1')).not.toBe(net);
    expect(communityNetwork('::1')).toBe('0000:0000:0000:0000::/56');
    expect(communityNetwork('::ffff:203.0.113.7')).toBe('0000:0000:0000:0000::/56');
    expect(communityNetwork('fe80::1%eth0')).toBe('fe80:0000:0000:0000::/56');
  });

  it('treats anything else as its own network', () => {
    expect(communityNetwork('unknown')).toBe('unknown');
    expect(communityNetwork('1:2:3')).toBe('1:2:3');
    expect(communityNetwork('1::2::3')).toBe('1::2::3');
    expect(communityNetwork('')).toBe('');
  });
});
