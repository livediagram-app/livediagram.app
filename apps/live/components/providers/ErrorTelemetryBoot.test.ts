import { describe, expect, it } from 'vitest';
import { TELEMETRY_TYPE_PATTERN } from '@livediagram/api-schema';
import { __testing } from './ErrorTelemetryBoot';

const { apiErrorType } = __testing;

// Attribution for api failures (spec/22). Reporting the bare status made a
// spike unreadable: 297 `Http403` in one day says something is being refused
// and nothing about what. The api-client's own intent string supplies the
// missing half.

describe('apiErrorType', () => {
  it('appends the action as one PascalCase token', () => {
    expect(apiErrorType(403, 'save tab')).toBe('Http403.SaveTab');
    expect(apiErrorType(500, 'create diagram')).toBe('Http500.CreateDiagram');
    expect(apiErrorType(429, 'resolve team invite link')).toBe('Http429.ResolveTeamInviteLink');
  });

  // The ingest validator rejects anything outside its pattern and drops the
  // event silently, so a token that fails here is a total loss, not a
  // degraded one. A colon separator would do exactly that.
  it('produces a token the ingest validator accepts', () => {
    const actions = [
      'save tab',
      'save diagram meta',
      'resolve team invite link',
      'notify assigned action',
      'oauth exchange',
      'set share password',
    ];
    for (const action of actions) {
      for (const status of [400, 403, 404, 429, 500]) {
        expect(apiErrorType(status, action)).toMatch(TELEMETRY_TYPE_PATTERN);
      }
    }
  });

  // Nothing user-typed reaches these strings today, but the filter is what
  // guarantees a future action string can't smuggle in a path or an id.
  it('keeps only letters and digits, so a path or id cannot leak', () => {
    expect(apiErrorType(404, 'load /diagrams/8f3e-9a21/tabs')).toBe(
      'Http404.LoadDiagrams8f3e9a21Tabs',
    );
    expect(apiErrorType(403, 'share?code=SEKRIT')).toMatch(TELEMETRY_TYPE_PATTERN);
  });

  it('stays within the 40-character cap', () => {
    const long = apiErrorType(500, 'an extraordinarily long action name that keeps going');
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long).toMatch(TELEMETRY_TYPE_PATTERN);
  });

  it('falls back to the bare status when the action has no usable characters', () => {
    expect(apiErrorType(500, '')).toBe('Http500');
    expect(apiErrorType(500, '---')).toBe('Http500');
  });
});
