// The nudge's chime (docs/specs/012-collaboration/blueprints/nudge.md "Constants and configuration").
import { describe, expect, it, vi } from 'vitest';

const playTones = vi.fn();
vi.mock('@/lib/sounds/audio', () => ({ playTones }));

describe('playNudgeChime', () => {
  it('plays E5, A5, E6 louder than the join chime', async () => {
    const { playNudgeChime } = await import('./nudge-chime');
    playNudgeChime();
    expect(playTones).toHaveBeenCalledWith(
      [
        { hz: 659.25, at: 0 },
        { hz: 880, at: 0.12 },
        { hz: 1318.5, at: 0.24 },
      ],
      0.7,
      0.16,
    );
  });
});
