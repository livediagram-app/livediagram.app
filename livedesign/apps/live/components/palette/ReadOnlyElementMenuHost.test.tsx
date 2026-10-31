// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createArrow, createShape, type Element } from '@livedesign/design';
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

// docs/specs/008-canvas/element-menu-quick-bar.md "Element menu for Participants and Viewers": the element menu a
// Participant or a Viewer opens holds only what the role may do (docs/specs/013-workspace/share-roles.md).

let ctx: Record<string, unknown>;
vi.mock('@/app/design/[id]/EditorContext', () => ({ useEditorContext: () => ctx }));

const square = (over: Record<string, unknown> = {}) =>
  ({ ...createShape('square', 0, 0), id: 'sq', ...over }) as Element;

function open(level: 'view' | 'participate', target: Element, over: Record<string, unknown> = {}) {
  ctx = {
    contextMenu: { mode: 'element', elementId: target.id, x: 10, y: 10 },
    closeContextMenu: vi.fn(),
    activeTab: { elements: [target] },
    can: resolveEditorCapabilities({ level, adderKey: null }),
    embedMode: false,
    lockedByOther: () => false,
    openComments: vi.fn(),
    openNote: vi.fn(),
    followLink: vi.fn(),
    beginEdit: vi.fn(),
    ...over,
  };
  render(<ReadOnlyElementMenuHost />);
}

const rows = () => screen.queryAllByRole('button').map((b) => b.textContent);

beforeEach(() => {
  ctx = {};
});
afterEach(cleanup);

describe('ReadOnlyElementMenuHost', () => {
  it('gives a Participant comments, its words and what the element carries', () => {
    open(
      'participate',
      square({
        label: 'Login',
        link: { kind: 'url', url: 'https://example.com' },
        note: 'Remember',
      }),
    );
    expect(screen.getByText('Square')).toBeTruthy();
    expect(rows()).toEqual(['Add Comment', 'Edit Text', 'Open Link', 'View Note', 'Copy Text']);
  });

  it('gives a Viewer no comment to start, no writing, and comments only where there are some', () => {
    open('view', square({ label: 'Login' }));
    expect(rows()).toEqual(['Copy Text']);
    cleanup();
    open('view', square({ commentThread: { comments: [{ id: 'c' }] } }));
    expect(rows()).toEqual(['Show Comments']);
  });

  it('opens nothing where the role has nothing to do', () => {
    open('view', square());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(rows()).toEqual([]);
  });

  it('leaves out Edit Text on what someone else holds, and comments in an embed', () => {
    open('participate', square({ label: 'A' }), {
      lockedByOther: () => true,
      embedMode: true,
    });
    expect(rows()).toEqual(['Copy Text']);
  });

  it('runs each row with the editor’s own handler', () => {
    const link = { kind: 'url', url: 'https://example.com' };
    const el = square({ label: 'Hi', link, note: 'n' });
    open('participate', el);
    fireEvent.click(screen.getByRole('button', { name: 'Add Comment' }));
    expect(ctx.openComments).toHaveBeenCalledWith('sq');
    expect(ctx.closeContextMenu).toHaveBeenCalled();
    cleanup();
    open('participate', el);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Text' }));
    expect(ctx.beginEdit).toHaveBeenCalledWith('sq');
    cleanup();
    open('participate', el);
    fireEvent.click(screen.getByRole('button', { name: 'Open Link' }));
    expect(ctx.followLink).toHaveBeenCalledWith(link);
    cleanup();
    open('participate', el);
    fireEvent.click(screen.getByRole('button', { name: 'View Note' }));
    expect(ctx.openNote).toHaveBeenCalledWith('sq');
    cleanup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    open('participate', el);
    fireEvent.click(screen.getByRole('button', { name: 'Copy Text' }));
    expect(writeText).toHaveBeenCalledWith('Hi');
  });

  it('attaches nothing to an arrow', () => {
    open('participate', { ...createArrow(0, 0, 10, 10), id: 'ar', label: 'yes' });
    expect(rows()).not.toContain('Add Comment');
    expect(rows()).not.toContain('Open Link');
    expect(rows()).toContain('Copy Text');
  });

  it('renders nothing without an element menu open, or for an element gone', () => {
    open('view', square({ label: 'A' }), { contextMenu: null });
    expect(rows()).toEqual([]);
    cleanup();
    open('view', square({ label: 'A' }), {
      contextMenu: { mode: 'element', elementId: 'gone', x: 0, y: 0 },
    });
    expect(rows()).toEqual([]);
  });
});
