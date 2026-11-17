import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { isAnthropicEgress } from './anthropic-egress';

describe('isAnthropicEgress (160.79.104.0/21)', () => {
  it('takes the whole range and nothing either side of it', () => {
    for (const ip of ['160.79.104.0', '160.79.104.17', '160.79.108.200', '160.79.111.255'])
      expect(isAnthropicEgress(ip), ip).toBe(true);
    for (const ip of ['160.79.103.255', '160.79.112.0', '160.78.104.1', '161.79.104.1', '10.0.0.1'])
      expect(isAnthropicEgress(ip), ip).toBe(false);
  });

  it('refuses anything that is not a plain IPv4 address', () => {
    for (const key of [
      'unknown',
      '2001:db8::/64',
      '160.79.104',
      '160.79.104.1.1',
      '160.79.104.',
      '160.79.104.256',
      '160.79.1o4.1',
      '160.79.0104.1',
    ])
      expect(isAnthropicEgress(key), key).toBe(false);
  });

  it('reads a very long key within a CPU budget', () => {
    const long = '1'.repeat(50_000);
    expect(cpuMsOf(() => isAnthropicEgress(`${long}.${long}.${long}.${long}`))).toBeLessThan(
      cpuBudgetMs(50),
    );
  });
});
