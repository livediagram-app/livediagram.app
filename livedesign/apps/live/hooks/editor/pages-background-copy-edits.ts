// A page's background given to other pages from the editor (docs/specs/007-editor/
// pages-mode.md "Copying a background"): the Background tab's Apply to All, and the Format
// tool painting one page's background onto another. Each is one tab edit (one undo step, synced),
// the pages it reaches re-inked as a pick on each would; the pure edits are the document package's.
import {
  backgroundPatchFor,
  pageBackgroundCopied,
  pageBackgroundSpread,
  pageKindOf,
  pageLockRefuses,
  pagesSharing,
  type Page,
  type PageKind,
  type Tab,
} from '@livedesign/document';
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
  infographic: { one: 'infographic page', many: 'Infographic Pages' },
  logo: { one: 'logo page', many: 'Logo Pages' },
  wireframe: { one: 'wireframe page', many: 'Wireframe Pages' },
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
  mayEdit = () => true,
}: {
  tabId: string;
  current: readonly Page[];
  commitTab: (change: (t: Tab) => Tab | null) => void;
  toastInfo: (message: string) => void;
  // Whether this person may still edit, asked before anything is said or counted: the commit drops
  // the edit of someone who no longer may, and a notice or event for it would be untrue.
  mayEdit?: () => boolean;
}): BackgroundCopyEdits {
  // The other pages of a page's kind Apply to All reaches.
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
    if (!source || targets.length === 0 || !mayEdit()) return;
    // A locked page keeps its own.
    const skipped = targets.filter((p) => pageLockRefuses(current, p.id)).length;
    track('Tab', 'Changed', 'PageBackgroundAppliedToAll');
    commitTab((t) => {
      const out = pageBackgroundSpread(t, pageId, pageInkMemory(tabId));
      if ('refused' in out) return null;
      if (out.memory) rememberPageInk(tabId, out.memory);
      return out.tab === t ? null : out.tab;
    });
    toastInfo(appliedToAllMessage(pageKindOf(source), targets.length - skipped, skipped));
    debugLog('[page] background applied to all', {
      tabId,
      pageId,
      reach: targets.length,
      skipped,
    });
  };

  const copyBackground = (fromPageId: string, toPageId: string) => {
    const from = current.find((p) => p.id === fromPageId);
    const to = current.find((p) => p.id === toPageId);
    if (!from || !to || pagesSharing(current, fromPageId).has(toPageId) || !mayEdit()) return false;
    if (pageLockRefuses(current, toPageId)) {
      toastInfo('That page is locked. Unlock it to change its background.');
      debugLog('[page] paint refused: page locked', { tabId, toPageId });
      return false;
    }
    if (!backgroundPatchFor(to, from.background)) {
      toastInfo('A logo page takes no picture background.');
      debugLog('[page] paint refused: picture on a logo page', { tabId, toPageId });
      return false;
    }
    track('Tab', 'Changed', 'PageBackgroundPainted');
    commitTab((t) => {
      const out = pageBackgroundCopied(t, fromPageId, toPageId, pageInkMemory(tabId));
      if ('refused' in out) return null;
      if (out.memory) rememberPageInk(tabId, out.memory);
      return out.tab === t ? null : out.tab;
    });
    debugLog('[page] background painted', { tabId, fromPageId, toPageId });
    return true;
  };

  // Every page's title bar asks its reach on every render (a pan, a zoom): counted once per kind
  // here, then answered per page without a scan, rather than O(pages) a page.
  let reachOf: Map<string, number> | null = null;
  const applyToAllReach = (pageId: string) => {
    if (!reachOf) {
      const byKind = new Map<PageKind, number>();
      for (const p of current) {
        const kind = pageKindOf(p);
        byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
      }
      reachOf = new Map(current.map((p) => [p.id, byKind.get(pageKindOf(p))! - 1]));
    }
    return reachOf.get(pageId) ?? 0;
  };

  return {
    applyToAllReach,
    applyBackgroundToAll,
    copyBackground,
  };
}
