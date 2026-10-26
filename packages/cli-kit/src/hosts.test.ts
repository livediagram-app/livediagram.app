import { describe, expect, it } from 'vitest';
import { sameHost } from './hosts';

describe('sameHost', () => {
  it('takes a file pulled from the bare domain as the www. default host, and the other way round', () => {
    expect(sameHost('https://liveplanner.app', 'https://www.liveplanner.app')).toBe(true);
    expect(sameHost('https://www.livedesign.app/', 'https://livedesign.app')).toBe(true);
    expect(sameHost('https://liveplanner.app', 'https://liveplanner.app/')).toBe(true);
  });

  it('keeps every other host apart', () => {
    expect(sameHost('https://staging.liveplanner.app', 'https://www.liveplanner.app')).toBe(false);
    expect(sameHost('https://liveplanner.app', 'https://livedocuments.app')).toBe(false);
    expect(sameHost('http://localhost:3200', 'http://localhost:3201')).toBe(false);
    expect(sameHost('http://liveplanner.app', 'https://liveplanner.app')).toBe(false);
  });

  it('throws on a value that is not a URL', () => {
    expect(() => sameHost('not a url', 'https://www.liveplanner.app')).toThrow();
  });
});
