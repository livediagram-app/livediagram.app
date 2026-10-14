// @vitest-environment jsdom

// The GIF panel (docs/specs/020-import-export/animated-gif-export.md "The options", "Errors", "Telemetry").
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { illustratePagesOf, layOutIllustratePages, type Tab } from '@livediagram/document';
import { DEFAULT_PRESENTATION_CONFIG, type PresentationConfig } from '@/lib/presentation-config';
import { GifExportError } from '@/lib/gif-export/gif-export-error';
import type { PageSnapshot } from '@/lib/gif-export/page-snapshot';
import GifExportPanel, {
  GIF_ERROR_COPY,
  GIF_LARGE_COPY,
  GIF_TOO_LONG_COPY,
} from './GifExportPanel';

const h = vi.hoisted(() => ({
  config: null as PresentationConfig | null,
  snapshot: vi.fn(),
  sampleBytes: 10_000,
  track: vi.fn(),
  download: vi.fn(),
  encoder: { add: vi.fn(), finish: vi.fn(), cancel: vi.fn() },
}));
vi.mock('@/lib/telemetry', () => ({ track: h.track }));
vi.mock('@/lib/download-blob', () => ({ downloadBlob: h.download }));
vi.mock('@/lib/export-fonts', () => ({ embeddedFontFaceCss: async () => '' }));
vi.mock('@/lib/presentation-config', async (orig) => ({
  ...(await orig<typeof import('@/lib/presentation-config')>()),
  loadPresentationConfig: () => h.config,
}));
vi.mock('@/lib/gif-export/page-snapshot', () => ({ snapshotPage: h.snapshot }));
vi.mock('@/lib/gif-export/page-frames', () => ({
  createFrameDrawer: () => ({ draw: async () => new Uint8ClampedArray(16) }),
}));
vi.mock('@/lib/gif-export/gif-encode-core', () => ({ sampleFrameBytes: () => h.sampleBytes }));
vi.mock('@/lib/gif-export/gif-encoder', () => ({ openGifEncoder: () => h.encoder }));

const tab = {
  id: 't',
  name: 'Deck',
  elements: [],
  pages: Array.from({ length: 10 }, (_, i) => ({
    id: `p${i}`,
    orientation: 'landscape',
    kind: 'slide',
    size: 'slide',
  })),
} as unknown as Tab;
const pages = layOutIllustratePages(illustratePagesOf(tab));
const still: PageSnapshot = {
  animated: false,
  width: 960,
  height: 540,
  urlAt: () => 'data:image/svg+xml,x',
};

function open(over: Partial<{ pages: typeof pages }> = {}) {
  const onDone = vi.fn();
  render(
    <GifExportPanel
      tab={tab}
      pages={over.pages ?? pages}
      page={(over.pages ?? pages)[0]!}
      baseName="Doc - Deck"
      onPick={vi.fn()}
      onDone={onDone}
      onBack={vi.fn()}
    />,
  );
  return { onDone };
}
const hold = () => screen.getByRole('slider') as HTMLInputElement;

beforeEach(() => {
  h.config = { ...DEFAULT_PRESENTATION_CONFIG };
  h.sampleBytes = 10_000;
  h.snapshot.mockReset().mockResolvedValue(still);
  h.encoder.finish.mockReset().mockResolvedValue({ bytes: new Uint8Array([71]), written: 1 });
  h.encoder.add.mockReset();
  h.encoder.cancel.mockReset();
  h.track.mockReset();
  h.download.mockReset();
});
afterEach(cleanup);

describe('the GIF panel', () => {
  it('starts on All pages, a 3 second hold and Medium', () => {
    open();
    expect(screen.getByRole('button', { name: 'All pages' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(hold().value).toBe('3');
    expect(hold().getAttribute('aria-valuetext')).toBe('3 seconds');
    expect(screen.getByText('3 s')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Medium' }).getAttribute('aria-checked')).toBe('true');
  });

  it('starts the hold at the deck’s Auto-advance, within the range', () => {
    h.config = { ...DEFAULT_PRESENTATION_CONFIG, autoAdvanceSeconds: 30 };
    open();
    expect(hold().value).toBe('20');
  });

  it('names the deck’s transition', () => {
    h.config = { ...DEFAULT_PRESENTATION_CONFIG, transition: 'fade', speed: 'normal' };
    open();
    expect(screen.getByText(/Fade, Normal, from the Slide Deck settings/)).toBeTruthy();
  });

  it('estimates from a sample frame, and warns when it is large', async () => {
    h.config = { ...DEFAULT_PRESENTATION_CONFIG, transition: 'none' };
    open();
    // Ten still pages: one frame each.
    await waitFor(() => expect(screen.getByText('About 101 KB')).toBeTruthy());
    expect(screen.getByTestId('export-preview').getAttribute('src')).toBe('data:image/svg+xml,x');
    cleanup();
    h.sampleBytes = 2_000_000;
    open();
    await waitFor(() => expect(screen.getByText(`About 20.0 MB. ${GIF_LARGE_COPY}`)).toBeTruthy());
  });

  it('will not make a GIF longer than 3 minutes', () => {
    open();
    fireEvent.change(hold(), { target: { value: '20' } });
    expect(screen.getByText(GIF_TOO_LONG_COPY)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Download GIF' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'One page' }));
    expect(screen.queryByText(GIF_TOO_LONG_COPY)).toBeNull();
  });

  it('downloads the GIF with its name, and counts the export', async () => {
    const { onDone } = open();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download GIF' }));
    });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const [blob, name] = h.download.mock.calls[0]!;
    expect(name).toBe('Doc - Deck.gif');
    expect((blob as Blob).type).toBe('image/gif');
    expect(h.track).toHaveBeenCalledWith('Document', 'Exported', 'IllustrateGIFPages');
  });

  it('counts one page as IllustrateGIF, named for the page', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'One page' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download GIF' }));
    });
    await waitFor(() => expect(h.download).toHaveBeenCalled());
    expect(h.download.mock.calls[0]![1]).toMatch(/^Doc - Deck - .+\.gif$/);
    expect(h.track).toHaveBeenCalledWith('Document', 'Exported', 'IllustrateGIF');
  });

  it('shows progress while making, and Cancel stops with nothing downloaded', async () => {
    let finish: (v: { bytes: Uint8Array; written: number }) => void = () => {};
    h.encoder.finish.mockReturnValue(new Promise((r) => (finish = r)));
    open();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download GIF' }));
    });
    await waitFor(() => expect(screen.getByRole('progressbar')).toBeTruthy());
    expect(screen.getByRole('button', { name: /Making GIF… \d+%/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    finish({ bytes: new Uint8Array([71]), written: 1 });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download GIF' })).toBeTruthy());
    expect(h.download).not.toHaveBeenCalled();
  });

  it.each([
    ['page-missing', new GifExportError('page-missing')],
    ['tainted', new GifExportError('tainted')],
    ['failed', new Error('boom')],
  ] as const)('says what went wrong: %s', async (code, err) => {
    h.snapshot.mockRejectedValue(err);
    open();
    expect((await screen.findByRole('alert')).textContent).toBe(GIF_ERROR_COPY[code]);
  });
});
