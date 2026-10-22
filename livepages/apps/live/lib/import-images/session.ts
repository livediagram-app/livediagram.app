// One import session: stores each image an import meets, sharing a concurrency
// limit, the Offline Mode embed budget and the no-image-storage short-circuit
// across the whole import (docs/specs/020-import-export/import-image-pipeline.md "One import session").
// Bulk import will run many files through one session.

import { IMPORT_IMAGE_CONCURRENCY, OFFLINE_IMPORT_EMBED_BUDGET_CHARS } from './constants';
import { prepareImportImage } from './prepare';
import { readImportImageSource } from './source';
import { ApiError } from '../api/core';
import { failureFromUploadError } from './upload-error';
import type {
  DisplayHint,
  ImageCodec,
  ImportImageFailure,
  ImportImageOutcome,
  ImportImageSession,
  ImportImageSource,
  PreparedImportImage,
} from './types';
import { debugLog } from '@/lib/debug-log';

export type ImportImageLog = (fingerprint: string, outcome: string, detail?: unknown) => void;

export type ImportImageSessionDeps = {
  // An Offline Mode document embeds instead of uploading.
  offline: boolean;
  codec: ImageCodec;
  // Stores the bytes in the gallery; throws an ApiError on refusal.
  upload: (
    prepared: PreparedImportImage,
    name?: string,
  ) => Promise<{ imageId: string; deduped: boolean }>;
  toDataUrl: (blob: Blob) => Promise<string>;
  log?: ImportImageLog;
};

const defaultLog: ImportImageLog = (fingerprint, outcome, detail) =>
  debugLog(fingerprint, outcome, detail);

export function createImportImageSession(deps: ImportImageSessionDeps): ImportImageSession {
  const log = deps.log ?? defaultLog;
  let unavailable = false;
  let embeddedChars = 0;
  let inFlight = 0;
  const waiting: (() => void)[] = [];

  const acquire = async () => {
    if (inFlight >= IMPORT_IMAGE_CONCURRENCY) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    inFlight += 1;
  };
  const release = () => {
    inFlight -= 1;
    waiting.shift()?.();
  };

  const failed = (failure: ImportImageFailure, detail?: unknown): ImportImageOutcome => {
    if (failure === 'images-unavailable') unavailable = true;
    log('[import-images]', failure, detail);
    return { ok: false, failure };
  };

  const run = async (
    source: ImportImageSource,
    hint?: DisplayHint,
  ): Promise<ImportImageOutcome> => {
    const read = await readImportImageSource(source);
    if (!read.ok) return failed(read.failure);
    const prepared = await prepareImportImage(read.bytes, read.mimeType, hint, deps.codec);
    const detail = {
      mimeType: read.mimeType,
      sourceBytes: read.bytes.byteLength,
      ...(prepared.ok
        ? {
            storedType: prepared.mimeType,
            storedBytes: prepared.blob.size,
            width: prepared.width,
            height: prepared.height,
          }
        : {}),
    };
    if (!prepared.ok) return failed(prepared.failure, detail);
    const size = { width: prepared.width, height: prepared.height };

    if (deps.offline) {
      const dataUrl = await deps.toDataUrl(prepared.blob);
      // A refused image does not spend the budget: a smaller one may still fit.
      if (embeddedChars + dataUrl.length > OFFLINE_IMPORT_EMBED_BUDGET_CHARS) {
        return failed('offline-budget', detail);
      }
      embeddedChars += dataUrl.length;
      log('[import-images]', 'embedded', detail);
      return { ok: true, imageId: dataUrl, ...size, kind: 'embedded' };
    }

    try {
      const { imageId, deduped } = await uploadRetryingConflict(prepared, source.name);
      const kind = deduped ? 'deduped' : 'uploaded';
      log('[import-images]', kind, detail);
      return { ok: true, imageId, ...size, kind };
    } catch (error) {
      return failed(failureFromUploadError(error), { ...detail, error: String(error) });
    }
  };

  // A 409 upload_conflict means the cap refused the insert but the gallery had
  // room again by the time the server looked (an image was deleted meanwhile):
  // one retry, then the failure stands (docs/specs/020-import-export/import-image-pipeline.md).
  const uploadRetryingConflict = async (prepared: PreparedImportImage, name?: string) => {
    try {
      return await deps.upload(prepared, name);
    } catch (error) {
      if (!(error instanceof ApiError && error.code === 'upload_conflict')) throw error;
      log('[import-images]', 'upload-conflict-retry');
      return deps.upload(prepared, name);
    }
  };

  return {
    async store(source, hint) {
      if (unavailable) return { ok: false, failure: 'images-unavailable' };
      await acquire();
      try {
        // A second check: an earlier store may have learnt it while this one queued.
        if (unavailable) return { ok: false, failure: 'images-unavailable' };
        return await run(source, hint);
      } catch (error) {
        console.warn('[import-images] error', error);
        return failed('upload-failed');
      } finally {
        release();
      }
    },
  };
}
