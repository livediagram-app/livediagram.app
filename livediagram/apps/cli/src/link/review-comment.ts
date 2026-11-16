// The pull request comment `link review` writes (docs/specs/027-repositories/blueprints/link-review.md "The
// comment"): the marker the Action finds it by, then per document its link and file, and per drawn tab its counts
// and pictures side by side; tabs past REVIEW_MAX_TABS, or past the comment's size cap, are listed instead. Pure.

import { REVIEW_COMMENT_MAX_CHARS, REVIEW_MARKER } from './constants';
import { codeSpan, markdownText } from './markdown';
import type { DocumentReview, SkippedFile, TabReview } from './review-diff';

// A drawn tab's picture names, null for a side the tab does not have.
export type TabPictures = { before: string | null; after: string | null };

export type ReviewComment = { text: string; drawn: number; listed: number };

// Kept free below the cap for the listing's opening and closing lines.
const LISTING_RESERVE = 400;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const countsOf = (t: TabReview) =>
  `${t.added.length} added, ${t.changed.length} changed, ${t.removed.length} removed`;

const TAB_NOTE = { added: ' · new tab', removed: ' · tab removed', changed: '' } as const;
const FILE_NOTE = { added: ' · new file', removed: ' · file removed', changed: '' } as const;

// Alt text inside `![…]`: no brackets or line breaks to close it early.
const altOf = (text: string) => text.replace(/[[\]\\\r\n]/g, ' ');

// The document in the editor, at the mirror file's host when it is an https: address (RL48).
export function documentLink(host: string, id: string): string | null {
  let url: URL;
  try {
    url = new URL(host);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const base = url.href.endsWith('/') ? url.href : `${url.href}/`;
  return new URL(`document/${encodeURIComponent(id)}`, base).href;
}

function documentHeader(doc: DocumentReview): string {
  const link = documentLink(doc.host, doc.id);
  const where = `${codeSpan(doc.path)}${FILE_NOTE[doc.status]}`;
  return `#### ${markdownText(doc.name)}\n\n${link ? `[Open in livediagram](${link}) · ` : ''}${where}\n\n`;
}

function tabSection(
  tab: TabReview,
  pictures: TabPictures,
  urlOf: (file: string) => string,
): string {
  const cell = (file: string | null, side: string) =>
    file === null ? '(none)' : `![${altOf(tab.name)} ${side}](${urlOf(file)})`;
  const placeholders = [tab.before, tab.after].some((t) =>
    t?.elements.some((el) => el.type === 'image'),
  )
    ? 'Pictures on this tab are drawn as placeholders.\n\n'
    : '';
  return [
    `**${markdownText(tab.name)}** · ${countsOf(tab)}${TAB_NOTE[tab.status]}\n\n`,
    placeholders,
    '| Before | After |\n| --- | --- |\n',
    `| ${cell(pictures.before, 'before')} | ${cell(pictures.after, 'after')} |\n\n`,
  ].join('');
}

export function reviewCommentText(input: {
  documents: readonly DocumentReview[];
  pictures: ReadonlyMap<TabReview, TabPictures>;
  skipped: readonly SkippedFile[];
  imageUrl?: string;
  max?: number;
}): ReviewComment {
  const max = input.max ?? REVIEW_COMMENT_MAX_CHARS;
  const urlOf = (file: string) =>
    input.imageUrl ? input.imageUrl.replaceAll('{file}', file) : file;
  const tabs = input.documents.reduce((n, d) => n + d.tabs.length, 0);
  let text = `${REVIEW_MARKER}\n### Diagram changes\n\n`;
  if (tabs === 0) text += 'No diagram changes in this pull request.\n\n';
  else
    text += `${plural(tabs, 'tab')} changed in ${plural(input.documents.length, 'document')}. Outlined: green solid is added, amber dashed is changed, red dotted is removed.\n\n`;
  // Sections while they fit; every other tab is listed.
  const listed: string[] = [];
  let drawn = 0;
  for (const doc of input.documents) {
    let header: string | null = documentHeader(doc);
    for (const tab of doc.tabs) {
      const pictures = input.pictures.get(tab);
      const section = pictures ? tabSection(tab, pictures, urlOf) : null;
      const adding = section === null ? 0 : (header?.length ?? 0) + section.length;
      if (section === null || text.length + adding > max - LISTING_RESERVE) {
        listed.push(`- ${markdownText(doc.name)} · ${markdownText(tab.name)} · ${countsOf(tab)}\n`);
        continue;
      }
      text += `${header ?? ''}${section}`;
      header = null;
      drawn += 1;
    }
  }
  // The listing and the files not drawn, each line while it fits, then how many more.
  const tail = (opening: string, lines: readonly string[], closing: string) => {
    if (lines.length === 0) return;
    text += opening;
    let shown = 0;
    for (const line of lines) {
      if (text.length + line.length > max - LISTING_RESERVE / 2) break;
      text += line;
      shown += 1;
    }
    if (shown < lines.length) text += `- and ${lines.length - shown} more\n`;
    text += closing;
  };
  tail(
    `<details><summary>${plural(listed.length, 'more tab')} not drawn</summary>\n\n`,
    listed,
    '\n</details>\n\n',
  );
  tail(
    'Not drawn:\n\n',
    input.skipped.map((s) => `- ${codeSpan(s.path)} (${markdownText(s.reason)})\n`),
    '',
  );
  return { text, drawn, listed: listed.length };
}
