// A pack's load calls each waiting rig once (docs/specs/008-canvas/3d-engine.md "Characters"): a rig still waiting on
// the other pack signs up again from its callback, and that new sign-up waits for the next load instead of being
// called in the same pass, which looped forever and hung the page.
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setMeshoptDecoder() {
      return this;
    }
    loadAsync() {
      return Promise.resolve({ scene: new THREE.Group(), animations: [] });
    }
  },
}));

import { loadGamePack, onGamePack } from './game-figure';

describe('a pack load', () => {
  it('calls a listener that signs up again only once', async () => {
    // A pack loads only in a browser.
    vi.stubGlobal('window', globalThis);
    let calls = 0;
    let off: (() => void) | null = null;
    const waitForWomen = () => {
      calls += 1;
      // Bounded, so a regression fails instead of hanging the run.
      if (calls > 50) return;
      off?.();
      off = onGamePack(waitForWomen);
    };
    off = onGamePack(waitForWomen);
    await loadGamePack('men');
    expect(calls).toBe(1);
    off?.();
    vi.unstubAllGlobals();
  });
});
