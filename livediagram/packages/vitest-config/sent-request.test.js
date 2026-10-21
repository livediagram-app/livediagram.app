import { describe, expect, it } from 'vitest';
import { sentForm, sentJson, sentText, sentUrl } from './sent-request.js';

// docs/specs/003-system-architecture/testing.md "A stubbed fetch reads what it was sent".

describe('sentText and sentJson', () => {
  it('read the string body a request was sent with', () => {
    expect(sentText({ method: 'POST', body: 'hi' })).toBe('hi');
    expect(sentJson({ method: 'POST', body: '{"a":[1,2]}' })).toEqual({ a: [1, 2] });
  });

  it('refuse a request with no body, or a body that is not a string', () => {
    expect(() => sentJson(undefined)).toThrow(/no body/);
    expect(() => sentJson({ method: 'GET' })).toThrow(/no body/);
    expect(() => sentText({ body: new Blob(['{}']) })).toThrow(/\[object Blob\]/);
  });
});

describe('sentForm', () => {
  it('reads a form sent as URLSearchParams or as its string encoding', () => {
    expect(sentForm({ body: new URLSearchParams('a=1&b=2') }).get('b')).toBe('2');
    expect(sentForm({ body: 'token=t1' }).get('token')).toBe('t1');
    expect(() => sentForm({})).toThrow(/no body/);
  });
});

describe('sentUrl', () => {
  it('reads the URL of a string, a URL or a Request', () => {
    expect(sentUrl('https://x.test/a?b=1')).toBe('https://x.test/a?b=1');
    expect(sentUrl(new URL('https://x.test/a'))).toBe('https://x.test/a');
    expect(sentUrl(new Request('https://x.test/r'))).toBe('https://x.test/r');
  });
});
