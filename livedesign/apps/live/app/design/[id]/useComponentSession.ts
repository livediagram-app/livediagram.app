// The edit session's live half (docs/specs/009-elements/components.md "Editing the main: the edit session"): while
// this person has a session open on the tab, each change to its members is derived back into the main, which the
// library saves after a pause and the worker sends to every instance's viewers. Only the session's own person derives,
// so two editors never write one main from one session, and only on the screen that opened it (`owned`): a peer's
// copy of the session, the person's other device included, takes the start and Done one element at a time and would
// derive a main from a half-arrived session. A session seen anywhere else (after a reload, say) is derived once, on
// Done (useComponentActions finishEdit).
import { useEffect, useMemo } from 'react';
import {
  activeComponentSessions,
  deriveComponentFromSession,
  diffComponent,
  type Element,
} from '@livedesign/design';
import type { ComponentLibraryState } from './useComponentLibrary';

/** The sessions this screen opened, by instance id: the only ones it derives live. */
export type OwnedComponentSessions = { readonly current: Set<string> };

export function useComponentSession(opts: {
  canEdit: boolean;
  selfId: string;
  elements: readonly Element[];
  library: Pick<ComponentLibraryState, 'lookup' | 'changeComponent'>;
  owned: OwnedComponentSessions;
}): { sessionInstanceId: string | null } {
  const { canEdit, selfId, elements, library, owned } = opts;
  const mine = useMemo(
    () => activeComponentSessions(elements).find((s) => s.componentEditBy === selfId) ?? null,
    [elements, selfId],
  );
  const { lookup, changeComponent } = library;
  useEffect(() => {
    if (!canEdit || !mine || !owned.current.has(mine.id)) return;
    const main = lookup(mine.componentId);
    if (!main) return;
    const derived = deriveComponentFromSession(elements, mine.id, main, Date.now());
    if (derived && diffComponent(main, derived)) changeComponent(derived);
  }, [canEdit, mine, elements, lookup, changeComponent, owned]);
  return { sessionInstanceId: mine?.id ?? null };
}
