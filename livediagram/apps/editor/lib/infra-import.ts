// The infrastructure import's report (docs/specs/020-import-export/infrastructure-import.md "The editor", blueprint
// "infraImportOutcome"): nothing to say closes the dialog; skipped keys, boxes left out past the cap or lines past
// the graph builder's limit show the shared import report, one short line each.

import { tabSourcesOf, type Element, type Tab } from '@livediagram/document';
import type { AccessLevel } from '@livediagram/api-schema';
import type { ImportOutcome } from '@/lib/import-tab';
import { landedOf, textImportOutcome } from '@/lib/text-import-report';

// The file types the picker offers, and the size past which a file is refused unread. The cap is the parsers'
// INFRA_MAX_FILE_BYTES (a test holds them equal), kept here so the parsers stay out of the editor's first load.
export const INFRA_FILE_ACCEPT =
  '.toml,.yml,.yaml,.tf,application/toml,application/yaml,text/yaml,text/plain';
export const INFRA_FILE_MAX_BYTES = 1_000_000;

export const INFRA_REPORT_SUBTITLE = "Here's how your infrastructure came across.";
export const INFRA_TOO_LARGE =
  'That file is over 1 MB, larger than any infrastructure file. Pick the file itself.';
export const INFRA_LOCKED = 'This tab is locked. Unlock it before importing.';
export const infraNeeded = (name: string) =>
  `Choose ${name} again, or remove it: it was too large to remember.`;

// Whether the Import dialog offers this tab's From Its Files card: an Editor's, on an unlocked tab a file import drew
// (infrastructure-import.md "Share roles").
export function infraUpdateOffered(tab: Pick<Tab, 'sources' | 'locked'>, level: AccessLevel) {
  return level === 'edit' && !tab.locked && tabSourcesOf(tab) !== null;
}

export type InfraUpdateCounts = {
  added: number;
  removed: number;
  kept: number;
  editsKept: number;
  linesAdded: number;
  linesRemoved: number;
};

// An update's report (blueprint "infraUpdateOutcome"): always shown, since an update that changed nothing says so.
export function infraUpdateOutcome(
  elements: readonly Element[],
  files: number,
  counts: InfraUpdateCounts,
  s: Pick<InfraSummary, 'skippedLine' | 'skippedKeys'>,
): ImportOutcome {
  const rules: [string, number][] = [
    ['Boxes added from the files', counts.added],
    ['Boxes removed, gone from the files', counts.removed],
    ['Lines added', counts.linesAdded],
    ['Lines removed', counts.linesRemoved],
    ['Boxes kept where they were', counts.kept],
    ['Edits kept (labels, notes or icons changed on the tab)', counts.editsKept],
  ];
  const degraded = rules.flatMap(([rule, count]) => (count > 0 ? [{ rule, count }] : []));
  const skipped =
    s.skippedKeys > 0 ? [{ rule: `Keys not drawn: ${s.skippedLine}`, count: s.skippedKeys }] : [];
  return {
    status: 'done',
    title: 'Update complete',
    subtitle: `Updated from ${files} file${files === 1 ? '' : 's'}.`,
    scene: { landed: landedOf(elements), degraded, skipped },
  };
}

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
