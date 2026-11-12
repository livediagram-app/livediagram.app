// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { storedArrow } from '@/test/retired-elements';
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
// Participant or a Viewer opens holds only what the role may do (docs/specs/013-workspace/share-roles.md). livehuddle has
// no comments, links or notes (docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and
// notes"), so no role gets a comment, Open Link or View Note row, even on an element that stores them.

let ctx: Record<string, unknown>;
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx }));

const square = (over: Record<string, unknown> = {}) =>
  ({ ...createShape('room', 0, 0), id: 'sq', label: undefined, ...over }) as Element;

function open(level: 'view' | 'participate', target: Element, over: Record<string, unknown> = {}) {
  ctx = {
    contextMenu: { mode: 'element', elementId: target.id, x: 10, y: 10 },
    closeContextMenu: vi.fn(),
    activeTab: { elements: [target] },
    can: resolveEditorCapabilities({ level, adderKey: null }),
    embedMode: false,
    lockedByOther: () => false,
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
  // A Participant writes on nothing (docs/specs/013-workspace/share-roles.md "A Participant walks").
  const stored = {
    label: 'Login',
    link: { kind: 'url', url: 'https://example.com' },
    note: 'Remember',
    commentThread: { resolved: false, comments: [{ id: 'c', text: 'hi' }] },
    action: { id: 'a', name: 'Ship it', status: 'open' },
  };

  it('gives a Participant only Copy Text, whatever the element stores, and no Edit Text', () => {
    open('participate', square(stored));
    expect(screen.getByText('Room')).toBeTruthy();
    expect(rows()).toEqual(['Copy Text']);
  });

  it('gives a Viewer no comment, link or note row, even where some are stored', () => {
    open('view', square(stored));
    expect(rows()).toEqual(['Copy Text']);
    cleanup();
    open('view', square({ commentThread: stored.commentThread }));
    expect(rows()).toEqual([]);
  });

  it('opens nothing where the role has nothing to do', () => {
    open('view', square());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(rows()).toEqual([]);
  });

  it('leaves out Edit Text on what someone else holds, in an embed too', () => {
    open('participate', square({ label: 'A' }), {
      lockedByOther: () => true,
      embedMode: true,
    });
    expect(rows()).toEqual(['Copy Text']);
  });

  it('runs each row with the editor’s own handler', () => {
    const link = { kind: 'url', url: 'https://example.com' };
    const el = square({ label: 'Hi', link, note: 'n' });
    // Edit Text is an Editor's row now: run it with an Editor's `can`.
    open('view', el, { can: resolveEditorCapabilities({ level: 'edit', adderKey: null }) });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Text' }));
    expect(ctx.beginEdit).toHaveBeenCalledWith('sq');
    expect(ctx.closeContextMenu).toHaveBeenCalled();
    cleanup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    open('participate', el);
    fireEvent.click(screen.getByRole('button', { name: 'Copy Text' }));
    expect(writeText).toHaveBeenCalledWith('Hi');
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4: a stored arrow's stored label can
  // still be copied (never edited), and its card takes no comment now.
  it("copies a stored arrow's stored label, and offers no comment on its card", () => {
    open('participate', storedArrow('ar', { x: 0, y: 0 }, { x: 10, y: 10 }, { label: 'yes' }));
    expect(rows()).toEqual(['Copy Text']);
  });

  // docs/specs/012-collaboration/meeting-rooms-and-stage.md "Share roles": a stage's settings are an Editor's.
  it('gives a Participant or a Viewer no Stage settings on a stage', () => {
    for (const level of ['participate', 'view'] as const) {
      open(level, { ...createShape('stage', 0, 0), id: 'sg' });
      expect(screen.queryByText('Who Can Speak')).toBeNull();
      expect(screen.queryByText('Show Cameras')).toBeNull();
      expect(rows()).not.toContain('Editors');
      cleanup();
    }
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
