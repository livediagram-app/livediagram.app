// `link review` (docs/specs/027-repositories/repository-link.md "Pull request review"; blueprint link-review.md):
// the mirror files a change touched, read from git at the merge base and at head, each changed tab drawn before and
// after with its changed elements outlined, and the pull request comment written beside the pictures. It reads no
// profile and sends nothing.

import { posix } from 'node:path';
import { debugLog } from '../debug';
import type { CliIo } from '../io';
import {
  REVIEW_FILE_HEX,
  REVIEW_MAX_TABS,
  REVIEW_PNG_MAX_SIDE,
  REVIEW_PNG_SCALE,
} from '../link/constants';
import { hasConflictMarkers } from '../link/mirror-file';
import { reviewCommentText, type TabPictures } from '../link/review-comment';
import {
  reviewDocuments,
  type ReviewFile,
  type SkippedFile,
  type TabReview,
} from '../link/review-diff';
import { changedMirrorPaths, fileAt, reviewRange } from '../link/review-git';
import { reviewSvg, type ReviewMark } from '../link/review-picture';
import { pictureLine, writePicture } from '../render/png';
import { parsePullFile, sha256 } from '../sync/pull-file';

export type ReviewInput = { base: string; head: string; out: string; imageUrl?: string };

type ReviewOutput = {
  comment: string;
  documents: number;
  tabs: number;
  drawn: number;
  listed: number;
  skipped: number;
  pictures: { file: string; width: number; height: number }[];
  lines: string[];
};

const marksOf = (tab: TabReview, side: 'before' | 'after'): ReviewMark[] =>
  side === 'after'
    ? [
        ...tab.added.map((id) => ({ id, kind: 'added' as const })),
        ...tab.changed.map((id) => ({ id, kind: 'changed' as const })),
      ]
    : [
        ...tab.removed.map((id) => ({ id, kind: 'removed' as const })),
        ...tab.changed.map((id) => ({ id, kind: 'changed' as const })),
      ];

export async function linkReview(io: CliIo, input: ReviewInput): Promise<ReviewOutput> {
  const log = debugLog(io, 'review');
  const range = await reviewRange(io, input.base, input.head);
  const paths = await changedMirrorPaths(io, range);
  log(`range ${range.base} ${range.head} files ${paths.length}`);
  // Each changed file at both commits. A head copy that is no mirror file is named, its base copy unused, so the
  // document is never shown as removed; a base copy that is none reads as absent.
  const skipped: SkippedFile[] = [];
  const before: ReviewFile[] = [];
  const after: ReviewFile[] = [];
  for (const path of paths) {
    const now = await fileAt(io, range.head, path);
    const parsedNow = now === null ? null : parsePullFile(now);
    if (parsedNow && !parsedNow.ok) {
      const conflicted = hasConflictMarkers(now!);
      log(`skipped ${conflicted ? 'conflicted' : 'invalid'}`);
      skipped.push({ path, reason: conflicted ? 'has conflict markers' : parsedNow.message });
      continue;
    }
    if (parsedNow) after.push({ path, file: parsedNow.file });
    const was = await fileAt(io, range.base, path);
    const parsedWas = was === null ? null : parsePullFile(was);
    if (parsedWas?.ok) before.push({ path, file: parsedWas.file });
  }
  const reviewed = reviewDocuments(before, after);
  reviewed.skipped.forEach(() => log('skipped duplicate'));
  skipped.push(...reviewed.skipped);
  const tabs = reviewed.documents.flatMap((doc) => {
    log(`file ${doc.id} ${doc.status}`);
    return doc.tabs.map((tab) => {
      log(
        `tab ${doc.id} ${tab.tabId} ${tab.status} +${tab.added.length} ~${tab.changed.length} -${tab.removed.length}`,
      );
      return tab;
    });
  });
  if (tabs.length > REVIEW_MAX_TABS) log(`capped ${tabs.length - REVIEW_MAX_TABS}`);
  // The first REVIEW_MAX_TABS tabs drawn, each picture named by a hash of its drawing (RL46).
  const outDir = posix.isAbsolute(input.out) ? input.out : posix.join(io.cwd, input.out);
  await io.files.mkdir(outDir);
  const pictures = new Map<TabReview, TabPictures>();
  const written = new Map<string, { file: string; width: number; height: number; line: string }>();
  const draw = async (tab: TabReview, side: 'before' | 'after'): Promise<string | null> => {
    const shown = tab[side];
    if (shown === null) return null;
    const svg = reviewSvg(shown, marksOf(tab, side));
    const file = `${(await sha256(svg)).slice(0, REVIEW_FILE_HEX)}.png`;
    if (!written.has(file)) {
      const picture = await writePicture(io, posix.join(outDir, file), svg, 'png', {
        scale: REVIEW_PNG_SCALE,
        maxSide: REVIEW_PNG_MAX_SIDE,
      });
      const line = pictureLine({ ...picture, path: posix.join(input.out, file) });
      written.set(file, { file, width: picture.width, height: picture.height, line });
    }
    return file;
  };
  for (const tab of tabs.slice(0, REVIEW_MAX_TABS))
    pictures.set(tab, { before: await draw(tab, 'before'), after: await draw(tab, 'after') });
  const comment = reviewCommentText({
    documents: reviewed.documents,
    pictures,
    skipped,
    ...(input.imageUrl === undefined ? {} : { imageUrl: input.imageUrl }),
  });
  await io.files.write(posix.join(outDir, 'comment.md'), comment.text);
  const commentPath = posix.join(input.out, 'comment.md');
  const shown = [...written.values()];
  return {
    comment: commentPath,
    documents: reviewed.documents.length,
    tabs: tabs.length,
    drawn: comment.drawn,
    listed: comment.listed,
    skipped: skipped.length,
    pictures: shown.map(({ file, width, height }) => ({ file, width, height })),
    lines: [commentPath, ...shown.map((p) => p.line)],
  };
}
