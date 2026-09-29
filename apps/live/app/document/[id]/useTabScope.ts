import { useCallback, useRef, useState } from 'react';
import { isTabOutOfScope } from '@/lib/tab-scope';

// The tab this editor session is confined to when it was opened through a
// tab-scoped share link (docs/specs/013-workspace/tab-scoped-share-links.md); null for everyone else. Set
// once by the share-code bootstrap. The ref mirrors the state so the active-tab
// guard (editor-ui-state) sees the scope in the same tick it is set, before a
// re-render.
export function useTabScope() {
  const tabScopeRef = useRef<string | null>(null);
  const [sessionTabScope, setScopeState] = useState<string | null>(null);
  const setSessionTabScope = useCallback((scope: string | null) => {
    tabScopeRef.current = scope;
    setScopeState(scope);
  }, []);
  const isOutOfScope = useCallback(
    (tabId: string) => isTabOutOfScope(tabId, sessionTabScope),
    [sessionTabScope],
  );
  return { sessionTabScope, setSessionTabScope, tabScopeRef, isOutOfScope };
}
