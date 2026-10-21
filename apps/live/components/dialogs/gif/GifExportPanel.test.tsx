// @vitest-environment jsdom

// The GIF panel (docs/specs/020-import-export/animated-gif-export.md "The options", "Errors", "Telemetry").
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pagesOf, layOutPages, type Tab } from '@liveplanner/document';
import { GifExportError } from '@/lib/gif-export/gif-export-error';
import type { PageSnapshot } from '@/lib/gif-export/page-snapshot';
import GifExportPanel, {
  GIF_ERROR_COPY,
  GIF_LARGE_COPY,
  GIF_TOO_LONG_COPY,
} from './GifExportPanel';

const h = vi.hoisted(() => ({
  snapshot: vi.fn(),
  sampleBytes: 10_000,
  track: vi.fn(),
  download: vi.fn(),
  encoder: { palette: vi.fn(), add: vi.fn(), finish: vi.fn(), cancel: vi.fn() },
}));
vi.mock('@/lib/telemetry', () => ({ track: h.track }));
vi.mock('@/lib/download-blob', () => ({ downloadBlob: h.download }));
vi.mock('@/lib/export-fonts', () => ({ embeddedFontFaceCss: async () => '' }));
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
const pages = layOutPages(pagesOf(tab));
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
const hold = () => screen.getByRole<HTMLInputElement>('slider');

// A make yields one task per frame (make-gif.ts), so under a loaded runner (the pre-push coverage
// run, CI) it can outlast Testing Library's 1 s wait and Vitest's 5 s test: the tests that wait
// for a whole make get room for one.
const MAKE_WAIT = { timeout: 10_000 };
const MAKE_TEST_MS = 15_000;

beforeEach(() => {
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

  it('names the transition between pages', () => {
    open();
    expect(screen.getByText('Between pages: a slide.')).toBeTruthy();
  });

  it('estimates from a sample frame, and warns when it is large', async () => {
    open();
    // Ten still pages, a slide between each.
    await waitFor(() => expect(screen.getByText(/^About [\d.]+ (KB|MB)$/)).toBeTruthy());
    expect(screen.getByTestId('export-preview').getAttribute('src')).toBe('data:image/svg+xml,x');
    cleanup();
    h.sampleBytes = 2_000_000;
    open();
    await waitFor(() =>
      expect(screen.getByText((text) => text.endsWith(`MB. ${GIF_LARGE_COPY}`))).toBeTruthy(),
    );
  });

  it('will not make a GIF longer than 3 minutes', () => {
    open();
    fireEvent.change(hold(), { target: { value: '20' } });
    expect(screen.getByText(GIF_TOO_LONG_COPY)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Download GIF' }).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'One page' }));
    expect(screen.queryByText(GIF_TOO_LONG_COPY)).toBeNull();
  });

  it(
    'downloads the GIF with its name, and counts the export',
    async () => {
      const { onDone } = open();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Download GIF' }));
      });
      await waitFor(() => expect(onDone).toHaveBeenCalled(), MAKE_WAIT);
      const download: unknown[] = h.download.mock.calls[0]!;
      const [blob, name] = download;
      expect(name).toBe('Doc - Deck.gif');
      expect((blob as Blob).type).toBe('image/gif');
      expect(h.track).toHaveBeenCalledWith('Document', 'Exported', 'PagesGIFPages');
    },
    MAKE_TEST_MS,
  );

  it(
    'counts one page as PagesGIF, named for the page',
    async () => {
      open();
      fireEvent.click(screen.getByRole('button', { name: 'One page' }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Download GIF' }));
      });
      await waitFor(() => expect(h.download).toHaveBeenCalled(), MAKE_WAIT);
      expect(h.download.mock.calls[0]![1]).toMatch(/^Doc - Deck - .+\.gif$/);
      expect(h.track).toHaveBeenCalledWith('Document', 'Exported', 'PagesGIF');
    },
    MAKE_TEST_MS,
  );

  it(
    'shows progress while making, and Cancel stops with nothing downloaded',
    async () => {
      let finish: (v: { bytes: Uint8Array; written: number }) => void = () => {};
      h.encoder.finish.mockReturnValue(new Promise((r) => (finish = r)));
      open();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Download GIF' }));
      });
      await waitFor(() => expect(screen.getByRole('progressbar')).toBeTruthy(), MAKE_WAIT);
      expect(screen.getByRole('button', { name: /Making GIF… \d+%/ })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      finish({ bytes: new Uint8Array([71]), written: 1 });
      await waitFor(
        () => expect(screen.getByRole('button', { name: 'Download GIF' })).toBeTruthy(),
        MAKE_WAIT,
      );
      expect(h.download).not.toHaveBeenCalled();
    },
    MAKE_TEST_MS,
  );

  it('clears the canvas selection as it opens, so no frame shows a selection ring', () => {
    const onClearSelection = vi.fn();
    render(
      <GifExportPanel
        tab={tab}
        pages={pages}
        page={pages[0]!}
        baseName="Doc - Deck"
        onPick={vi.fn()}
        onDone={vi.fn()}
        onBack={vi.fn()}
        onClearSelection={onClearSelection}
      />,
    );
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('settles its estimate though the editor re-renders it with a fresh tab all the while', async () => {
    const props = {
      pages,
      page: pages[0]!,
      baseName: 'Doc - Deck',
      onPick: vi.fn(),
      onDone: vi.fn(),
      onBack: vi.fn(),
    };
    const { rerender } = render(<GifExportPanel tab={{ ...tab }} {...props} />);
    // A collaborator typing: a new tab object every 100 ms, quicker than the estimate's rest.
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });
      rerender(<GifExportPanel tab={{ ...tab }} {...props} />);
    }
    expect(h.snapshot).toHaveBeenCalled();
  });

  it(
    'keeps a failed Download’s message up, though the preview’s estimate succeeds after it',
    async () => {
      h.encoder.finish.mockRejectedValue(new Error('out of memory'));
      open();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Download GIF' }));
      });
      expect((await screen.findByRole('alert', {}, MAKE_WAIT)).textContent).toBe(
        GIF_ERROR_COPY.failed,
      );
      // The estimate runs again once the make ends; its success must not wipe the error.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 800));
      });
      expect(screen.getByRole('alert').textContent).toBe(GIF_ERROR_COPY.failed);
      expect(h.download).not.toHaveBeenCalled();
    },
    MAKE_TEST_MS,
  );

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
