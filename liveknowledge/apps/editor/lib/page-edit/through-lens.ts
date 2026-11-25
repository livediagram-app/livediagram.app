// The lenses every commit and tick on a page passes through (docs/specs/030-knowledgebase/blueprints/editing.md "The
// choice", page-surface.md "The narrow view"): the page being edited as its draft (lens.ts), the page drawn through
// the narrow view (page-view-lens.ts) on top of either. A map runs on the page as this window draws it and comes back
// lowered: the draft written, the narrow layout never stored. Pure but for the refs and the view store it reads.
import type { Tab } from '@liveknowledge/document';
import { liftTabs, lowerTabs, type LensWriter } from './lens';
import { liftViewTabs, lowerViewTabs } from '@/lib/page-surface/page-view-lens';
import { pageViewState, type PageViewState } from '@/lib/page-surface/page-view-store';

type PageEditRef = { readonly current: { tabId: string; writer: LensWriter } | null };
type PageViewRef = { readonly current: string | null };
type MapTabs = (ts: Tab[]) => Tab[];

// A map over the tabs through the narrow view of the page drawn, when this window draws it narrower than it is
// stored: lifted, mapped, lowered back, so the narrow layout is never written.
function throughViewLens(
  viewRef: PageViewRef,
  mapTabs: MapTabs,
  view: () => PageViewState,
): MapTabs {
  return (ts) => {
    const tabId = viewRef.current;
    if (!tabId) return mapTabs(ts);
    const lifted = liftViewTabs(ts, tabId, view());
    if (lifted === ts) return mapTabs(ts);
    return lowerViewTabs(ts, lifted, mapTabs(lifted), tabId);
  };
}

/**
 * Every map over the tabs, while a page is being edited, runs over that page as its draft: lifted into the lens,
 * mapped, lowered back. A map with no page being edited runs as it is. The narrow view sits on top of either, as it
 * does where the page is drawn (useEditorCollaboration): lift edit, lift view, map, lower view, lower edit.
 */
export function throughPageLens(
  ref: PageEditRef,
  viewRef: PageViewRef,
  mapTabsOuter: MapTabs,
  view: () => PageViewState = pageViewState,
): MapTabs {
  const mapTabs = throughViewLens(viewRef, mapTabsOuter, view);
  return (ts) => {
    const editing = ref.current;
    if (!editing) return mapTabs(ts);
    // Lowered even when the lens is the tab itself (a page with no draft yet): its first change makes the draft.
    const lifted = liftTabs(ts, editing.tabId);
    return lowerTabs(ts, lifted, mapTabs(lifted), editing.tabId, editing.writer);
  };
}
