import { describe, expect, it } from 'vitest';
import { driveUiMode, googleProjectNumber } from './config';

describe('driveUiMode', () => {
  it('follows the worker, only when the build has a client id', () => {
    expect(driveUiMode('broker', 'id')).toBe('broker');
    expect(driveUiMode('browser', 'id')).toBe('browser');
    expect(driveUiMode('broker', '')).toBe('off');
    expect(driveUiMode(undefined, 'id')).toBe('off');
    expect(driveUiMode('off', 'id')).toBe('off');
  });
});

describe('googleProjectNumber', () => {
  it('reads the project number off the client id', () => {
    expect(googleProjectNumber('123456789012-abc.apps.googleusercontent.com')).toBe('123456789012');
    expect(googleProjectNumber('weird')).toBeNull();
  });
});
