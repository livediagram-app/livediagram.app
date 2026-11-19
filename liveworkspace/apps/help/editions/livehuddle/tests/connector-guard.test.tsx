import { describe, expect, it, vi } from 'vitest';
import { scanScenes } from '@liveworkspace/help-site/art/connector-guard';

// liveworkspace/docs/specs/016-help/help-centre.md "A figure cannot forget the mark" (Work Tracker 790): livehuddle's own scenes join
// no two shapes with an arrow left unmarked, which its sticky-only figures would draw as a retired connector. The
// shared kit's scenes have the same guard in packages/help-site.

vi.mock('@liveworkspace/help-site/art/primitives-canvas', async (importOriginal) => {
  const { withRecording } = await import('@liveworkspace/help-site/art/connector-guard');
  return withRecording(
    await importOriginal<typeof import('@liveworkspace/help-site/art/primitives-canvas')>(),
  );
});

describe('livehuddle’s help scenes', () => {
  it('mark each arrow that joins two shapes', () => {
    const modules = import.meta.glob<Record<string, unknown>>(
      ['../components/**/*.tsx', '!../components/**/*.test.tsx'],
      {
        eager: true,
      },
    );
    const { scanned, findings } = scanScenes(modules);
    expect(scanned).toBeGreaterThan(10);
    expect(findings).toEqual([]);
  });
});
