import { useState } from 'react';
import {
  bestAnchorTowards,
  isBoxed,
  rebindArrowAnchorsAfterMove,
  type ArrowElement,
  type Tab,
} from '@livediagram/diagram';
import { getTheme } from '@/lib/themes';
import { track } from '@/lib/telemetry';

// CLICK-TO-CONNECT (spec/09): pick the arrow tool with a shape selected and
// the next element you click is joined to it by a pinned arrow.
//
// Split out of useElementCreation, which is otherwise a catalogue of small
// "add one of these" handlers. This is the one thing in it that is a GESTURE:
// it owns state between two clicks, and its three parts only make sense
// together — arm the source, complete to a target, or abandon.
//
// The armed id is returned rather than kept private because two surfaces need
// to see it: EditorView shows the "click a shape to connect" bar while it is
// set, and the drag handlers route a plain click into connectArrowTo instead
// of a selection.

export function useArrowConnect({
  editsBlocked,
  activeId,
  activeTab,
  selectedId,
  setSelectedId,
  beginDraw,
  commitTabs,
}: {
  editsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  beginDraw: (intent: { type: 'arrow' }) => void;
  commitTabs: (fn: (tabs: Tab[]) => Tab[]) => void;
}) {
  // Click-to-connect (spec/09): when the arrow tool is picked WITH a
  // shape selected, the next element click connects the two with a
  // pinned arrow. `connectSourceId` holds that armed source; null when
  // not connecting. The canvas / Escape clear it (see EditorView).
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const cancelConnect = () => setConnectSourceId(null);

  // Arm connect-from-selection when a shape is selected; otherwise fall
  // back to the draw-to-place connector (free endpoints, dragged onto
  // shapes later). The palette + the A shortcut both route here.
  const addArrow = () => {
    if (editsBlocked) return;
    const sel = selectedId ? activeTab.elements.find((e) => e.id === selectedId) : null;
    if (sel && isBoxed(sel)) {
      setConnectSourceId(sel.id);
      return;
    }
    beginDraw({ type: 'arrow' });
  };

  // Complete the connect gesture: draw a pinned arrow from the armed
  // source to `toId`, picking the anchor on each shape that faces the
  // other (bestAnchorTowards) and inheriting the source's stroke so it
  // matches the theme. No-ops if either end isn't a shape or it's the
  // same element. Clears the armed state either way.
  const connectArrowTo = (toId: string) => {
    const fromId = connectSourceId;
    setConnectSourceId(null);
    if (editsBlocked || !fromId || fromId === toId) return;
    const from = activeTab.elements.find((e) => e.id === fromId);
    const to = activeTab.elements.find((e) => e.id === toId);
    if (!from || !to || !isBoxed(from) || !isBoxed(to)) return;
    const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
    // Pick the geometrically-best face on each endpoint, facing the other
    // element. We deliberately DON'T avoid faces other arrows already use:
    // sharing a start/end point is allowed, and steering off the natural
    // face just to dodge an occupied one produced visibly worse connectors.
    const theme = getTheme(activeTab.theme);
    const stroke = from.strokeColor ?? theme.elementStroke ?? undefined;
    const arrow: ArrowElement = {
      id: crypto.randomUUID(),
      type: 'arrow',
      from: {
        kind: 'pinned',
        elementId: fromId,
        anchor: bestAnchorTowards(from, toCenter),
      },
      to: {
        kind: 'pinned',
        elementId: toId,
        anchor: bestAnchorTowards(to, fromCenter),
      },
      ...(stroke ? { strokeColor: stroke } : {}),
    };
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? {
              ...t,
              // Run the new arrow through the same distribution pass a move
              // uses (spec/09), scoped to its target end: a fresh connector
              // joins an established fan on the source (sibling vote over
              // the settled arrows' faces) instead of keeping whichever
              // face its own chord grazes first.
              elements: rebindArrowAnchorsAfterMove([...t.elements, arrow], new Set([toId])),
              templateChosen: true,
            }
          : t,
      ),
    );
    setSelectedId(arrow.id);
    track('Element', 'Added', 'Arrow');
  };
  return { connectSourceId, cancelConnect, addArrow, connectArrowTo };
}
