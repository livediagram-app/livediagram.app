// A page's background given to other pages from the editor (docs/specs/007-editor/
// illustrate-pages.md "Copying a background"): the Background tab's Apply to All, and the Format
// tool painting one page's background onto another. Each is one tab edit (one undo step, synced),
// the pages it reaches re-inked as a pick on each would; the pure edits are the document package's.
import {
  backgroundPatchFor,
  pageBackgroundCopied,
  pageBackgroundSpread,
  pageKindOf,
  pageLockRefuses,
  pagesSharing,
  type IllustratePage,
  type PageKind,
  type Tab,
} from '@livediagram/document';
import { pageInkMemory, rememberPageInk } from '@/lib/page-ink-memory';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';

export type BackgroundCopyEdits = {
  // How many other pages of this page's kind Apply to All would reach (0 hides it).
  applyToAllReach: (pageId: string) => number;
  applyBackgroundToAll: (pageId: string) => void;
  // One page's background onto another (the Format tool); false when the target cannot take it.
  copyBackground: (fromPageId: string, toPageId: string) => boolean;
};

/** The pages of a kind, as Apply to All names them in its button and its notice. */
export const KIND_PAGES: Record<PageKind, { one: string; many: string }> = {
  slide: { one: 'slide', many: 'Slides' },
  infographic: { one: 'infographic page', many: 'Infographic Pages' },
  article: { one: 'article page', many: 'Article Pages' },
  logo: { one: 'logo page', many: 'Logo Pages' },
};

/** What Apply to All says it did: "Background applied to 35 slides." and the locked it skipped. */
export function appliedToAllMessage(kind: PageKind, applied: number, skipped: number): string {
  const { one } = KIND_PAGES[kind];
  const n = (count: number) => `${count} ${one}${count === 1 ? '' : 's'}`;
  const done = `Background applied to ${n(applied)}.`;
  if (skipped === 0) return done;
  const kept = `${skipped} locked ${one}${skipped === 1 ? '' : 's'} kept ${skipped === 1 ? 'its' : 'their'} own.`;
  return applied === 0 ? `Every other ${one} is locked: ${kept}` : `${done} ${kept}`;
}

export function backgroundCopyEdits({
  tabId,
  current,
  commitTab,
  toastInfo,
}: {
  tabId: string;
  current: readonly IllustratePage[];
  commitTab: (change: (t: Tab) => Tab | null) => void;
  toastInfo: (message: string) => void;
}): BackgroundCopyEdits {
  // The other pages of a page's kind Apply to All reaches, outside its own article.
  const targetsOf = (pageId: string) => {
    const source = current.find((p) => p.id === pageId);
    if (!source) return [];
    const kind = pageKindOf(source);
    const own = pagesSharing(current, pageId);
    return current.filter((p) => pageKindOf(p) === kind && !own.has(p.id));
  };

  const applyBackgroundToAll = (pageId: string) => {
    const source = current.find((p) => p.id === pageId);
    const targets = targetsOf(pageId);
    if (!source || targets.length === 0) return;
    // A locked page keeps its own (and, for an article, any lock holds its whole article).
    const skipped = targets.filter((p) => pageLockRefuses(current, p.id)).length;
    track('Tab', 'Changed', 'PageBackgroundAppliedToAll');
    commitTab((t) => {
      const out = pageBackgroundSpread(t, pageId, pageInkMemory(tabId));
      if ('refused' in out) return null;
      if (out.memory) rememberPageInk(tabId, out.memory);
      return out.tab === t ? null : out.tab;
    });
    toastInfo(appliedToAllMessage(pageKindOf(source), targets.length - skipped, skipped));
    debugLog('[illustrate-page] background applied to all', {
      tabId,
      pageId,
      reach: targets.length,
      skipped,
    });
  };

  const copyBackground = (fromPageId: string, toPageId: string) => {
    const from = current.find((p) => p.id === fromPageId);
    const to = current.find((p) => p.id === toPageId);
    if (!from || !to || pagesSharing(current, fromPageId).has(toPageId)) return false;
    if (pageLockRefuses(current, toPageId)) {
      toastInfo('That page is locked. Unlock it to change its background.');
      debugLog('[illustrate-page] paint refused: page locked', { tabId, toPageId });
      return false;
    }
    if (!backgroundPatchFor(to, from.background)) {
      toastInfo('A logo page takes no picture background.');
      debugLog('[illustrate-page] paint refused: picture on a logo page', { tabId, toPageId });
      return false;
    }
    track('Tab', 'Changed', 'PageBackgroundPainted');
    commitTab((t) => {
      const out = pageBackgroundCopied(t, fromPageId, toPageId, pageInkMemory(tabId));
      if ('refused' in out) return null;
      if (out.memory) rememberPageInk(tabId, out.memory);
      return out.tab === t ? null : out.tab;
    });
    debugLog('[illustrate-page] background painted', { tabId, fromPageId, toPageId });
    return true;
  };

  return {
    applyToAllReach: (pageId) => targetsOf(pageId).length,
    applyBackgroundToAll,
    copyBackground,
  };
}
