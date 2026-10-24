import { describe, expect, it } from 'vitest';
import { clientIp, clientNetwork, clientRateKey } from './client-ip';

const req = (ip?: string) =>
  new Request('https://x.test/', { headers: ip ? { 'CF-Connecting-IP': ip } : {} });

describe('clientRateKey', () => {
  it('keeps an IPv4 address exact', () => {
    expect(clientRateKey(req('203.0.113.7'))).toBe('203.0.113.7');
  });

  // One host is routinely handed a whole /64, so every address in it must
  // share one bucket or rotating addresses defeats the limiter.
  it('keys IPv6 on the /64', () => {
    const a = clientRateKey(req('2001:db8:1:2:aaaa::1'));
    const b = clientRateKey(req('2001:db8:1:2:ffff:ffff:ffff:ffff'));
    expect(a).toBe('2001:0db8:0001:0002::/64');
    expect(b).toBe(a);
    expect(clientRateKey(req('2001:db8:1:3::1'))).not.toBe(a);
  });

  it('falls back to one shared bucket without the header', () => {
    expect(clientRateKey(req())).toBe('anonymous');
    expect(clientIp(req(), 'unknown')).toBe('unknown');
  });
});

describe('clientNetwork', () => {
  it('keeps an IPv4 address to its /24', () => {
    expect(clientNetwork('203.0.113.7')).toBe('203.0.113.0/24');
    expect(clientNetwork('203.0.113.250')).toBe('203.0.113.0/24');
    expect(clientNetwork('203.0.114.7')).toBe('203.0.114.0/24');
  });

  it('keeps an IPv6 address to its /56, however it is written', () => {
    const net = '2001:0db8:0aaa:bb00::/56';
    expect(clientNetwork('2001:db8:aaa:bb12::1')).toBe(net);
    expect(clientNetwork('2001:db8:aaa:bbff:1:2:3:4')).toBe(net);
    expect(clientNetwork('2001:DB8:AAA:BB00:0:0:0:9')).toBe(net);
    expect(clientNetwork('2001:db8:aaa:bc00::1')).not.toBe(net);
    expect(clientNetwork('::1')).toBe('0000:0000:0000:0000::/56');
    expect(clientNetwork('::ffff:203.0.113.7')).toBe('0000:0000:0000:0000::/56');
    expect(clientNetwork('fe80::1%eth0')).toBe('fe80:0000:0000:0000::/56');
  });

  it('treats anything else as its own network', () => {
    expect(clientNetwork('unknown')).toBe('unknown');
    expect(clientNetwork('1:2:3')).toBe('1:2:3');
    expect(clientNetwork('1::2::3')).toBe('1::2::3');
    expect(clientNetwork('')).toBe('');
  });
});
