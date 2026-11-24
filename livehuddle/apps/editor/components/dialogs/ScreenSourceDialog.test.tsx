// @vitest-environment jsdom

// Show on the Screen (docs/specs/009-elements/screen-and-room-sign.md "Choosing what it shows", Work Tracker 1427):
// File first, searching every app's files, a choice with no picture; Video, the Video Link; and the host that closes
// it when its Screen or the Editor's role goes.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveworkspace/index-client';
import { createShape, type ShapeElement } from '@livehuddle/document';
import {
  closeScreenPicker,
  openScreenPicker,
  screenPickerOpen,
} from '@/lib/office/screen-picker-store';
import { ScreenSourceDialog, ScreenSourceDialogHost } from './ScreenSourceDialog';

let context: unknown = null;
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorContext: () => context,
}));

const item = (id: string, title: string, app = 'liveplanner') =>
  ({ id, app, title, updatedAt: 0, lastOpenedAt: 0, access: 'view' }) as unknown as Item;

let client: {
  listItems: ReturnType<typeof vi.fn>;
  getItem: ReturnType<typeof vi.fn>;
  resolveShare: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  client = {
    listItems: vi.fn(async (q: { view?: string; q?: string }) => ({
      items:
        q.view === 'search'
          ? [
              item('k1', 'Onboarding handbook', 'liveknowledge'),
              item('h1', 'A huddle', 'livehuddle'),
            ]
          : [item('P1', 'Launch Plan'), item('S1', 'This Space', 'livehuddle')],
      next: null,
    })),
    getItem: vi.fn(),
    resolveShare: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  context = null;
  act(() => closeScreenPicker());
});

function open(initialTab: 'file' | 'video' = 'file', savedUrl = '') {
  const onChoose = vi.fn();
  const onClose = vi.fn();
  render(
    <ScreenSourceDialog
      initialTab={initialTab}
      hostId="S1"
      savedUrl={savedUrl}
      onChoose={onChoose}
      onClose={onClose}
      client={client as never}
    />,
  );
  return { onChoose, onClose };
}

describe('Show on the Screen', () => {
  it('lists Recent files any app shows live, never a Space, and puts one on the Screen with no picture', async () => {
    const { onChoose, onClose } = open();
    expect(screen.getByRole('dialog', { name: 'Show on the Screen' })).toBeTruthy();
    fireEvent.click(await screen.findByText('Launch Plan'));
    await waitFor(() =>
      expect(onChoose).toHaveBeenCalledWith({
        kind: 'file',
        liveItem: { app: 'liveplanner', itemId: 'P1' },
        liveName: 'Launch Plan',
      }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByText('This Space')).toBeNull();
    // No role to ask: livehuddle has no connected tabs.
    expect(screen.queryByText('Role')).toBeNull();
  });

  it('finds a file in any app by name', async () => {
    open();
    await screen.findByText('Launch Plan');
    fireEvent.change(screen.getByLabelText('Find a file'), { target: { value: 'onboard' } });
    expect(await screen.findByText('Onboarding handbook')).toBeTruthy();
    expect(screen.queryByText('A huddle')).toBeNull();
  });

  it('sets a video link, and refuses a link that is not a video', () => {
    const { onChoose, onClose } = open('video');
    const field = screen.getByLabelText('Video link');
    fireEvent.change(field, { target: { value: 'example.com/page' } });
    fireEvent.submit(field.closest('form')!);
    expect(screen.getByRole('alert').textContent).toContain("isn't a video link");
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: 'youtu.be/dQw4w9WgXcQ' } });
    fireEvent.submit(field.closest('form')!);
    expect(onChoose).toHaveBeenCalledWith({ kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(onClose).toHaveBeenCalled();
  });

  it('switches between File and Video', async () => {
    open('video', 'https://youtu.be/dQw4w9WgXcQ');
    expect(screen.getByLabelText<HTMLInputElement>('Video link').value).toBe(
      'https://youtu.be/dQw4w9WgXcQ',
    );
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    expect(await screen.findByLabelText('Find a file')).toBeTruthy();
  });
});

describe('Show on the Screen, as the editor opens it', () => {
  const screenEl = { ...createShape('screen', 0, 0), id: 's1' } as ShapeElement;

  it("opens for an Editor's Screen and writes through its patch", async () => {
    const setScreenSourceOf = vi.fn();
    context = {
      activeTab: { elements: [screenEl] },
      documentId: 'S1',
      can: { level: 'edit' },
      setScreenSourceOf,
    };
    render(<ScreenSourceDialogHost />);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => openScreenPicker('s1', 'video'));
    const field = await screen.findByLabelText('Video link');
    fireEvent.change(field, { target: { value: 'https://vimeo.com/76979871' } });
    fireEvent.submit(field.closest('form')!);
    expect(setScreenSourceOf).toHaveBeenCalledWith('s1', {
      kind: 'video',
      url: 'https://vimeo.com/76979871',
    });
    expect(screenPickerOpen()).toBeNull();
  });

  it('closes when its Screen is gone or the role is not an Editor’s', async () => {
    context = { activeTab: { elements: [] }, documentId: 'S1', can: { level: 'edit' } };
    render(<ScreenSourceDialogHost />);
    act(() => openScreenPicker('s1'));
    await waitFor(() => expect(screenPickerOpen()).toBeNull());
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();
    context = {
      activeTab: { elements: [screenEl] },
      documentId: 'S1',
      can: { level: 'participate' },
    };
    render(<ScreenSourceDialogHost />);
    act(() => openScreenPicker('s1'));
    await waitFor(() => expect(screenPickerOpen()).toBeNull());
  });
});
