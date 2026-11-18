// @vitest-environment jsdom
// A tool opened inside the footer's Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md "Opening a tool
// inside Tools"; blueprint FM6 to FM9): the back bar as breadcrumb, Back and Escape a level at a time, focus in and back
// to the row, the live region, the width a tool's dialog asks for, an ask from elsewhere, and a tool that leaves for
// the whole window.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DialogHeader,
  leaveToolsWithDialog,
  resetDialogSlot,
  useDialogDismiss,
} from '@liveworkspace/ui';
import { Dialog } from '../dialogs/Dialog';

import { ChromeToolsMenu, TOOLS_WIDTH_PX, type ChromeToolsItem } from './ChromeToolsMenu';
import { requestToolsView } from './tools-door';

afterEach(() => {
  cleanup();
  resetDialogSlot();
});

const glyph = <svg />;

// A tool that opens a dialog, as History, Webhooks and Automations do: drawn inside Tools by the dialog slot.
function DialogTool({
  size = 'md',
  onLeave,
}: {
  size?: 'md' | 'lg' | '3xl';
  onLeave?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const item: ChromeToolsItem = {
    id: 'notes',
    group: 'versions',
    label: 'Notes',
    description: 'Notes on the item.',
    icon: glyph,
    inPlace: true,
    onSelect: () => setOpen(true),
  };
  const search: ChromeToolsItem = {
    id: 'search',
    group: 'find',
    label: 'Search',
    description: 'Find anything.',
    icon: glyph,
    onSelect: vi.fn(),
  };
  const walk: ChromeToolsItem = {
    id: 'walk',
    group: 'collaborate',
    label: 'Walk',
    description: 'A view of its own.',
    icon: glyph,
    view: ({ back }) => (
      <button type="button" onClick={back}>
        Done Walking
      </button>
    ),
    onSelect: vi.fn(),
  };
  return (
    <>
      <ChromeToolsMenu items={[search, item, walk]} />
      {open ? (
        <Dialog open onClose={() => setOpen(false)} ariaLabel="Notes" size={size}>
          <DialogHeader title="Notes" subtitle="What was said." />
          <p>Note body</p>
          <button type="button" onClick={() => setOpen(false)}>
            Cancel Notes
          </button>
          {onLeave ? <Leave onLeave={() => setOpen(false)} then={onLeave} /> : null}
        </Dialog>
      ) : null}
    </>
  );
}

function Leave({ onLeave, then }: { onLeave: () => void; then: () => void }) {
  const dismiss = useDialogDismiss();
  return (
    <button
      type="button"
      onClick={() => {
        leaveToolsWithDialog();
        dismiss(() => {
          onLeave();
          then();
        });
      }}
    >
      Leave For The Window
    </button>
  );
}

const tools = () => screen.getByRole('button', { name: /^Tools/ });
const popover = () => screen.queryByRole('dialog', { name: /^Tools/ });
const live = () => document.querySelector('[data-tools-live]')!.textContent;

async function openNotes() {
  fireEvent.click(tools());
  fireEvent.click(document.querySelector<HTMLElement>('[data-tools-item="notes"]')!);
  await screen.findByText('Note body');
}

describe('a tool inside Tools', () => {
  it('draws its dialog in place under the back bar, without its own title band or close', async () => {
    render(<DialogTool />);
    await openNotes();
    expect(popover()!.getAttribute('aria-label')).toBe('Tools, Notes');
    const region = screen.getByRole('region', { name: 'Notes' });
    expect(popover()!.contains(region)).toBe(true);
    expect(document.querySelector('[data-dialog-backdrop]')).toBeNull();
    const back = document.querySelector('[data-tools-back]')!;
    expect(back.textContent).toContain('Tools');
    expect(back.textContent).toContain('Notes');
    // Its one line goes too: the tool explains itself below.
    expect(screen.queryByText('What was said.')).toBeNull();
    expect(live()).toBe('Notes');
  });

  it('goes back to the list by the back bar, its focus on the row, and says so', async () => {
    render(<DialogTool />);
    await openNotes();
    fireEvent.click(document.querySelector<HTMLElement>('[data-tools-back] button')!);
    await waitFor(() => expect(screen.queryByText('Note body')).toBeNull());
    expect(popover()!.getAttribute('aria-label')).toBe('Tools');
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('data-tools-item')).toBe('notes'),
    );
    expect(live()).toBe('Tools');
  });

  it('goes back when the tool closes itself', async () => {
    render(<DialogTool />);
    await openNotes();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Notes' }));
    await waitFor(() => expect(popover()!.getAttribute('aria-label')).toBe('Tools'));
  });

  it('steps back a level on Escape, then closes from the list', async () => {
    render(<DialogTool />);
    await openNotes();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(popover()!.getAttribute('aria-label')).toBe('Tools'));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(popover()).toBeNull());
  });

  it('leaves Escape to a part of the tool that keeps it', async () => {
    function Keeps() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <ChromeToolsMenu
            items={[
              {
                id: 'k',
                group: 'versions',
                label: 'Keeps',
                description: 'x',
                icon: glyph,
                inPlace: true,
                onSelect: () => setOpen(true),
              },
            ]}
          />
          {open ? (
            <Dialog open onClose={() => setOpen(false)} ariaLabel="Keeps">
              <div data-keeps-escape="">
                <button type="button">Cancel This</button>
              </div>
            </Dialog>
          ) : null}
        </>
      );
    }
    render(<Keeps />);
    fireEvent.click(tools());
    fireEvent.click(document.querySelector<HTMLElement>('[data-tools-item="k"]')!);
    const inner = await screen.findByRole('button', { name: 'Cancel This' });
    inner.focus();
    fireEvent.keyDown(inner, { key: 'Escape' });
    expect(popover()!.getAttribute('aria-label')).toBe('Tools, Keeps');
  });

  it('closes Tools from any level with its close', async () => {
    render(<DialogTool />);
    await openNotes();
    // No close beside the back bar: the band's corner close is the one close.
    const bar = document.querySelector<HTMLElement>('[data-tools-back]')!;
    expect(within(bar).queryByRole('button', { name: /close/i })).toBeNull();
    fireEvent.click(within(popover()!).getByRole('button', { name: /close/i }));
    await waitFor(() => expect(popover()).toBeNull());
    expect(screen.queryByText('Note body')).toBeNull();
  });

  it('keeps 480px for every dialog, so the popover sides never move', async () => {
    const { unmount } = render(<DialogTool />);
    await openNotes();
    expect(popover()!.style.width).toContain(String(TOOLS_WIDTH_PX));
    unmount();
    resetDialogSlot();
    render(<DialogTool size="lg" />);
    await openNotes();
    expect(popover()!.style.width).toContain(String(TOOLS_WIDTH_PX));
  });

  it('closes Tools with a tool that leaves for the whole window', async () => {
    const then = vi.fn();
    render(<DialogTool onLeave={then} />);
    await openNotes();
    fireEvent.click(screen.getByRole('button', { name: 'Leave For The Window' }));
    expect(then).toHaveBeenCalledOnce();
    await waitFor(() => expect(popover()).toBeNull());
  });

  it('draws a tool with a view of its own, at the same width, and its own way back', async () => {
    render(<DialogTool />);
    fireEvent.click(tools());
    fireEvent.click(document.querySelector<HTMLElement>('[data-tools-item="walk"]')!);
    expect(popover()!.getAttribute('aria-label')).toBe('Tools, Walk');
    expect(popover()!.style.width).toContain(String(TOOLS_WIDTH_PX));
    fireEvent.click(screen.getByRole('button', { name: 'Done Walking' }));
    expect(popover()!.getAttribute('aria-label')).toBe('Tools');
  });

  it('closes Tools for a row that is not in place (Search)', () => {
    render(<DialogTool />);
    fireEvent.click(tools());
    fireEvent.click(document.querySelector<HTMLElement>('[data-tools-item="search"]')!);
    expect(popover()).toBeNull();
  });

  it('opens at a tool asked for from elsewhere', async () => {
    render(<DialogTool />);
    await act(async () => requestToolsView('notes'));
    expect(await screen.findByText('Note body')).toBeTruthy();
    expect(popover()!.getAttribute('aria-label')).toBe('Tools, Notes');
  });

  it('drops an ask gone stale', async () => {
    render(<DialogTool />);
    await act(async () => requestToolsView('notes', Date.now() - 60_000));
    expect(popover()).toBeNull();
  });

  it('goes back to the list when a dialog never arrives', async () => {
    vi.useFakeTimers();
    try {
      render(
        <ChromeToolsMenu
          items={[
            {
              id: 'slow',
              group: 'versions',
              label: 'Slow',
              description: 'x',
              icon: glyph,
              inPlace: true,
              onSelect: () => {},
            },
          ]}
        />,
      );
      fireEvent.click(tools());
      fireEvent.click(document.querySelector<HTMLElement>('[data-tools-item="slow"]')!);
      expect(screen.getByRole('status', { name: 'Loading Slow' })).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(popover()!.getAttribute('aria-label')).toBe('Tools');
    } finally {
      vi.useRealTimers();
    }
  });
});
