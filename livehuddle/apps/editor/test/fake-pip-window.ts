// A stand-in Document Picture-in-Picture window for the mini view's tests (docs/specs/008-canvas/avatar-mode.md "The
// mini view"): jsdom has no `documentPictureInPicture`, so a test installs one whose `requestWindow` hands back a
// window with its own document, a `close` spy and the listeners the mini view adds.
import { vi } from 'vitest';

export type FakePipWindow = Window & {
  fire: (type: string) => void;
  close: ReturnType<typeof vi.fn>;
};

export function fakePipWindow(): FakePipWindow {
  const doc = document.implementation.createHTMLDocument('pip');
  const handlers = new Map<string, Set<() => void>>();
  const win = {
    document: doc,
    close: vi.fn(),
    addEventListener: vi.fn((type: string, fn: () => void) => {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: () => void) => handlers.get(type)?.delete(fn)),
    fire: (type: string) => handlers.get(type)?.forEach((fn) => fn()),
  };
  return win as unknown as FakePipWindow;
}

type WithPip = { documentPictureInPicture?: unknown };

/** Installs the API on `window`, its `requestWindow` resolving to `pip`; returns the spy. */
export function installPip(pip: FakePipWindow): ReturnType<typeof vi.fn> {
  const requestWindow = vi.fn(async () => pip);
  (window as unknown as WithPip).documentPictureInPicture = { requestWindow };
  return requestWindow;
}

export function removePip(): void {
  delete (window as unknown as WithPip).documentPictureInPicture;
}
