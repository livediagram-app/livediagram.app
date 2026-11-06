// @vitest-environment jsdom
// docs/specs/031-photo/photo-pages.md "Making a photo page": an unstarted photo page's card takes presses whatever
// tool is in hand; the tool's layer, which covers the page, sits under it.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { LaidOutPage } from '@livedesign/design';
import { photoOf } from '@/lib/photo-editor/photo-test-utils';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { PhotoCanvasOverlays, layerListKey } from './PhotoCanvasOverlays';
import { photoView } from './photo-view-test-utils';

const page = {
  id: 'p',
  index: 0,
  orientation: 'landscape',
  kind: 'photo',
  rect: { x: 0, y: 0, width: 400, height: 300 },
} as LaidOutPage;

afterEach(() => {
  cleanup();
  photoTools.take(null);
});

describe('an unstarted photo page with a tool in hand', () => {
  it('draws its Start a Photo card over the tool layer', () => {
    photoTools.take('brush');
    const { view } = photoView(photoOf(16, 12, []), {});
    const { container } = render(
      <PhotoCanvasOverlays pages={[page]} photo={view} zoom={1} spaceHeld={false} />,
    );
    const layer = container.querySelector<HTMLElement>('[data-photo-overlay]')!;
    const card = container.querySelector('[data-start-photo]')!;
    // The tool's layer takes presses...
    expect(layer.style.pointerEvents).toBe('auto');
    // ...and the card comes after it, so it is on top.
    expect(layer.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// photo-tools.md "Accessibility": the Layers list's keys are its own while a row has focus, so the tool in hand
// (the Move tool nudges with the arrows) never takes them.
describe('layerListKey', () => {
  const keyFrom = (target: Element, key: string) => {
    let seen: KeyboardEvent | null = null;
    target.addEventListener('keydown', (e) => (seen = e as KeyboardEvent), { once: true });
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    return seen!;
  };

  it("is the list's for the arrows, Delete and Backspace on a row", () => {
    const { container } = render(
      <ul data-photo-layer-list="">
        <li>
          <button type="button">Layer 1</button>
        </li>
      </ul>,
    );
    const row = container.querySelector('button')!;
    for (const key of ['ArrowUp', 'ArrowDown', 'Delete', 'Backspace']) {
      expect(layerListKey(keyFrom(row, key))).toBe(true);
    }
    // Any other key (a tool's letter, the side arrows) still reaches the photo.
    expect(layerListKey(keyFrom(row, 'v'))).toBe(false);
    expect(layerListKey(keyFrom(row, 'ArrowLeft'))).toBe(false);
  });

  it("is not the list's outside it", () => {
    const { container } = render(<button type="button">Elsewhere</button>);
    expect(layerListKey(keyFrom(container.querySelector('button')!, 'ArrowDown'))).toBe(false);
  });
});
