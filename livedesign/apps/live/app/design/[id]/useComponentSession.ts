// The edit session's live half (docs/specs/009-elements/components.md "Editing the main: the edit session"): while
// this person has a session open on the tab, each change to its members is derived back into the main, which the
// library saves after a pause and the worker sends to every instance's viewers. Only the session's own person derives,
// so two editors never write one main from one session.
import { useEffect, useMemo } from 'react';
import {
  activeComponentSessions,
  deriveComponentFromSession,
  diffComponent,
  type Element,
} from '@livedesign/design';
import type { ComponentLibraryState } from './useComponentLibrary';

export function useComponentSession(opts: {
  canEdit: boolean;
  selfId: string;
  elements: readonly Element[];
  library: Pick<ComponentLibraryState, 'lookup' | 'changeComponent'>;
}): { sessionInstanceId: string | null } {
  const { canEdit, selfId, elements, library } = opts;
  const mine = useMemo(
    () => activeComponentSessions(elements).find((s) => s.componentEditBy === selfId) ?? null,
    [elements, selfId],
  );
  const { lookup, changeComponent } = library;
  useEffect(() => {
    if (!canEdit || !mine) return;
    const main = lookup(mine.componentId);
    if (!main) return;
    const derived = deriveComponentFromSession(elements, mine.id, main, Date.now());
    if (derived && diffComponent(main, derived)) changeComponent(derived);
  }, [canEdit, mine, elements, lookup, changeComponent]);
  return { sessionInstanceId: mine?.id ?? null };
}
