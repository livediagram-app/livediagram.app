// Fill an import's image elements through a session and count the outcome per
// element (docs/specs/020-import-export/blueprints/import-image-pipeline.md "attachImportImages").
// Every importer calls this between converting a file and replacing the tab.

import type { Element } from '@livediagram/document';
import { emptyImportImageReport } from './report';
import type {
  ImportImageOutcome,
  ImportImageProgress,
  ImportImageReport,
  ImportImageRequest,
  ImportImageSession,
} from './types';

export async function attachImportImages(
  elements: Element[],
  requests: ImportImageRequest[],
  session: ImportImageSession,
  onProgress?: (progress: ImportImageProgress) => void,
): Promise<{ elements: Element[]; report: ImportImageReport }> {
  const report = emptyImportImageReport();
  if (requests.length === 0) return { elements, report };

  // One store per key; the first request's source and hint speak for the key.
  const firstByKey = new Map<string, ImportImageRequest>();
  for (const r of requests) if (!firstByKey.has(r.key)) firstByKey.set(r.key, r);
  const withSource = [...firstByKey.values()].filter((r) => r.source);
  const total = withSource.length;
  let done = 0;
  if (total > 0) onProgress?.({ done, total });

  const outcomes = new Map<string, ImportImageOutcome>();
  await Promise.all(
    [...firstByKey.values()].map(async (r) => {
      if (!r.source) {
        console.info('[import-images]', 'missing-bytes', { key: r.key });
        outcomes.set(r.key, { ok: false, failure: 'missing-bytes' });
        return;
      }
      outcomes.set(r.key, await session.store(r.source, r.hint));
      done += 1;
      onProgress?.({ done, total });
    }),
  );

  const patches = new Map<string, ImportImageOutcome & { ok: true }>();
  for (const r of requests) {
    const outcome = outcomes.get(r.key)!;
    if (outcome.ok) {
      if (outcome.kind === 'deduped') report.deduped += 1;
      else report.imported += 1;
      patches.set(r.elementId, outcome);
    } else {
      report.placeholders[outcome.failure] = (report.placeholders[outcome.failure] ?? 0) + 1;
    }
  }

  console.info('[import-images] report', report);
  const patched = elements.map((el) => {
    const outcome = el.type === 'image' ? patches.get(el.id) : undefined;
    return outcome
      ? {
          ...el,
          imageId: outcome.imageId,
          naturalWidth: outcome.width,
          naturalHeight: outcome.height,
        }
      : el;
  });
  return { elements: patched, report };
}
