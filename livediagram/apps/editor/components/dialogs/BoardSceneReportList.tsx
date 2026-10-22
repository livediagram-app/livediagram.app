// The rows of a board scene's report (docs/specs/020-import-export/board-scene.md "The report"):
// what landed, per kind, then every degraded and skipped rule with its count, "2 · Groups were
// dropped". Shared by the paste notice and the Import dialog's result view.
import type { SceneItemKind } from '@/lib/board-scene/scene';
import { landedKindLabel, type BoardSceneReport } from '@/lib/board-scene/report';

const KIND_ORDER: readonly SceneItemKind[] = [
  'ink',
  'shape',
  'polyline',
  'connector',
  'text',
  'sticky',
  'image',
  'frame',
];

export function BoardSceneReportList({
  report,
  showLanded = false,
}: {
  report: BoardSceneReport;
  // The dialog lists what landed; the paste notice shows only what changed.
  showLanded?: boolean;
}) {
  const landed = KIND_ORDER.flatMap((kind) => {
    const n = report.landed[kind] ?? 0;
    return n > 0 ? [landedKindLabel(kind, n)] : [];
  });
  const rows = [
    ...report.degraded.map((r) => ({ ...r, kind: 'degraded' as const })),
    ...report.skipped.map((r) => ({ ...r, kind: 'skipped' as const })),
  ];
  return (
    <div data-testid="board-scene-report">
      {showLanded && landed.length > 0 ? (
        <p className="text-sm text-slate-700 dark:text-slate-200">{landed.join(', ')}</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
          {rows.map((r) => (
            <li key={`${r.kind}-${r.rule}`} data-rule-kind={r.kind}>
              <span className="font-semibold tabular-nums">{r.count}</span> · {r.rule}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
