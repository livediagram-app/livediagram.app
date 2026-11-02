// The PowerPoint and Word panel's making (docs/specs/020-import-export/office-export.md "The panel" and "Errors"):
// Download builds the file with its progress, Cancel stops it, and a failure is named until the next try.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Deck, LaidOutPage, Tab } from '@livedocuments/document';
import { downloadBlob } from '@liveworkspace/workbench/lib/download-blob';
import type { ImageExportOpts } from '@/lib/export-tab';
import { exportOfficeFile, type OfficeExportFailure } from '@/lib/office-export';
import type { OfficeFormat } from '@/lib/office-export/summary';
import { track } from '@/lib/telemetry';

export type OfficePhase =
  | { kind: 'idle' }
  | { kind: 'making'; progress: number }
  | { kind: 'error'; failure: OfficeExportFailure };

const EXPORTED_LABEL: Record<OfficeFormat, string> = { pptx: 'PagesPPTX', docx: 'PagesDOCX' };

export function useOfficeExport({
  format,
  tab,
  pages,
  deck,
  title,
  baseName,
  render,
  onDone,
}: {
  format: OfficeFormat;
  tab: Tab;
  pages: readonly LaidOutPage[];
  deck?: Deck;
  /** The document's name, the file's own title. */
  title: string;
  /** `<document> - <tab>`, made safe for a file name. */
  baseName: string;
  /** The images and tab windows the dialog loaded for its preview, drawn into the pictures. */
  render: Pick<ImageExportOpts, 'images' | 'resolveTabWindow' | 'tabWindowFontIds'>;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<OfficePhase>({ kind: 'idle' });
  const running = useRef<AbortController | null>(null);

  // A closed dialog stops the making.
  useEffect(() => () => running.current?.abort(), []);

  const make = useCallback(async () => {
    if (running.current) return;
    const controller = new AbortController();
    running.current = controller;
    setPhase({ kind: 'making', progress: 0 });
    const result = await exportOfficeFile(
      { format, tab, pages, ...(deck ? { deck } : {}), title, ...render },
      {
        signal: controller.signal,
        onProgress: (progress) => {
          if (!controller.signal.aborted) setPhase({ kind: 'making', progress });
        },
      },
    );
    if (controller.signal.aborted) return;
    running.current = null;
    if (result.ok) {
      downloadBlob(result.blob, `${baseName}.${format}`);
      track('Document', 'Exported', EXPORTED_LABEL[format]);
      setPhase({ kind: 'idle' });
      onDone();
    } else {
      setPhase('failure' in result ? { kind: 'error', failure: result.failure } : { kind: 'idle' });
    }
  }, [format, tab, pages, deck, title, baseName, render, onDone]);

  const cancel = useCallback(() => {
    running.current?.abort();
    running.current = null;
    setPhase({ kind: 'idle' });
  }, []);

  return { phase, make, cancel };
}
