// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livedesign/document';
import { EditorContextMenu } from './EditorContextMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// docs/specs/008-canvas/element-shadows.md: an image carries a shadow, set from the Shadow section in the Style
// flyout. An image has no colours, border or looks, so the flyout used to stay shut and the Shadow out of reach.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

function open(target: Element) {
  const given: Record<string, unknown> = {
    menu: { mode: 'element', elementId: target.id, x: 10, y: 10 },
    elements: [target],
    layers: [],
    theme: undefined,
  };
  const props = new Proxy(given, {
    get: (t, k: string) => (k in t ? t[k] : vi.fn()),
    has: () => true,
  }) as unknown as EditorContextMenuProps;
  const Host = () => EditorContextMenu(props);
  render(<Host />);
}

describe('an image’s element menu', () => {
  it('offers Style, where its Shadow lives', () => {
    open({
      id: 'img',
      type: 'image',
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      imageId: null,
    });
    expect(screen.queryAllByRole('button').some((b) => b.textContent?.trim() === 'Style')).toBe(
      true,
    );
  });
});
