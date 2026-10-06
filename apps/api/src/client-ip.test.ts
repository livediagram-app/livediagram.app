import { describe, expect, it } from 'vitest';
import { clientIp, clientRateKey } from './client-ip';

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
