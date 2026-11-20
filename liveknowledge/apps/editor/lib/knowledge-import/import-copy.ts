// What the Import dialog says about a plan (docs/specs/020-import-export/blueprints/knowledgebase-import.md "The
// review step"): why a plan is blocked, and what it found amiss, grouped by kind so 300 missing pictures read as one
// line with its examples rather than 300 lines. Pure: a plan in, lines out.

import type {
  ImportBlock,
  ImportPlan,
  SkipReason,
  WarningKind,
} from '@liveknowledge/knowledge-import';

const count = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

export const pagesLabel = (n: number) => count(n, 'Page', 'Pages');
export const picturesLabel = (n: number) => count(n, 'Picture', 'Pictures');

/** Why nothing can be imported, as a heading and a line. */
export function blockedCopy(block: ImportBlock): { title: string; detail: string } {
  if (block.reason === 'archive-too-large') {
    const mb = Math.round(block.limitBytes / (1024 * 1024));
    return {
      title: 'This Archive Is Too Large',
      detail: `An import takes up to ${mb} MB. Split it into smaller folders and import them one at a time.`,
    };
  }
  const room =
    block.room === 0
      ? 'this Knowledgebase is full'
      : `there is room for ${block.room.toLocaleString('en-GB')}`;
  return {
    title: 'Too Many Pages',
    detail: `It holds ${count(block.found, 'page', 'pages')}, and ${room}. A Knowledgebase holds 500 pages, counted with the ones already there. Import fewer pages, or import into a new Knowledgebase.`,
  };
}

/** One kind of thing the import found amiss: how many, what it means, and the first few by name. */
export type IssueGroup = {
  key: string;
  /** "12 Pictures Not Found". */
  title: string;
  /** What the import does about it. */
  detail: string;
  /** The first ISSUE_EXAMPLES, as "Page: detail" or a path. */
  examples: string[];
  /** How many more there are than the examples shown. */
  more: number;
};

/** Examples shown under each group. */
export const ISSUE_EXAMPLES = 5;

const WARNINGS: Record<WarningKind, { one: string; many: string; detail: string }> = {
  'missing-picture': {
    one: 'Picture Not Found',
    many: 'Pictures Not Found',
    detail: "The archive does not hold them. Each page keeps the picture's description.",
  },
  'picture-too-large': {
    one: 'Picture Over 10 MB',
    many: 'Pictures Over 10 MB',
    detail: "Left out. Each page keeps the picture's description.",
  },
  flattened: {
    one: 'Page Moved Up',
    many: 'Pages Moved Up',
    detail: 'Pages nest 8 levels deep, so deeper ones sit at the last level.',
  },
  'duplicate-title': {
    one: 'Page With a Title Already Used',
    many: 'Pages With a Title Already Used',
    detail: 'Both are kept. A link written by title goes to the first.',
  },
  'unsafe-link': {
    one: 'Link Removed',
    many: 'Links Removed',
    detail: 'A link that runs something keeps its words and loses its address.',
  },
};

const SKIPS: Record<SkipReason, { one: string; many: string; detail: string }> = {
  'outside-archive': {
    one: 'File Outside the Archive',
    many: 'Files Outside the Archive',
    detail: 'Left out: their paths lead outside it.',
  },
  'page-failed': {
    one: 'Page Could Not Be Read',
    many: 'Pages Could Not Be Read',
    detail: 'Left out. Links to them stay as they were written.',
  },
  'page-too-large': {
    one: 'Page Over 5 MB',
    many: 'Pages Over 5 MB',
    detail: 'Left out. Links to them stay as they were written.',
  },
  'picture-too-large': { one: '', many: '', detail: '' },
};

/** A plan's warnings and skipped files, grouped by kind, the largest group first. One pass over the plan. */
export function issueGroups(plan: ImportPlan): IssueGroup[] {
  const groups = new Map<
    string,
    { copy: (typeof WARNINGS)[WarningKind]; all: number; examples: string[] }
  >();
  const add = (key: string, copy: (typeof WARNINGS)[WarningKind], example: string) => {
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { copy, all: 0, examples: [] }));
    group.all += 1;
    if (group.examples.length < ISSUE_EXAMPLES) group.examples.push(example);
  };
  for (const page of plan.pages) {
    for (const warning of page.warnings) {
      add(`warning:${warning.kind}`, WARNINGS[warning.kind], `${page.title}: ${warning.detail}`);
    }
  }
  for (const skip of plan.summary.skipped) {
    // A picture past the limit is already a warning on the page that shows it.
    if (skip.reason === 'picture-too-large') continue;
    add(`skip:${skip.reason}`, SKIPS[skip.reason], skip.path);
  }
  const out = [...groups].map(([key, g]) => ({
    key,
    title: `${g.all.toLocaleString('en-GB')} ${g.all === 1 ? g.copy.one : g.copy.many}`,
    detail: g.copy.detail,
    examples: g.examples,
    more: g.all - g.examples.length,
  }));
  if (plan.summary.attachments > 0) {
    const n = plan.summary.attachments;
    out.push({
      key: 'attachments',
      title: `${n.toLocaleString('en-GB')} ${n === 1 ? 'Attachment Named' : 'Attachments Named'}`,
      detail: 'Files are not stored yet. Each is listed by name at the foot of its page.',
      examples: [],
      more: 0,
    });
  }
  if (plan.summary.ignoredFiles > 0) {
    const n = plan.summary.ignoredFiles;
    out.push({
      key: 'ignored',
      title: `${n.toLocaleString('en-GB')} ${n === 1 ? 'File Not Used' : 'Files Not Used'}`,
      detail: 'No page shows or links to them, so they are left out.',
      examples: [],
      more: 0,
    });
  }
  return out;
}
