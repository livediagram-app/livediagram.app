import { describe, expect, it } from 'vitest';
import { platformEmitters } from './platform-emitters';

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
    expect(platformEmitters().every((e) => e.path.startsWith('liveworkspace/apps/accounts/'))).toBe(
      true,
    );
  });
});
