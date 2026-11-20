// Setters for the Behaviour elements' menu settings (docs/specs/012-collaboration/session-button.md,
// docs/specs/009-elements/reveal-zone.md, docs/specs/012-collaboration/picker.md, docs/specs/009-elements/reaction-pad.md),
// keyed off the element the open menu is acting on, with the selection as the fallback for a multi-select.
// (The Portal's cross-tab link setters lived here too until the Portal moved to livehuddle, Work Tracker 1318.)

import {
  type PickerSource,
  type Reaction,
  type SessionButtonConfig,
  type ShapeElement,
  type Tab,
} from '@livediagram/document';
import { track } from '@/lib/telemetry';

export function useBehaviourSetters({
  currentSelectionIds,
  contextTargetId,
  commitTabs,
  tabs,
  activeId,
  sessionToolsBlocked,
}: {
  currentSelectionIds: () => Set<string>;
  // The element the open context menu is acting on. The menu can be opened on
  // an element WITHOUT it being the current selection (right-clicking while a
  // draw gesture is armed, say), and these setters are only ever driven from
  // that menu, so the menu's target is the authority, with the selection as
  // the fallback for a multi-select.
  contextTargetId: string | null;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => unknown;
  tabs: Tab[];
  activeId: string;
  // Somebody else holds the baton (docs/specs/012-collaboration/facilitator.md "What the facilitator runs"):
  // configuring a session button and lifting a cover for the room are theirs.
  sessionToolsBlocked: boolean;
}) {
  // Each setting is an ordinary active-tab patch on the element the menu is
  // acting on: what a session button starts (docs/specs/012-collaboration/session-button.md),
  // whether a cover is off for everyone (docs/specs/009-elements/reveal-zone.md), and where a picker draws
  // its candidates from (docs/specs/012-collaboration/picker.md).
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

  const setSessionConfigSelected = (session: SessionButtonConfig) => {
    if (sessionToolsBlocked) return;
    patchTarget({ session }, 'session-button', 'SessionButton');
  };
  const setRevealedSelected = (revealed: boolean) => {
    if (sessionToolsBlocked) return;
    patchTarget({ revealed }, 'reveal', 'Reveal');
  };
  const setPickerSourceSelected = (pickerSource: PickerSource) =>
    patchTarget({ pickerSource }, 'picker', 'Picker');
  const setPickerOptionsSelected = (pickerOptions: string[]) =>
    patchTarget({ pickerOptions }, 'picker', 'Picker');
  // Reaction pad (docs/specs/009-elements/reaction-pad.md): which burst it throws.
  const setReactionSelected = (reaction: Reaction) =>
    patchTarget({ reaction }, 'reaction-pad', 'ReactionPad');

  return {
    setSessionConfigSelected,
    setRevealedSelected,
    setPickerSourceSelected,
    setPickerOptionsSelected,
    setReactionSelected,
  };
}
