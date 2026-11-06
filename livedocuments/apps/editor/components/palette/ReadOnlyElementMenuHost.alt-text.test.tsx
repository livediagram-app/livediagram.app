// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createImage, type Element } from '@livedocuments/document';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { ReadOnlyElementMenuHost } from './ReadOnlyElementMenuHost';

// ContextMenu re-clamps on resize; jsdom has no ResizeObserver.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
);

// docs/specs/009-elements/images.md "Alt text" (Roles) and docs/specs/008-canvas/element-menu-quick-bar.md "Element
// menu for Participants and Viewers": a Viewer reads a picture's alt text in its menu and cannot change it; a
// Participant who may write the image's words writes it.

let ctx: Record<string, unknown> = {};
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx }));

const picture = (over: Record<string, unknown> = {}) =>
  ({ ...createImage(0, 0), id: 'pic', imageId: 'img-1', ...over }) as Element;

function open(level: 'view' | 'participate', target: Element, over: Record<string, unknown> = {}) {
  const setImageAlt = vi.fn();
  ctx = {
    contextMenu: { mode: 'element', elementId: target.id, x: 10, y: 10 },
    closeContextMenu: vi.fn(),
    activeTab: { elements: [target] },
    can: resolveEditorCapabilities(level),
    embedMode: false,
    lockedByOther: () => false,
    openComments: vi.fn(),
    followLink: vi.fn(),
    beginEdit: vi.fn(),
    setImageAlt,
    ...over,
  };
  render(<ReadOnlyElementMenuHost />);
  return setImageAlt;
}

afterEach(cleanup);

describe('ReadOnlyElementMenuHost alt text', () => {
  it('lets a Viewer read the alt text and gives it no field to change it', () => {
    const setImageAlt = open('view', picture({ alt: 'A red bicycle' }));
    expect(screen.getByRole('dialog', { name: 'Element menu' })).toBeTruthy();
    expect(screen.getByText('Alt Text')).toBeTruthy();
    expect(screen.getByText('A red bicycle')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(setImageAlt).not.toHaveBeenCalled();
  });

  it('opens the menu for a Viewer on a picture with no alt text, to say there is none', () => {
    open('view', picture());
    expect(screen.getByText('Not described yet')).toBeTruthy();
  });

  it('lets a Participant write it, under its rows', () => {
    const setImageAlt = open('participate', picture({ alt: 'photo.jpg' }));
    expect(screen.getByRole('button', { name: 'Add Comment' })).toBeTruthy();
    const field = screen.getByRole('textbox', { name: 'Alt Text' });
    fireEvent.change(field, { target: { value: 'A harbour at dusk' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(setImageAlt).toHaveBeenCalledExactlyOnceWith('pic', 'A harbour at dusk');
  });

  it('only shows a Participant the words on a locked image, or one someone else holds', () => {
    open('participate', picture({ alt: 'Locked', locked: true }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Locked')).toBeTruthy();
    cleanup();
    open('participate', picture({ alt: 'Held' }), { lockedByOther: () => true });
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('shows nothing about alt text on an image still waiting for its picture', () => {
    open('view', picture({ imageId: null }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Alt Text')).toBeNull();
  });
});
