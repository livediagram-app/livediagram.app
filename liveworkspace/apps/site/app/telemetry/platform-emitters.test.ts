import { describe, expect, it } from 'vitest';
import { isValidTelemetryEvent as isLivediagramEvent } from '@livediagram/api-schema';
import { isValidTelemetryEvent as isLiveplannerEvent } from '@liveplanner/api-schema';
import { EXPLORER_TELEMETRY_EVENTS } from '@liveworkspace/telemetry';
import { EXPLORER_EMITTER, platformComputedEmitters, platformEmitters } from './platform-emitters';

// The accounts Worker counts each onboarding email it sends under the app it speaks for, and each team
// email under the app the inviter signed up through, and each expiring-token warning under the app
// the token's owner signed up through; every app's dashboard charts these kinds
// (<app>/catalogue/email.ts), checked by its metric-emitters and metric-series tests.
describe('platform emitters', () => {
  it('see the accounts Worker’s onboarding, team and token emails, each kind by name', () => {
    const sent = [
      ...new Set(
        platformEmitters()
          .filter((e) => e.category === 'Email' && e.action === 'Sent')
          .map((e) => e.type),
      ),
    ].sort();
    expect(sent).toEqual([
      'Activation',
      'InviteResponse',
      'TeamInvite',
      'TeamInviteReminder1',
      'TeamInviteReminder2',
      'TeamInviteReminder3',
      'TokenExpiring',
      'Week1',
      'Week2',
      'Welcome',
      'WinBack',
    ]);
    expect(
      platformEmitters()
        .filter((e) => e.category === 'Email')
        .every((e) => e.path.startsWith('liveworkspace/apps/accounts/')),
    ).toBe(true);
  });

  it('see every one of the Explorer’s events on liveworkspace.app, and only those', () => {
    const explorer = platformEmitters().filter((e) => e.path === EXPLORER_EMITTER);
    const pairs = new Set(explorer.map((e) => `${String(e.category)}·${String(e.action)}`));
    expect([...pairs].sort()).toEqual(Object.keys(EXPLORER_TELEMETRY_EVENTS).sort());
    // Its computed types are declared from the Explorer's list, one site per pair.
    const computed = platformComputedEmitters();
    for (const [site, { values }] of Object.entries(computed)) {
      const pair = site.slice(EXPLORER_EMITTER.length + 1);
      expect(values).toEqual(
        (EXPLORER_TELEMETRY_EVENTS as Record<string, readonly (string | null)[]>)[pair],
      );
    }
    expect(Object.keys(computed).length).toBeGreaterThan(10);
  });

  it('give each app only what its vocabulary takes: a revoked pass under its own noun', () => {
    const planner = platformEmitters(isLiveplannerEvent);
    const diagram = platformEmitters(isLivediagramEvent);
    const has = (emits: typeof planner, category: string) =>
      emits.some((e) => e.category === category && e.action === 'Removed');
    expect(has(planner, 'Project')).toBe(true);
    expect(has(planner, 'Document')).toBe(false);
    expect(has(diagram, 'Document')).toBe(true);
    expect(has(diagram, 'Project')).toBe(false);
  });
});
