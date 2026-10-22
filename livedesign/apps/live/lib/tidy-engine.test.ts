import { describe, expect, it, vi } from 'vitest';

// docs/specs/008-canvas/blueprints/tidy-up.md "Performance and limits": the tidiers stay out of the first load
// and arrive on demand; a command run before they arrive runs once they do.

async function freshEngine() {
  vi.resetModules();
  return import('./tidy-engine');
}

// A fresh module graph transforms the whole layout package once: give it room.
const COLD_IMPORT_MS = 30_000;

describe('tidy engine', () => {
  it(
    'is not there until asked for, then is the same engine every time',
    async () => {
      const m = await freshEngine();
      expect(m.tidyEngine()).toBeNull();
      const a = await m.loadTidyEngine();
      expect(m.tidyEngine()).toBe(a);
      expect(await m.loadTidyEngine()).toBe(a);
      expect(typeof a.cleanupElements).toBe('function');
    },
    COLD_IMPORT_MS,
  );

  it(
    'runs a command at once when loaded, and once it arrives otherwise',
    async () => {
      const m = await freshEngine();
      const go = vi.fn();
      m.withTidyEngine(go);
      expect(go).not.toHaveBeenCalled();
      const engine = await m.loadTidyEngine();
      expect(go).toHaveBeenCalledWith(engine);
      m.withTidyEngine(go);
      expect(go).toHaveBeenCalledTimes(2);
    },
    COLD_IMPORT_MS,
  );
});
