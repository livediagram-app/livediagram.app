// The one private-host rule every server fetch of a URL someone gave shares
// (liveworkspace/docs/specs/002-architecture/architecture.md "Fetching a URL someone gave").
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import {
  classifyHost,
  isInternalHostName,
  isPrivateAddress,
  parseIpv4,
  parseIpv6,
} from './private-host';

describe('parseIpv4', () => {
  it('reads four decimal parts', () => {
    expect(parseIpv4('0.0.0.0')).toBe(0);
    expect(parseIpv4('127.0.0.1')).toBe(0x7f000001);
    expect(parseIpv4('255.255.255.255')).toBe(0xffffffff);
  });

  it.each([
    '',
    '1.2.3',
    '1.2.3.4.5',
    '1.2.3.',
    '.1.2.3',
    '1..2.3',
    '256.0.0.1',
    '01.2.3.4',
    '1.2.3.1234',
    '1.2.3.a',
    '+1.2.3.4',
    '1.2.3.4 ',
    '0x7f.0.0.1',
    '1111.1.1.1111',
  ])('refuses %j', (text) => {
    expect(parseIpv4(text)).toBeNull();
  });
});

describe('parseIpv6', () => {
  it.each([
    ['::', [0, 0, 0, 0, 0, 0, 0, 0]],
    ['::1', [0, 0, 0, 0, 0, 0, 0, 1]],
    ['1::', [1, 0, 0, 0, 0, 0, 0, 0]],
    ['fe80::1:2', [0xfe80, 0, 0, 0, 0, 0, 1, 2]],
    ['2606:4700:0:0:0:0:0:1111', [0x2606, 0x4700, 0, 0, 0, 0, 0, 0x1111]],
    ['::ffff:127.0.0.1', [0, 0, 0, 0, 0, 0xffff, 0x7f00, 1]],
    ['1:2:3:4:5:6:1.2.3.4', [1, 2, 3, 4, 5, 6, 0x102, 0x304]],
    ['FD00:EC2::254', [0xfd00, 0xec2, 0, 0, 0, 0, 0, 0x254]],
  ])('reads %s', (text, words) => {
    expect(parseIpv6(text)).toEqual(words);
  });

  it.each([
    '',
    ':',
    ':1',
    ':::',
    '1:2',
    '1:2:3:4:5:6:7',
    '1:2:3:4:5:6:7:8:9',
    '1::2::3',
    '1:',
    '1:2:3:4:5:6:7:',
    '12345::1',
    'g::1',
    '1:2:3:4:5:6:7:8::',
    '1::2:3:4:5:6:7:8',
    '::1.2.3',
    '::ab.1.2.3',
    '1:2:3:4:5:6:7:1.2.3.4',
    '::1 ',
    'fe80::1%eth0',
    `::${'1:'.repeat(30)}1`,
  ])('refuses %j', (text) => {
    expect(parseIpv6(text)).toBeNull();
  });
});

describe('isPrivateAddress', () => {
  it.each([
    '0.1.2.3',
    '10.0.0.1',
    '100.64.0.1',
    '100.100.100.200', // Alibaba Cloud metadata, in carrier NAT
    '127.0.0.1',
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
    '255.255.255.255',
    '::',
    '::1',
    '::7f00:1',
    '::ffff:10.0.0.1',
    '::ffff:a9fe:a9fe',
    '64:ff9b::a00:1',
    'fc00::1',
    'fd00:ec2::254', // AWS metadata over IPv6
    'fe80::1',
    'febf::1',
    'fec0::1',
    'ff02::1',
    '2001:db8::1',
    '2002:a00:1::1',
    '100::1',
    'not an address',
    '300.1.1.1',
  ])('blocks %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '172.32.0.1',
    '104.16.0.1',
    '2606:4700::1111',
    '::ffff:8.8.8.8',
    '64:ff9b::808:808',
    '100:1::1',
    '2001:db9::1',
  ])('lets %s through', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe('isInternalHostName', () => {
  it.each([
    '',
    'localhost',
    'metadata',
    'instance-data',
    'app.localhost',
    'printer.local',
    'metadata.google.internal',
    'router.lan',
    'nas.home.arpa',
    'wiki.intranet',
    'example.',
    'a.1',
    'a.0x7f',
    'a.0x',
  ])('counts %j as internal', (name) => {
    expect(isInternalHostName(name)).toBe(true);
  });

  it.each(['example.com', 'fdic.gov', 'fe80.example.com', 'a.1x', 'a.0xg', 'local.example.com'])(
    'counts %s as public',
    (name) => {
      expect(isInternalHostName(name)).toBe(false);
    },
  );
});

describe('classifyHost', () => {
  it('reads an address, public or private, as one', () => {
    expect(classifyHost('93.184.216.34')).toEqual({
      host: '93.184.216.34',
      kind: 'address',
      private: false,
    });
    expect(classifyHost('169.254.169.254')).toMatchObject({ kind: 'address', private: true });
    expect(classifyHost('[2606:4700::1111]')).toEqual({
      host: '2606:4700::1111',
      kind: 'address',
      private: false,
    });
    expect(classifyHost('[::1]')).toMatchObject({ kind: 'address', private: true });
    expect(classifyHost('::ffff:7f00:1')).toMatchObject({ kind: 'address', private: true });
  });

  it('counts a host with a colon or bracket that is no IPv6 address as private', () => {
    for (const h of ['[1.2.3.4]', '[nope]', 'a:b', '[::1', 'x]']) {
      expect(classifyHost(h), h).toMatchObject({ kind: 'address', private: true });
    }
  });

  it('reads anything else as a name, lower-cased with one trailing dot dropped', () => {
    expect(classifyHost('Example.COM.')).toEqual({
      host: 'example.com',
      kind: 'name',
      private: false,
    });
    expect(classifyHost('LOCALHOST.')).toEqual({ host: 'localhost', kind: 'name', private: true });
    expect(classifyHost('01.2.3.4')).toMatchObject({ kind: 'name', private: true });
  });

  it('reads a long hostile host in linear time', () => {
    const hostile = [
      '1.'.repeat(25_000),
      '9'.repeat(50_000),
      ':'.repeat(50_000),
      `[${'f'.repeat(50_000)}]`,
      `${'1:'.repeat(25_000)}x`,
      `${'a.'.repeat(25_000)}local!`,
    ];
    const ms = cpuMsOf(() => {
      for (const h of hostile) classifyHost(h);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });
});
