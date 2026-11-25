// The Page Design panel's edits (docs/specs/011-theme/canvas-and-theme-dialog.md "Page Design"): the tab's design and
// a page's own, each pick one undo step and each slider gesture one step a burst (tickTabs + checkpointBurst). Telemetry names the action only, never a design's settings
// (docs/specs/011-theme/page-designs.md "Telemetry").
import {
  pageDesignSet,
  tabPageDesignOf,
  withEveryPageOnTabDesign,
  withTabPageDesign,
  type PageDesign,
  type Tab,
} from '@livedocuments/document';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { markDesignTuning } from '@/lib/page-design-tuning';
import { track } from '@/lib/telemetry';

export type PageDesignEdits = {
  // A pick (or null: none) for the whole tab. `everyPage`: every unlocked page's own design dropped in the same step
  // (Affect All Pages), so every page wears it.
  setTabDesign: (design: PageDesign | null, options?: { everyPage?: boolean }) => void;
  // A fine-tune of the tab's design: a slider's ticks are one undo step a gesture.
  tuneTabDesign: (design: PageDesign) => void;
  // A page's own: a design, 'none' or null (the tab's again).
  setPageDesign: (pageId: string, design: PageDesign | 'none' | null) => void;
  tunePageDesign: (pageId: string, design: PageDesign) => void;
  // A design saved to the Library (docs/specs/011-theme/page-designs.md "Saved designs"), applied to the tab or a page.
  applySavedDesign: (design: PageDesign, pageId: string | null) => void;
  // Whether this session may change designs (an Editor's); a Participant's or Viewer's may not, nor save one.
  blocked: boolean;
};

type Deps = {
  editsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  checkpointBurst: (key: string) => void;
  notify?: (message: string) => void;
};

const LOCKED = 'This page is locked: unlock it to change its design.';

// A page's own design takes no rhythm or flow (the tab design's): a saved design applied to a page leaves them out.
function pageOverrideOf(design: PageDesign): PageDesign {
  const { rhythm: _rhythm, flow: _flow, ...own } = design;
  return own;
}

// A slider's drag sends many ticks: its telemetry is one event a gesture (ticks closer than this are one).
const TUNED_GAP_MS = 1500;
let lastTuned = 0;
function trackTuned(now = Date.now()) {
  if (now - lastTuned > TUNED_GAP_MS) track('Tab', 'Changed', 'PageDesignTuned');
  lastTuned = now;
}

export function pageDesignEdits({
  editsBlocked,
  activeId,
  activeTab,
  commitTabs,
  tickTabs,
  checkpointBurst,
  notify,
}: Deps): PageDesignEdits {
  const onActive = (ts: Tab[], fn: (t: Tab) => Tab) =>
    ts.map((t) => (t.id === activeId ? fn(t) : t));
  const pageEdit = (pageId: string, design: PageDesign | 'none' | null) => (t: Tab) => {
    const edit = pageDesignSet(t, pageId, design);
    return 'tab' in edit ? edit.tab : t;
  };
  const setTabDesign = (design: PageDesign | null, options?: { everyPage?: boolean }) => {
    if (editsBlocked) return;
    const was = tabPageDesignOf(activeTab);
    commitTabs((ts) =>
      onActive(ts, (t) => {
        const set = withTabPageDesign(t, design);
        return options?.everyPage ? withEveryPageOnTabDesign(set) : set;
      }),
    );
    // A new design is a pick; the same design changed is a tune.
    if (was?.id === design?.id && design) trackTuned();
    else track('Tab', 'Changed', 'PageDesign');
    if (design?.animate && !was?.animate) track('Tab', 'Changed', 'PageDesignAnimated');
    debugLog('[page-design] set', { tabId: activeId, id: design?.id ?? null, scope: 'tab' });
  };
  return {
    blocked: editsBlocked,
    applySavedDesign: (design, pageId) => {
      if (editsBlocked) return;
      if (pageId) {
        const own = pageOverrideOf(design);
        const check = pageDesignSet(activeTab, pageId, own);
        if ('refused' in check) {
          if (check.refused === 'locked') notify?.(LOCKED);
          return;
        }
        commitTabs((ts) => onActive(ts, pageEdit(pageId, own)));
      } else {
        commitTabs((ts) => onActive(ts, (t) => withTabPageDesign(t, design)));
      }
      track('Tab', 'Changed', 'PageDesignSavedApplied');
      debugLog('[page-design] set', { tabId: activeId, id: design.id, scope: 'saved' });
    },
    setTabDesign,
    tuneTabDesign: (design) => {
      if (editsBlocked) return;
      checkpointBurst('pageDesign');
      markDesignTuning();
      tickTabs((ts) => onActive(ts, (t) => withTabPageDesign(t, design)));
      trackTuned();
    },
    setPageDesign: (pageId, design) => {
      if (editsBlocked) return;
      const check = pageDesignSet(activeTab, pageId, design);
      if ('refused' in check) {
        if (check.refused === 'locked') notify?.(LOCKED);
        return;
      }
      commitTabs((ts) => onActive(ts, pageEdit(pageId, design)));
      track('Tab', 'Changed', 'PageDesignPage');
      debugLog('[page-design] set', {
        tabId: activeId,
        id: design === null ? 'tab' : design === 'none' ? 'none' : design.id,
        scope: 'page',
      });
    },
    tunePageDesign: (pageId, design) => {
      if (editsBlocked) return;
      checkpointBurst(`pageDesign:${pageId}`);
      markDesignTuning();
      tickTabs((ts) => onActive(ts, pageEdit(pageId, design)));
      trackTuned();
    },
  };
}
