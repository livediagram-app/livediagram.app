// Element link picker + link actions, lifted out of editor-page.tsx.
// Bundles the picker's open/anchor state with the four handlers that
// read or write an element's `link` field:
//
// - `linkPickerOpenForId`: which element's link picker is open (null =
//   closed). Drives the <LinkPickerDialog> gate in the page. The dialog
//   is a centred modal (styled like import/export), so no DOM anchoring
//   is needed any more.
// - `applyElementLink`: write a chosen link (tab / diagram / element /
//   url) onto the current selection, or remove it when passed null.
//   History-committed.
// - `followLink`: navigate — switch tab for tab/element links, full
//   page-load to another diagram, or open an external URL in a new tab.

import { useState } from 'react';
import { type Element, type ElementLink, type Tab } from '@livediagram/diagram';
import { apiUnfurl } from '@/lib/api-client';
import { isSafeFollowUrl } from '@/lib/url-safety';
import { track } from '@/lib/telemetry';

type ElementLinksDeps = {
  // The active selection resolved to ids. The link writers no-op on an
  // empty selection.
  currentSelectionIds: () => Set<string>;
  // History-aware element mutator (snapshots + emits the log).
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // Open tabs — followLink only switches to a tab that still exists.
  tabs: Tab[];
  setActiveId: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  setFormatSourceId: (id: string | null) => void;
  setGroupSourceId: (id: string | null) => void;
  // Full page-load navigation to another diagram (for diagram links).
  openDiagram: (id: string) => void;
};

export function useElementLinks(deps: ElementLinksDeps) {
  const {
    currentSelectionIds,
    commit,
    tabs,
    setActiveId,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
    setGroupSourceId,
    openDiagram,
  } = deps;

  // Link picker state. Lives at the page level (rather than inside
  // SelectionPopover, where the toolbar button used to host it) so the
  // right-click context menu can open it without reaching across
  // components. Holds the element id whose link is being edited.
  const [linkPickerOpenForId, setLinkPickerOpenForId] = useState<string | null>(null);
  // Which tab the link modal should open on (webpage / tab / diagram), set by
  // the context menu's split Link entries. null = let the dialog pick its own
  // default (the existing link's kind, else webpage).
  const [linkPickerInitialMode, setLinkPickerInitialMode] = useState<
    'url' | 'tab' | 'diagram' | null
  >(null);
  // Open the link picker for an element, optionally pre-selecting a mode.
  const openLinkPicker = (elementId: string, mode?: 'url' | 'tab' | 'diagram') => {
    setLinkPickerInitialMode(mode ?? null);
    setLinkPickerOpenForId(elementId);
  };

  // Apply a chosen link to the current selection, or remove it when
  // null. One entry point for every kind (tab / diagram / element /
  // url), history-committed. Multi-selection links them all the same.
  const applyElementLink = (link: ElementLink | null) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => {
        if (!ids.has(el.id)) return el;
        if (link === null) {
          const { link: _drop, ...rest } = el;
          return rest as typeof el;
        }
        return { ...el, link };
      }),
    );
    // Link-card unfurl (spec/40): when a URL lands on a link-card, fetch its
    // preview ONCE here (the setter) and cache it on the element; peers get
    // it via the normal tab sync. Fails soft — the card shows the bare URL.
    if (link?.kind === 'url') {
      const url = link.url;
      void apiUnfurl(url).then((meta) => {
        if (!meta) return;
        commit((els) =>
          els.map((el) =>
            ids.has(el.id) &&
            el.type === 'link-card' &&
            el.link?.kind === 'url' &&
            el.link.url === url
              ? // Key the cached meta to the REQUESTED url (the one on the
                // element's link), not the server's final post-redirect url —
                // otherwise a redirect (trailing slash / https / www, which is
                // most URLs) makes meta.url !== link.url and LinkCardView
                // discards the preview, so the card looks like it lost its link.
                { ...el, meta: { ...meta, url } }
              : el,
          ),
        );
        track('Element', 'Changed', 'LinkUnfurled');
      });
    }
  };

  const followLink = (link: ElementLink) => {
    if (link.kind === 'tab' || link.kind === 'element') {
      if (!tabs.some((t) => t.id === link.tabId)) return;
      setActiveId(link.tabId);
      setSelectedId(null);
      setEditingId(null);
      setFormatSourceId(null);
      setGroupSourceId(null);
      return;
    }
    if (link.kind === 'diagram') {
      // Navigate to a different diagram entirely. Same shape as
      // openDiagram (which does a full-page load), so saves +
      // realtime room handoff land through the normal hydration
      // path on the destination route.
      openDiagram(link.diagramId);
      return;
    }
    if (link.kind === 'url') {
      // Only open http/https/mailto: a stored `javascript:` / `data:` URL would
      // otherwise execute in our origin via window.open (noopener doesn't stop
      // it). normaliseUrl gates this at store time too; this is defence-in-depth
      // for older data. See lib/url-safety.ts.
      if (!isSafeFollowUrl(link.url)) return;
      // External address: new tab, noopener so the opened page can't
      // reach back into this one via window.opener.
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  };

  return {
    linkPickerOpenForId,
    setLinkPickerOpenForId,
    linkPickerInitialMode,
    openLinkPicker,
    applyElementLink,
    followLink,
  };
}
