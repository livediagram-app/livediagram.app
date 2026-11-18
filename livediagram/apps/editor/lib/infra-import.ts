// The infrastructure import's report (docs/specs/020-import-export/infrastructure-import.md "The editor", blueprint
// "infraImportOutcome"): nothing to say closes the dialog; skipped keys, boxes left out past the cap or lines past
// the graph builder's limit show the shared import report, one short line each.

import type { Element } from '@livediagram/document';
import type { ImportOutcome } from '@/lib/import-tab';
import { textImportOutcome } from '@/lib/text-import-report';

// The file types the picker offers, and the size past which a file is refused unread. The cap is the parsers'
// INFRA_MAX_FILE_BYTES (a test holds them equal), kept here so the parsers stay out of the editor's first load.
export const INFRA_FILE_ACCEPT =
  '.toml,.yml,.yaml,application/toml,application/yaml,text/yaml,text/plain';
export const INFRA_FILE_MAX_BYTES = 1_000_000;

export const INFRA_REPORT_SUBTITLE = "Here's how your infrastructure came across.";

export type InfraSummary = {
  // The skipped keys as one line (`vars, observability (2)`), and how many distinct keys it names.
  skippedLine: string;
  skippedKeys: number;
  leftOut: number;
  // The most boxes drawn, the "N more" box included.
  maxNodes: number;
  linesLeftOut: number;
  linesKept: number;
};

export function infraImportOutcome(elements: readonly Element[], s: InfraSummary): ImportOutcome {
  const skipped = [
    ...(s.skippedKeys > 0
      ? [{ rule: `Keys not drawn: ${s.skippedLine}`, count: s.skippedKeys }]
      : []),
    ...(s.leftOut > 0
      ? [
          {
            rule: `Boxes left out past the first ${s.maxNodes - 1}, listed in the last box`,
            count: s.leftOut,
          },
        ]
      : []),
    ...(s.linesLeftOut > 0
      ? [
          {
            rule: `Lines left out past the first ${s.linesKept.toLocaleString('en-GB')}`,
            count: s.linesLeftOut,
          },
        ]
      : []),
  ];
  return textImportOutcome(elements, { subtitle: INFRA_REPORT_SUBTITLE, skipped });
}
