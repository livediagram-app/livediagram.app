// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, pageScreenRect, type Element } from '@livedesign/design';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import {
  InspectSessionContext,
  type InspectSession,
} from '@/components/canvas/inspect/InspectSessionContext';
import { InspectPanel, inspectElementName } from './InspectPanel';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/components/primitives/MovablePanel', () => ({
  MovablePanel: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

// docs/specs/007-editor/wireframe-pages.md "The Inspect panel".
const pages = layOutPages([
  { id: 'p1', kind: 'wireframe', device: 'iphone', size: 'device' },
] as never);
const scr = pageScreenRect(pages[0]!);
const button = {
  id: 'btn',
  type: 'shape',
  shape: 'rounded',
  x: scr.x + 16,
  y: scr.y + 100,
  width: 120,
  height: 44,
  label: 'Pay',
  fill: '#1e293b',
} as unknown as Element;
const below = { ...button, id: 'below', label: '', y: scr.y + 164 } as unknown as Element;
const elements = [button, below];

let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  writeText = vi.fn(async () => {});
  Object.assign(navigator, { clipboard: { writeText } });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPanel(select: string[] | string | null, session: InspectSession | null = null) {
  const store = createSelectionStore();
  if (Array.isArray(select)) store.setMultiSelectedIds(new Set(select));
  else store.setSelectedId(select);
  return render(
    <SelectionStoreProvider store={store}>
      <InspectSessionContext.Provider value={session}>
        <InspectPanel elements={elements} pages={pages} position={null} onMoveTo={vi.fn()} />
      </InspectSessionContext.Provider>
    </SelectionStoreProvider>,
  );
}

const session = (): InspectSession => ({
  exportElement: vi.fn(async () => {}),
  copyLink: vi.fn(async () => {}),
});

describe('the Inspect panel', () => {
  it('asks for an element when nothing is selected, and for one of several', () => {
    renderPanel(null);
    expect(screen.getByText(/Select an element to see its size/)).toBeTruthy();
    cleanup();
    renderPanel(['btn', 'below']);
    expect(screen.getByText('2 elements selected. Select one to inspect it.')).toBeTruthy();
  });

  it('names the element by its kind and words', () => {
    expect(inspectElementName(button)).toMatch(/· Pay$/);
    expect(inspectElementName(below)).not.toMatch(/·/);
  });

  it('shows the layout in points from the screen’s top-left', () => {
    renderPanel('btn');
    expect(screen.getByRole('button', { name: 'X: 16. Copy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Y: 100. Copy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'W: 120. Copy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'H: 44. Copy' })).toBeTruthy();
  });

  it('copies a value on a press and flashes Copied on it', async () => {
    renderPanel('btn');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'W: 120. Copy' }));
    });
    expect(writeText).toHaveBeenCalledWith('120');
    expect(track).toHaveBeenCalledWith('UI', 'Copied', 'InspectValue');
    expect(screen.getAllByText('Copied').length).toBeGreaterThan(0);
  });

  it('shows the spacing to the neighbour below and copies it', async () => {
    renderPanel('btn');
    const bottom = screen.getByRole('button', { name: /^Bottom: 20, to / });
    await act(async () => {
      fireEvent.click(bottom);
    });
    expect(writeText).toHaveBeenCalledWith('20');
  });

  it('copies CSS and values', async () => {
    renderPanel('btn');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy CSS' }));
    });
    expect(writeText.mock.calls[0]![0]).toContain('width: 120px;');
    expect(track).toHaveBeenCalledWith('UI', 'Copied', 'InspectCss');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Values' }));
    });
    expect(writeText.mock.calls[1]![0]).toContain('W: 120');
    // Every value the panel shows, the spacing too, in its order.
    expect(writeText.mock.calls[1]![0]).toMatch(
      /Y: 100\nSpacing Top: 100\nSpacing Right: 257\nSpacing Bottom: 20\nSpacing Left: 16\nFill:/,
    );
    expect(track).toHaveBeenCalledWith('UI', 'Copied', 'InspectValues');
  });

  it('exports at the chosen scale and format', async () => {
    const s = session();
    renderPanel('btn', s);
    fireEvent.click(screen.getByRole('radio', { name: '3x' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /SVG/ }));
    });
    expect(s.exportElement).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'svg', scale: 3, surface: 'light' }),
    );
  });

  it('copies the Inspect link where there is one, and offers none without', async () => {
    const s = session();
    renderPanel(null, s);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Inspect Link' }));
    });
    expect(s.copyLink).toHaveBeenCalledOnce();
    cleanup();
    renderPanel('btn', { ...session(), copyLink: null });
    expect(screen.queryByRole('button', { name: 'Copy Inspect Link' })).toBeNull();
  });

  it('offers no export without the editor’s session', () => {
    renderPanel('btn');
    expect(screen.queryByRole('button', { name: /PNG/ })).toBeNull();
  });

  it('says when a copy fails', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    renderPanel('btn');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy CSS' }));
    });
    expect(track).not.toHaveBeenCalled();
  });
});
