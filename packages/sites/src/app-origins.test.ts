import { describe, expect, it } from 'vitest';
import { appOfAnyOrigin, appOfOrigin, appOrigins } from './app-origins';

describe("each app's origins", () => {
  it('are its bare and www hosts in production, staging. on staging, its router port locally', () => {
    expect(appOrigins('livediagram.app', 'production')).toEqual([
      'https://livediagram.app',
      'https://www.livediagram.app',
    ]);
    expect(appOrigins('liveplanner.app', 'staging')).toEqual(['https://staging.liveplanner.app']);
    expect(appOrigins('livedesign.app', 'development')).toContain('http://localhost:3400');
  });

  it('match exactly, in their own environment only', () => {
    expect(appOfOrigin('https://www.livedocuments.app', 'production')).toBe('livedocuments.app');
    expect(appOfOrigin('https://www.livedocuments.app/path?x', 'production')).toBe(
      'livedocuments.app',
    );
    expect(appOfOrigin('http://localhost:3100', 'production')).toBeNull();
    expect(appOfOrigin('https://staging.livediagram.app', 'production')).toBeNull();
    expect(appOfOrigin('https://livediagram.app.evil.example', 'production')).toBeNull();
    expect(appOfOrigin('https://evil.livediagram.app', 'production')).toBeNull();
    expect(appOfOrigin('http://livediagram.app', 'production')).toBeNull();
    expect(appOfOrigin('https://liveworkspace.app', 'production')).toBeNull();
    expect(appOfOrigin('not a url', 'production')).toBeNull();
    expect(appOfAnyOrigin('http://localhost:3200')).toBe('liveplanner.app');
    expect(appOfAnyOrigin('http://localhost:3000')).toBeNull();
  });
});
