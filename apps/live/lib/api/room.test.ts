import { describe, expect, it } from 'vitest';
import { roomQueryString } from './room';

describe('roomQueryString (realtime auth params, spec/04 + spec/24)', () => {
  it('maps each identifier to its short key', () => {
    expect(roomQueryString({ shareCode: 'C', ownerId: 'O', ticket: 'T' }, 'P')).toBe(
      't=T&s=C&o=O&p=P',
    );
  });

  it('returns an empty string when nothing is set', () => {
    expect(roomQueryString({}, null)).toBe('');
  });

  it('strips null / undefined / empty values so the URL stays clean', () => {
    expect(roomQueryString({ shareCode: null, ownerId: 'O', ticket: undefined }, null)).toBe('o=O');
    expect(roomQueryString({ shareCode: '' }, '')).toBe('');
  });

  it('carries the session share password independently of the options', () => {
    expect(roomQueryString({}, 'secret')).toBe('p=secret');
  });

  it('url-encodes values', () => {
    expect(roomQueryString({ ownerId: 'a b&c' }, null)).toBe('o=a+b%26c');
  });
});
