// @vitest-environment jsdom
// The Export Tab dialog's shared frame, format grid and preview load (export-tab-dialog.tsx). The editors' own
// dialog tests drive them with their formats; these keep every branch covered here.
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportTabDialogFrame, useExportPreviewImages } from './export-tab-dialog';

afterEach(cleanup);

type Kind = 'file' | 'png' | 'gif';
const CARDS = [
  { kind: 'file', title: 'JSON', description: 'A file.' },
  { kind: 'png', title: 'PNG', description: 'An image.' },
] as const;
const Icon = ({ kind }: { kind: Kind }) => <span data-testid={`icon-${kind}`} />;

describe('exportTabDialogFrame', () => {
  it('shows the format grid while no format is open, and picks one', () => {
    const onPick = vi.fn();
    render(
      exportTabDialogFrame<Kind>({
        isSelection: false,
        titleId: 't',
        subtitle: 'Pick a format to export the current tab.',
        help: <a href="#help">Help</a>,
        onClose: () => {},
        panel: null,
        cards: CARDS,
        onPick,
        FormatIcon: Icon,
      }),
    );
    expect(screen.getByRole('dialog', { name: 'Export Tab' })).toBeTruthy();
    expect(screen.getByText('Pick a format to export the current tab.')).toBeTruthy();
    expect(screen.getByTestId('icon-png')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /PNG/ }));
    expect(onPick).toHaveBeenCalledWith('png');
  });

  it("shows the open format's panel in place of the grid, titled for a selection", () => {
    render(
      exportTabDialogFrame<Kind>({
        isSelection: true,
        titleId: 't',
        subtitle: 'Copy this tab as JSON, or download a file.',
        help: null,
        onClose: () => {},
        panel: <p>The JSON panel</p>,
        cards: CARDS,
        onPick: () => {},
        FormatIcon: Icon,
      }),
    );
    expect(screen.getByRole('dialog', { name: 'Export Selection' })).toBeTruthy();
    expect(screen.getByText('The JSON panel')).toBeTruthy();
    expect(screen.queryByTestId('icon-png')).toBeNull();
  });
});

const isText = (f: Kind) => f === 'file';
const isGif = (f: Kind) => f === 'gif';

describe('useExportPreviewImages', () => {
  it('loads once an image format is picked, and is not ready again until a new load lands', async () => {
    const load = vi.fn(async (tab: string, ctx: string | undefined) => `${tab}:${ctx ?? '-'}`);
    const { result, rerender } = renderHook(
      ({ active, tab }: { active: Kind | null; tab: string }) =>
        useExportPreviewImages({ active, tab, imageContext: 'ctx', isTextFormat: isText, load }),
      { initialProps: { active: null as Kind | null, tab: 'a' } },
    );
    expect(result.current).toEqual({ previewImages: undefined, previewReady: false });
    rerender({ active: 'file', tab: 'a' });
    expect(load).not.toHaveBeenCalled();
    await act(async () => rerender({ active: 'png', tab: 'a' }));
    expect(result.current).toEqual({ previewImages: 'a:ctx', previewReady: true });
    // A tab change resets readiness during the render, before the new load lands.
    let pending!: (v: string) => void;
    load.mockImplementationOnce(() => new Promise<string>((r) => (pending = r)));
    rerender({ active: 'png', tab: 'b' });
    expect(result.current.previewReady).toBe(false);
    await act(async () => pending('b:ctx'));
    expect(result.current).toEqual({ previewImages: 'b:ctx', previewReady: true });
  });

  it('skips a format with no preview, and drops a load that lands after its inputs moved on', async () => {
    let pending!: (v: string) => void;
    const load = vi.fn(() => new Promise<string>((r) => (pending = r)));
    const { result, rerender, unmount } = renderHook(
      ({ active }: { active: Kind | null }) =>
        useExportPreviewImages({
          active,
          tab: 't',
          imageContext: undefined,
          isTextFormat: isText,
          load,
          skipLoad: isGif,
        }),
      { initialProps: { active: 'gif' as Kind | null } },
    );
    expect(load).not.toHaveBeenCalled();
    rerender({ active: 'png' });
    expect(load).toHaveBeenCalledWith('t', undefined);
    unmount();
    await act(async () => pending('late'));
    expect(result.current.previewReady).toBe(false);
  });
});
