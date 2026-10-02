// draw.io's import report in the one shape every importer shares (docs/specs/020-import-export/
// drawio-import.md "The import report", board-scene.md "The report"): what landed, counted by kind,
// and each change on the way in as a rule, a short sentence the report shows as "count · rule".

import type { Element } from '@livediagram/document';
import type { BoardSceneReport, ReportRule } from '@/lib/board-scene/report';
import type { SceneItemKind } from '@/lib/board-scene/scene';
import { importImageReportTotal, type ImportImageReport } from '@/lib/import-images';
import type { ImportOutcome } from '@/lib/import-tab';
import {
  IMPORT_NOTE_ORDER,
  type ImportNote,
  type ImportNoteKind,
  type DrawioReport,
} from './notes';
import type { ImportedPage } from './import';

/** Each draw.io note's rule: final copy, the count shown before it. */
export const DRAWIO_RULES: Readonly<Record<ImportNoteKind, string>> = {
  'shape-unmatched': 'Shapes with no livediagram match came in as labelled boxes',
  'shape-approximated': 'Shapes came in as the nearest livediagram shape',
  'icon-substituted': 'Vendor icons came in as the matching livediagram icon',
  'image-unavailable': 'Images linked outside the diagram came in as placeholders or were left out',
  'arrowhead-approximated': "Arrowheads livediagram doesn't draw took the nearest one",
  'connection-loosened': "Connection ends that couldn't stay attached were left where they were",
  'label-moved': 'Labels were moved inside their shapes or merged onto one line',
  'lane-title-turned': 'Upright lane titles now read across',
  'group-flattened': 'Groups were dropped',
  'hidden-skipped': 'Hidden items were left out',
  'collapsed-skipped': 'Items inside collapsed containers were left out',
  'link-dropped': "Links of a kind livediagram can't follow were dropped",
  'text-truncated': 'Texts were shortened to fit',
  'auto-layout': "Positions and styles weren't in the file; the layout is automatic",
  'library-item-unreadable': "Library shapes that couldn't be read were left out",
  'content-truncated': 'Pages or items beyond the import limits were left out',
};

const SKIPPED: ReadonlySet<ImportNoteKind> = new Set([
  'hidden-skipped',
  'collapsed-skipped',
  'library-item-unreadable',
  'content-truncated',
]);

// "router ×3, switch, …", appended to the rule it names.
function namesOf(note: ImportNote): string {
  if (!note.names || note.names.length === 0) return '';
  const parts = note.names.map((n) => (n.count > 1 ? `${n.name} ×${n.count}` : n.name));
  if (note.moreNames) parts.push('…');
  return ` (${parts.join(', ')})`;
}

function landedKind(el: Element): SceneItemKind {
  switch (el.type) {
    case 'arrow':
      return 'connector';
    case 'text':
      return 'text';
    case 'sticky':
      return 'sticky';
    case 'image':
      return 'image';
    case 'freehand':
      return 'polyline';
    case 'shape':
      return el.shape === 'frame' ? 'frame' : 'shape';
    default:
      return 'shape';
  }
}

export function drawioSceneReport(
  report: DrawioReport,
  // Pages, or a library's items: anything holding the elements that landed.
  pages: readonly Pick<ImportedPage, 'elements'>[],
): BoardSceneReport {
  const landed: BoardSceneReport['landed'] = {};
  for (const page of pages) {
    for (const el of page.elements) {
      const kind = landedKind(el);
      landed[kind] = (landed[kind] ?? 0) + 1;
    }
  }
  const degraded: ReportRule[] = [];
  const skipped: ReportRule[] = [];
  const byKind = new Map(report.notes.map((n) => [n.kind, n]));
  for (const kind of IMPORT_NOTE_ORDER) {
    const note = byKind.get(kind);
    if (!note || note.count <= 0) continue;
    (SKIPPED.has(kind) ? skipped : degraded).push({
      rule: `${DRAWIO_RULES[kind]}${namesOf(note)}`,
      count: note.count,
    });
  }
  return { landed, degraded, skipped };
}

/** The Import dialog's outcome: the report when something changed or images came along. */
export function drawioOutcome(
  report: DrawioReport,
  pages: readonly ImportedPage[],
  images?: ImportImageReport,
): ImportOutcome {
  const scene = drawioSceneReport(report, pages);
  const changed = scene.degraded.length > 0 || scene.skipped.length > 0;
  const withImages = !!images && importImageReportTotal(images) > 0;
  if (!changed && !withImages) return { status: 'done' };
  return {
    status: 'done',
    ...(changed ? { scene } : {}),
    ...(withImages ? { images } : {}),
  };
}
