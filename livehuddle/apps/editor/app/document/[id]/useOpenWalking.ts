// Opening walking (docs/specs/008-canvas/avatar-mode.md "Opening walking"): the first time a tab that offers the walk
// is shown with its elements in a visit, the editor enters Avatar mode, for every role. Once per tab per visit, so
// leaving the mode is yours to keep. Its own slice, composed into useEditorState.
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import type { Element, Layer } from '@livehuddle/document';
import type { AvatarPoint } from '@liveworkspace/avatar/walk';
import { walkEntrance } from '@/lib/walk-entrance';

// Where the canvas starts the character (just below the tab's Walk In button), with a sequence number so the same
// spot asked for twice is still a fresh request. A pad needs none: the walk's own entry starts it on the pad.
export type WalkIn = { feet: AvatarPoint; seq: number };

export function useOpenWalking({
  enabled,
  tabId,
  elements,
  layers,
  loaded,
  walking,
  openWalking,
}: {
  // Off in an embed (it opens on Hand, with no palette to leave the mode by).
  enabled: boolean;
  tabId: string;
  elements: Element[];
  layers: Layer[] | undefined;
  // The tab's content has arrived: a tab is judged once, then, never while it is still on its way.
  loaded: boolean;
  walking: boolean;
  openWalking: () => void;
}) {
  // The tabs judged this visit. A ref, not state: judging one changes nothing on screen by itself.
  const judged = useRef(new Set<string>());
  const seq = useRef(0);
  const [walkIn, setWalkIn] = useState<WalkIn | null>(null);
  const judge = useEffectEvent(() => {
    judged.current.add(tabId);
    if (walking) return;
    const entrance = walkEntrance(elements, layers);
    if (!entrance) return;
    if (entrance.kind === 'button') {
      seq.current += 1;
      setWalkIn({ feet: entrance.feet, seq: seq.current });
    }
    openWalking();
  });
  // Runs as the tab's elements change, but past the first judgement it is one set lookup: an edit never re-checks.
  useEffect(() => {
    if (!enabled || !loaded || judged.current.has(tabId)) return;
    judge();
  }, [enabled, loaded, tabId, elements, layers]);
  // A template this person landed on an empty tab (the start screen) is the tab's first content, so it is judged
  // afresh: a Spaces template opens walking as it lands.
  const rejudge = useCallback((id: string) => {
    judged.current.delete(id);
  }, []);
  return { walkIn, rejudge };
}
