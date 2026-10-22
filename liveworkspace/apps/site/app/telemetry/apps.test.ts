import { describe, expect, it } from 'vitest';
import { appFilterOf, searchWithApp, summaryUrl } from './apps';

describe('app filter', () => {
  it('reads a known app from the query, and anything else as every app', () => {
    expect(appFilterOf('?app=livediagram.app')).toBe('livediagram.app');
    expect(appFilterOf('?app=liveplanner.app&x=1')).toBe('liveplanner.app');
    expect(appFilterOf('')).toBe('all');
    expect(appFilterOf('?app=example.com')).toBe('all');
  });

  it('writes the filter back, leaving every app out of the URL', () => {
    expect(searchWithApp('', 'liveplanner.app')).toBe('?app=liveplanner.app');
    expect(searchWithApp('?app=liveplanner.app&x=1', 'all')).toBe('?x=1');
    expect(searchWithApp('?app=liveplanner.app', 'all')).toBe('');
  });

  it('asks the service for the filter it shows', () => {
    expect(summaryUrl('all')).toBe('/api/telemetry/summary?app=all');
    expect(summaryUrl('livediagram.app')).toBe('/api/telemetry/summary?app=livediagram.app');
  });
});
