import { useEffect, useRef } from 'react';
import { Button } from '@livediagram/ui';
import { describeImportImageReport, type ImportImageReport as Report } from '@/lib/import-images';
import type { BoardSceneReport } from '@/lib/board-scene/report';
import { BoardSceneReportList } from './BoardSceneReportList';

// How an import came across (docs/specs/020-import-export/import-image-pipeline.md "The report",
// docs/specs/020-import-export/board-scene.md "The report"): shown in the Import dialog in place
// of closing it, once the tab has changed. Calm by design: what landed, every rule that changed or
// dropped something, the boards that could not land, the images' counts, one sentence per image
// failure, and the way forward. Announced as a status; Done takes focus.
export function ImportImageReport({
  report,
  scene,
  failures,
  onDone,
}: {
  report?: Report;
  scene?: BoardSceneReport;
  failures?: { title: string; message: string }[];
  onDone: () => void;
}) {
  const doneRef = useRef<HTMLButtonElement>(null);
  const images = report ? describeImportImageReport(report) : null;

  useEffect(() => {
    doneRef.current?.focus();
  }, []);

  return (
    <div role="status" data-testid="import-image-report">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Import complete</h3>
      {scene ? (
        <div className="mt-2">
          <BoardSceneReportList report={scene} showLanded />
        </div>
      ) : null}
      {failures && failures.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
          {failures.map((f, i) => (
            <li key={`${i}-${f.title}`} data-board-failure="">
              <span className="font-semibold">{f.title}</span> · {f.message}
            </li>
          ))}
        </ul>
      ) : null}
      {images ? (
        <>
          <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {images.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {images.failures.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {images.failures.map((f) => (
                <li key={f.failure} data-failure={f.failure}>
                  <span className="font-semibold tabular-nums">{f.count}</span> · {f.sentence}
                </li>
              ))}
            </ul>
          ) : null}
          {images.hint ? (
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">{images.hint}</p>
          ) : null}
        </>
      ) : null}
      <div className="mt-5 flex justify-end">
        <Button ref={doneRef} variant="primary" size="md" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
