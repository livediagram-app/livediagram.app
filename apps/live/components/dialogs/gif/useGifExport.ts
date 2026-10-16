// The GIF panel's state (docs/specs/020-import-export/blueprints/animated-gif-export.md "The hook"): the options,
// the estimate and preview worked out once they settle, and the making, with progress, Cancel and its errors.
import { useLatest } from '@/hooks/ui/useLatest';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  exportFontIds,
  visibleLayerElements,
  type LaidOutPage,
  type Tab,
} from '@livediagram/document';
import { pageWritingFonts } from '@/lib/article/article-export';
import { downloadBlob } from '@/lib/download-blob';
import { embeddedFontFaceCss } from '@/lib/export-fonts';
import { exportPageLabel, sanitizeFilename, type PageScope } from '@/lib/export-pages';
import { estimateGifBytes, GIF_ESTIMATE_DELAY_MS } from '@/lib/gif-export/gif-estimate';
import { openGifEncoder } from '@/lib/gif-export/gif-encoder';
import { GifExportError, type GifExportErrorCode } from '@/lib/gif-export/gif-export-error';
import {
  gifFrameSize,
  gifHoldDefault,
  gifTimeline,
  gifTooLong,
  type GifSize,
} from '@/lib/gif-export/gif-timeline';
import { makeGif } from '@/lib/gif-export/make-gif';
import { createFrameDrawer } from '@/lib/gif-export/page-frames';
import { snapshotPage, type PageSnapshot } from '@/lib/gif-export/page-snapshot';
import { collectCss } from '@/lib/gif-export/snapshot-css';
import { createImageInliner } from '@/lib/gif-export/snapshot-media';
import { loadPresentationConfig, SLIDE_SPEEDS } from '@/lib/presentation-config';
import { track } from '@/lib/telemetry';

export type GifPhase =
  | { kind: 'idle' }
  | { kind: 'making'; progress: number }
  // `from`: the estimate's error clears once an estimate succeeds; a Download's stays until the next one.
  | { kind: 'error'; code: GifExportErrorCode; from: 'estimate' | 'make' };

export type GifEstimate = { bytes: number; previewUrl: string };

// Everything a frame needs from the page and its tab, gathered once per export (or per estimate).
type Capture = { css: string; fontCss: string; images: ReturnType<typeof createImageInliner> };

export function useGifExport({
  tab,
  pages,
  page,
  baseName,
  onDone,
}: {
  tab: Tab;
  pages: readonly LaidOutPage[];
  // The page One page exports, and the preview shows.
  page: LaidOutPage;
  // `<document> - <tab>`, made safe for a file name.
  baseName: string;
  onDone: () => void;
}) {
  // The deck's own transition and Auto-advance (device-local), read as the panel opens and never written.
  const [config] = useState(loadPresentationConfig);
  const [holdSeconds, setHoldSeconds] = useState(() => gifHoldDefault(config.autoAdvanceSeconds));
  const [size, setSize] = useState<GifSize>('medium');
  const [scope, setScope] = useState<PageScope>('all');
  const [phase, setPhase] = useState<GifPhase>({ kind: 'idle' });
  const [estimate, setEstimate] = useState<GifEstimate | null>(null);
  const abort = useRef<AbortController | null>(null);

  const chosen = useMemo(() => (scope === 'all' ? pages : [page]), [scope, pages, page]);
  const loops = scope === 'all' && pages.length > 1;
  const transitionMs = SLIDE_SPEEDS.find((s) => s.id === config.speed)?.ms ?? 380;
  const { width, height } = gifFrameSize(page.rect, size);
  const tooLong = gifTooLong(chosen.length, holdSeconds);

  // The CSS, the fonts and an image cache, worked out once per panel: the canvas does not change under the dialog.
  // Stable, reading the tab through a ref: the dialog is handed a fresh tab object on every editor render, and the
  // estimate below re-runs when this changes, so a busy editor (a collaborator typing) kept restarting it.
  const capture = useRef<Promise<Capture> | null>(null);
  const fontSource = useLatest({ tab, pages });
  const captureOnce = useCallback(() => {
    capture.current ??= (async () => ({
      css: collectCss(document.styleSheets),
      fontCss: await embeddedFontFaceCss(
        gifFontIds(fontSource.current.tab, fontSource.current.pages),
      ),
      images: createImageInliner(),
    }))();
    return capture.current;
  }, [fontSource]);
  // Whether each page moves, by id: it decides the frame count, whatever the size.
  const stillness = useRef(new Map<string, boolean>());

  // The estimate and preview, once the options rest (D47).
  useEffect(() => {
    if (phase.kind === 'making') return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const shared = await captureOnce();
          const opts = { width, height, ...shared };
          let preview: PageSnapshot | null = null;
          for (const p of chosen) {
            if (stillness.current.has(p.id) && p.id !== page.id) continue;
            const snap = await snapshotPage(p.id, opts);
            stillness.current.set(p.id, !snap.animated);
            if (p.id === page.id) preview = snap;
          }
          preview ??= await snapshotPage(page.id, opts);
          if (cancelled) return;
          const drawer = createFrameDrawer(width, height, 'none');
          const rgba = await drawer.draw({ page: 0, t: 0, mix: 1, delayCs: 0 }, () => preview);
          const { sampleFrameBytes } = await import('@/lib/gif-export/gif-encode-core');
          const sample = sampleFrameBytes(rgba, width, height);
          const frames = gifTimeline({
            pageCount: chosen.length,
            holdSeconds,
            transition: config.transition,
            transitionMs,
            loops,
            stillPages: new Set(chosen.flatMap((p, i) => (stillness.current.get(p.id) ? [i] : []))),
          });
          if (cancelled) return;
          setEstimate({ bytes: estimateGifBytes(sample, frames), previewUrl: preview.urlAt(0) });
          setPhase((p) => (p.kind === 'error' && p.from === 'estimate' ? { kind: 'idle' } : p));
        } catch (err) {
          if (!cancelled) setPhase({ kind: 'error', code: errorCode(err), from: 'estimate' });
        }
      })();
    }, GIF_ESTIMATE_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    chosen,
    page,
    width,
    height,
    holdSeconds,
    loops,
    transitionMs,
    config.transition,
    captureOnce,
    phase.kind,
  ]);

  // Closing the dialog mid-make is Cancel.
  useEffect(() => () => abort.current?.abort(), []);

  const make = useCallback(async () => {
    if (phase.kind === 'making' || tooLong) return;
    const controller = new AbortController();
    abort.current = controller;
    setPhase({ kind: 'making', progress: 0 });
    const encoder = openGifEncoder(width, height);
    try {
      const shared = await captureOnce();
      const { bytes } = await makeGif(
        {
          pageCount: chosen.length,
          holdSeconds,
          transition: config.transition,
          transitionMs,
          loops,
          signal: controller.signal,
          onProgress: (progress) => setPhase({ kind: 'making', progress }),
        },
        {
          snapshot: (i) => snapshotPage(chosen[i]!.id, { width, height, ...shared }),
          drawer: createFrameDrawer(width, height, loops ? config.transition : 'none'),
          encoder,
        },
      );
      const name =
        scope === 'all'
          ? baseName
          : `${baseName} - ${sanitizeFilename(exportPageLabel(page, pages.length))}`;
      downloadBlob(new Blob([bytes as BlobPart], { type: 'image/gif' }), `${name}.gif`);
      if (scope === 'all') track('Document', 'Exported', 'IllustrateGIFPages');
      else track('Document', 'Exported', 'IllustrateGIF');
      setPhase({ kind: 'idle' });
      onDone();
    } catch (err) {
      if (controller.signal.aborted) setPhase({ kind: 'idle' });
      else setPhase({ kind: 'error', code: errorCode(err), from: 'make' });
    } finally {
      if (abort.current === controller) abort.current = null;
    }
  }, [
    phase.kind,
    tooLong,
    captureOnce,
    chosen,
    holdSeconds,
    config.transition,
    transitionMs,
    loops,
    scope,
    baseName,
    page,
    pages.length,
    width,
    height,
    onDone,
  ]);

  const cancel = useCallback(() => abort.current?.abort(), []);

  return {
    holdSeconds,
    setHoldSeconds,
    size,
    setSize,
    scope,
    setScope,
    phase,
    estimate,
    tooLong,
    loops,
    transition: config.transition,
    speed: config.speed,
    make,
    cancel,
    clearError: () => setPhase({ kind: 'idle' }),
  };
}

// The tab's faces and every page's writing's: the GIF's fonts travel in it.
function gifFontIds(tab: Tab, pages: readonly LaidOutPage[]): string[] {
  const els = visibleLayerElements(tab.elements, tab.layers);
  const ids = new Set(exportFontIds(els, tab.font, undefined, tab.finish));
  for (const p of pages) for (const id of pageWritingFonts(tab, p)) ids.add(id);
  return [...ids];
}

const errorCode = (err: unknown): GifExportErrorCode =>
  err instanceof GifExportError ? err.code : 'failed';
