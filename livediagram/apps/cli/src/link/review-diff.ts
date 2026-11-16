// What a change did to the mirror files (docs/specs/027-repositories/blueprints/link-review.md "`link review`" step
// 4): the files read at the merge base and at head, paired by document id (RL45), into each document's changed tabs
// and, per tab, the elements added, changed and removed. Pure.

import { canonicalJson, type Tab } from '@livediagram/document';
import type { PullFile } from '../sync/pull-file';

export type ReviewFile = { path: string; file: PullFile };
export type SkippedFile = { path: string; reason: string };
export type ReviewStatus = 'added' | 'removed' | 'changed';

export type TabReview = {
  tabId: string;
  name: string;
  status: ReviewStatus;
  before: Tab | null;
  after: Tab | null;
  added: string[];
  changed: string[];
  removed: string[];
};

export type DocumentReview = {
  id: string;
  name: string;
  host: string;
  path: string;
  status: ReviewStatus;
  tabs: TabReview[];
};

// One file per document; a second file claiming a document already seen is skipped, naming the first.
function byDocument(files: readonly ReviewFile[], skipped: SkippedFile[]): Map<string, ReviewFile> {
  const found = new Map<string, ReviewFile>();
  for (const f of files) {
    const first = found.get(f.file.document.id);
    if (first) skipped.push({ path: f.path, reason: `same document as ${first.path}` });
    else found.set(f.file.document.id, f);
  }
  return found;
}

// The element ids head added, changed and removed, each in its tab's stored order.
function elementChanges(before: Tab | null, after: Tab | null) {
  const was = new Map((before?.elements ?? []).map((el) => [el.id, canonicalJson(el)]));
  const now = new Set((after?.elements ?? []).map((el) => el.id));
  const added: string[] = [];
  const changed: string[] = [];
  for (const el of after?.elements ?? []) {
    const old = was.get(el.id);
    if (old === undefined) added.push(el.id);
    else if (old !== canonicalJson(el)) changed.push(el.id);
  }
  const removed = (before?.elements ?? []).filter((el) => !now.has(el.id)).map((el) => el.id);
  return { added, changed, removed };
}

// Head's tabs in its order, then the tabs only the base had; a tab equal at both is left out.
function tabReviews(before: PullFile | null, after: PullFile | null): TabReview[] {
  const beforeTabs = before?.document.tabs ?? [];
  const afterTabs = after?.document.tabs ?? [];
  const afterIds = new Set(afterTabs.map((t) => t.id));
  const pairs: [Tab | null, Tab | null][] = [
    ...afterTabs.map((t): [Tab | null, Tab] => [beforeTabs.find((b) => b.id === t.id) ?? null, t]),
    ...beforeTabs.filter((t) => !afterIds.has(t.id)).map((t): [Tab, null] => [t, null]),
  ];
  const reviews: TabReview[] = [];
  for (const [was, now] of pairs) {
    if (was && now && canonicalJson(was) === canonicalJson(now)) continue;
    const tab = (now ?? was)!;
    reviews.push({
      tabId: tab.id,
      name: tab.name,
      status: was === null ? 'added' : now === null ? 'removed' : 'changed',
      before: was,
      after: now,
      ...elementChanges(was, now),
    });
  }
  return reviews;
}

export function reviewDocuments(
  before: readonly ReviewFile[],
  after: readonly ReviewFile[],
): { documents: DocumentReview[]; skipped: SkippedFile[] } {
  const skipped: SkippedFile[] = [];
  const was = byDocument(before, skipped);
  const now = byDocument(after, skipped);
  const documents: DocumentReview[] = [];
  const add = (id: string, old: ReviewFile | undefined, current: ReviewFile | undefined) => {
    const shown = (current ?? old)!;
    const tabs = tabReviews(old?.file ?? null, current?.file ?? null);
    if (tabs.length === 0) return;
    documents.push({
      id,
      name: shown.file.document.name,
      host: shown.file.livediagramSync.host,
      path: shown.path,
      status: old === undefined ? 'added' : current === undefined ? 'removed' : 'changed',
      tabs,
    });
  };
  for (const [id, current] of now) add(id, was.get(id), current);
  for (const [id, old] of was) if (!now.has(id)) add(id, old, undefined);
  return { documents, skipped };
}
