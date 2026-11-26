'use client';

// The Markdown Folder panel's making (docs/specs/020-import-export/knowledgebase-export.md "The panel"): idle, then
// a page count as each page goes in, then the download; Cancel and closing the panel stop it between pages.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ZipTooLargeError } from '@liveworkspace/workbench/lib/zip-writer';
import {
  ExportCancelled,
  type MarkdownFolderResult,
} from '@/lib/knowledgebase-export/markdown-folder';

export type MarkdownFolderRun = (options: {
  onProgress: (done: number, total: number) => void;
  signal: AbortSignal;
}) => Promise<MarkdownFolderResult>;

export type MarkdownFolderPhase =
  | { kind: 'idle' }
  | { kind: 'making'; done: number; total: number }
  | { kind: 'done'; missingPictures: number }
  | { kind: 'error'; message: string };

export const MARKDOWN_FOLDER_ERRORS = {
  read: 'A page could not be read. Check your connection and try again.',
  tooLarge: 'This knowledgebase is larger than a zip file can hold (4 GB).',
} as const;

export function useMarkdownFolderExport({
  run,
  onDownload,
  onDone,
}: {
  run: MarkdownFolderRun;
  /** Hands the finished zip over to be saved. */
  onDownload: (blob: Blob) => void;
  /** Called once a zip with nothing missing is saved: the dialog closes. */
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<MarkdownFolderPhase>({ kind: 'idle' });
  const controller = useRef<AbortController | null>(null);

  // Closing the panel (or the dialog) cancels a making still under way.
  useEffect(() => () => controller.current?.abort(), []);

  const make = useCallback(async () => {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setPhase({ kind: 'making', done: 0, total: 0 });
    try {
      const result = await run({
        signal: abort.signal,
        onProgress: (done, total) => setPhase({ kind: 'making', done, total }),
      });
      if (abort.signal.aborted) return;
      onDownload(result.blob);
      if (result.missingPictures > 0)
        setPhase({ kind: 'done', missingPictures: result.missingPictures });
      else onDone();
    } catch (error) {
      if (abort.signal.aborted || error instanceof ExportCancelled) {
        setPhase({ kind: 'idle' });
        return;
      }
      setPhase({
        kind: 'error',
        message:
          error instanceof ZipTooLargeError
            ? MARKDOWN_FOLDER_ERRORS.tooLarge
            : MARKDOWN_FOLDER_ERRORS.read,
      });
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  }, [run, onDownload, onDone]);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setPhase({ kind: 'idle' });
  }, []);

  return { phase, make, cancel };
}
