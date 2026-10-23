import { describe, expect, it } from 'vitest';
import { platformEmitters } from './platform-emitters';

// The accounts Worker counts each onboarding email it sends under the app it speaks for; every app's
// dashboard charts these five kinds (<app>/catalogue/email.ts), checked by its metric-emitters test.
describe('platform emitters', () => {
  it('see the accounts Worker’s onboarding emails, each kind by name', () => {
    const sent = [
      ...new Set(
        platformEmitters()
          .filter((e) => e.category === 'Email' && e.action === 'Sent')
          .map((e) => e.type),
      ),
    ].sort();
    expect(sent).toEqual(['Activation', 'Week1', 'Week2', 'Welcome', 'WinBack']);
    expect(platformEmitters().every((e) => e.path.startsWith('liveworkspace/apps/accounts/'))).toBe(
      true,
    );
  });
});
