'use client';

// Send to a Plan (docs/specs/013-workspace/suggestions.md; liveworkspace/docs/specs/016-notifications/suggestions.md):
// the person leaves a call in this Space (the call-self store's live to off: leaving Avatar mode, the room or the tab)
// and the tab they met on has stickies with words, a Space's actions; Send to Plan's picker opens on all of them, one
// card each. The store's change is heard once per change, never per frame; the stickies are read from a ref when
// idle. An Editor's alone, in a session that may send.
import { useCallback, useEffect, useRef, useState } from 'react';
import { NextAppSuggestion } from '@liveworkspace/workbench/components/suggest/NextAppSuggestion';
import {
  elementWords,
  sendAllStickies,
} from '@liveworkspace/workbench/components/send-to-plan/send-menu-item';
import type { Tab } from '@livehuddle/document';
import { callSelf, onCallSelf } from '@/lib/calls/calls-store';

export function SendToPlanSuggestion({
  itemId,
  allowed,
  activeId,
  tabs,
}: {
  itemId: string | null;
  allowed: boolean;
  activeId: string;
  tabs: readonly Tab[];
}) {
  const latest = useRef({ activeId, tabs });
  useEffect(() => {
    latest.current = { activeId, tabs };
  }, [activeId, tabs]);
  // The tab on show while the call was live, and the tab the call just ended on.
  const liveTab = useRef<string | null>(null);
  const [ended, setEnded] = useState<string | null>(null);

  useEffect(() => {
    let was = callSelf().phase;
    if (was === 'live') liveTab.current = latest.current.activeId;
    return onCallSelf(() => {
      const now = callSelf().phase;
      if (now === was) return;
      if (now === 'live') liveTab.current = latest.current.activeId;
      if (was === 'live' && now !== 'live' && liveTab.current) setEnded(liveTab.current);
      was = now;
    });
  }, []);
  useEffect(() => {
    if (callSelf().phase === 'live') liveTab.current = activeId;
  }, [activeId]);

  const check = useCallback(() => {
    if (!ended) return null;
    const tab = latest.current.tabs.find((t) => t.id === ended);
    if (!tab) return null;
    const send = sendAllStickies(tab.id, tab.elements);
    if (!send) return null;
    const n = tab.elements.filter((e) => e.type === 'sticky' && elementWords(e) !== '').length;
    return {
      line: `The call ended with ${n === 1 ? 'a sticky' : `${n} stickies`} on the wall. Send ${n === 1 ? 'it' : 'them'} to a liveplanner plan, one card each.`,
      run: send,
    };
  }, [ended]);

  return (
    <NextAppSuggestion
      id="send-to-plan"
      itemId={itemId}
      allowed={allowed}
      check={check}
      wake={ended}
    />
  );
}
