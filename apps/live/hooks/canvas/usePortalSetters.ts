// Setters for the Behaviour elements (spec/104-107), off useEditorState rather
// than the style hook: a portal link is the one element setting that reaches
// ACROSS TABS, so these need the whole tab list and a tabs-wide commit, not the
// active tab's element mapper every other setter uses — and the session button,
// reveal zone, and picker settings sit beside it because they are configured
// from the same menu, on the same kinds of element.
//
// Three actions, all keyed off the current selection:
//  - link this portal to another (either tab), or unlink it,
//  - rename it (the name shows in the menu + tooltips, never on the canvas),
//  - create a fresh portal already linked to this one, for when the place you
//    want to lead to doesn't exist yet.

import {
  createShape,
  type PickerSource,
  type Reaction,
  type SessionButtonConfig,
  type ShapeElement,
  type Tab,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

// How far to the right of its partner a freshly created portal lands, in canvas
// px: clear of the source, close enough to still be on screen with it.
const NEW_PORTAL_GAP = 96;

export function usePortalSetters({
  currentSelectionIds,
  contextTargetId,
  commitTabs,
  tabs,
  activeId,
  setSelectedId,
}: {
  currentSelectionIds: () => Set<string>;
  // The element the open context menu is acting on. The menu can be opened on
  // an element WITHOUT it being the current selection (right-clicking while a
  // draw gesture is armed, say), and these setters are only ever driven from
  // that menu — so the menu's target is the authority, with the selection as
  // the fallback for a multi-select.
  contextTargetId: string | null;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => unknown;
  tabs: Tab[];
  activeId: string;
  setSelectedId: (id: string | null) => void;
}) {
  // The selected portals on the active tab — the only place a selection can
  // live, so the sources are always local even when the target isn't.
  const selectedPortals = (): ShapeElement[] => {
    const tab = tabs.find((t) => t.id === activeId);
    if (!tab) return [];
    const ids = currentSelectionIds();
    const isPortal = (el: (typeof tab.elements)[number]): el is ShapeElement =>
      el.type === 'shape' && el.shape === 'portal';
    const selected = tab.elements.filter((el) => ids.has(el.id) && isPortal(el)) as ShapeElement[];
    if (selected.length > 0) return selected;
    const targeted = tab.elements.find((el) => el.id === contextTargetId && isPortal(el));
    return targeted ? [targeted as ShapeElement] : [];
  };

  // Link this portal to `targetId` (a portal on ANY tab), or unlink with null.
  //
  // A link is a PAIR, not an arrow: whatever you can step into, you can step
  // back out of. So writing one side writes the other — the target is pointed
  // back at the portal you linked it from — and any third portal still holding
  // a claim on either end is released, since a portal leads to exactly one
  // place. Doing this in the DATA (rather than inferring "who points at me?"
  // only at travel time) keeps the picker honest: both ends show the pairing.
  const setPortalTargetSelected = (targetId: string | null) => {
    const sources = selectedPortals();
    if (sources.length === 0) return;
    // With a multi-selection the last source claims the return link, matching
    // the "one portal leads to one place" rule.
    const back = sources[sources.length - 1]!.id;
    const sourceIds = new Set(sources.map((s) => s.id));
    commitTabs((ts) =>
      ts.map((tab) => ({
        ...tab,
        elements: tab.elements.map((el) => {
          if (el.type !== 'shape' || el.shape !== 'portal') return el;
          if (sourceIds.has(el.id)) return { ...el, portalTarget: targetId ?? undefined };
          if (targetId && el.id === targetId) return { ...el, portalTarget: back };
          if (el.portalTarget && (sourceIds.has(el.portalTarget) || el.portalTarget === targetId)) {
            return { ...el, portalTarget: undefined };
          }
          return el;
        }),
      })),
    );
    track('Element', 'Changed', 'Portal');
  };

  // The portal's name. It is menu-and-tooltip only — the canvas ring stays
  // clean — so this is the only place it can be typed, and an empty name falls
  // back to the positional "Portal 2" everywhere it's shown.
  const setPortalNameSelected = (name: string) => {
    const sources = selectedPortals();
    if (sources.length === 0) return;
    const ids = new Set(sources.map((s) => s.id));
    const trimmed = name.trim();
    commitTabs((ts) =>
      ts.map((tab) =>
        tab.id !== activeId
          ? tab
          : {
              ...tab,
              elements: tab.elements.map((el) =>
                ids.has(el.id) ? { ...el, label: trimmed || undefined } : el,
              ),
            },
      ),
    );
  };

  // Create a second portal, already linked to this one, beside it. The common
  // case for a first portal is that its other end doesn't exist yet, and making
  // the user drop a second portal, find it in the list, and link it is three
  // steps for one intent.
  const createLinkedPortal = () => {
    const sources = selectedPortals();
    const source = sources[sources.length - 1];
    if (!source) return;
    const created = createShape('portal', source.x + source.width + NEW_PORTAL_GAP, source.y);
    // Both ends written at once, and anything that used to point at the source
    // released — same exclusivity rule as picking an existing portal.
    commitTabs((ts) =>
      ts.map((tab) =>
        tab.id !== activeId
          ? tab
          : {
              ...tab,
              elements: [
                ...tab.elements.map((el) => {
                  if (el.type !== 'shape' || el.shape !== 'portal') return el;
                  if (el.id === source.id) return { ...el, portalTarget: created.id };
                  if (el.portalTarget === source.id) return { ...el, portalTarget: undefined };
                  return el;
                }),
                { ...created, portalTarget: source.id },
              ],
            },
      ),
    );
    // Select the new one: it's the thing you now want to drag into place.
    setSelectedId(created.id);
    track('Element', 'Added', 'Portal');
  };

  // The remaining Behaviour settings are ordinary active-tab patches on the
  // element the menu is acting on: what a session button starts (spec/105),
  // whether a cover is off for everyone (spec/106), and where a picker draws
  // its candidates from (spec/107).
  const patchTarget = (patch: Partial<ShapeElement>, kind: string, telemetry: string) => {
    const tab = tabs.find((t) => t.id === activeId);
    const ids = currentSelectionIds();
    const targets = (tab?.elements ?? []).filter(
      (el): el is ShapeElement =>
        el.type === 'shape' && el.shape === kind && (ids.has(el.id) || el.id === contextTargetId),
    );
    if (targets.length === 0) return;
    const targetIds = new Set(targets.map((t) => t.id));
    commitTabs((ts) =>
      ts.map((t) =>
        t.id !== activeId
          ? t
          : {
              ...t,
              elements: t.elements.map((el) =>
                el.type === 'shape' && targetIds.has(el.id) ? { ...el, ...patch } : el,
              ),
            },
      ),
    );
    track('Element', 'Changed', telemetry);
  };

  const setSessionConfigSelected = (session: SessionButtonConfig) =>
    patchTarget({ session }, 'session-button', 'SessionButton');
  const setRevealedSelected = (revealed: boolean) => patchTarget({ revealed }, 'reveal', 'Reveal');
  const setPickerSourceSelected = (pickerSource: PickerSource) =>
    patchTarget({ pickerSource }, 'picker', 'Picker');
  const setPickerOptionsSelected = (pickerOptions: string[]) =>
    patchTarget({ pickerOptions }, 'picker', 'Picker');
  // Reaction pad (spec/135): which burst it throws.
  const setReactionSelected = (reaction: Reaction) =>
    patchTarget({ reaction }, 'reaction-pad', 'ReactionPad');

  return {
    setPortalTargetSelected,
    setPortalNameSelected,
    createLinkedPortal,
    setSessionConfigSelected,
    setRevealedSelected,
    setPickerSourceSelected,
    setPickerOptionsSelected,
    setReactionSelected,
  };
}
