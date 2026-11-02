'use client';

// A sheet form's columns kept while an Editor has its Form tab open (docs/specs/030-forms/forms.md "Columns before any
// response", "Linked by column, not by heading"): FORM_COLUMNS_SYNC_MS after the form last changed, its sheet is given
// the headers it lacks (no undo step) and the form remembers each header's column (changeFormQuietly). The sheet store
// is the lazily loaded sheet chunk's, fetched only for a Form tab that sends its responses to a sheet.
import { useEffect, useMemo, useRef } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { readForm, sameSheetColumns, type FormDefinition } from '@liveplanner/forms';
import type { Tab } from '@liveplanner/project';
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import {
  FORM_COLUMNS_SYNC_MS,
  formColumnsKey,
  formColumnsSync,
  headersByKey,
} from './form-sheet-columns';

// A sheet not made yet (a New Sheet still waiting for its tab's save) is looked for again this often, this many times.
// Safe ranges 500..3000 ms and 2..10.
export const FORM_COLUMNS_RETRY_MS = 1000;
export const FORM_COLUMNS_RETRIES = 5;

export function useFormSheetColumns({
  tab,
  canEdit,
  bridge,
  changeFormQuietly,
}: {
  tab: Tab | undefined;
  // The session may change the plan's structure (an Editor, not through a link to one tab), and the tab is unlocked.
  canEdit: boolean;
  bridge: SheetsBridge;
  changeFormQuietly: (change: (form: FormDefinition) => FormDefinition) => void;
}): void {
  const kind = tab?.kind;
  const stored = tab?.form;
  const locked = tab?.locked;
  const form = useMemo(
    () => (kind === 'form' && canEdit && !locked ? readForm(stored) : null),
    [kind, stored, locked, canEdit],
  );
  const key = useMemo(() => formColumnsKey(form), [form]);
  // Each form's headers as last synced, by Form tab: a remembered column still reading one follows a new wording.
  const seen = useRef(new Map<string, Map<string, string>>());
  const live = useLatest({ form, bridge, changeFormQuietly, tabId: tab?.id });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const sync = async (tries: number): Promise<void> => {
      const { form: now, bridge: b, changeFormQuietly: save, tabId } = live.current;
      const at = now?.sheet;
      if (!now || !at || !tabId) return;
      const { sheetStoreOf } = await import('@/components/sheets/sheet-store-client');
      const store = sheetStoreOf(b);
      await store.loadTab(at.tabId);
      if (cancelled) return;
      if (!store.sheet(at.sheetId)) {
        // Made a moment from now (its tab's save first): looked for again, a fresh read each time.
        if (tries > 0)
          timer = setTimeout(() => {
            void store.loadTab(at.tabId, true).then(() => sync(tries - 1));
          }, FORM_COLUMNS_RETRY_MS);
        return;
      }
      const renamed = seen.current.get(tabId);
      let plan = formColumnsSync({ ...now, sheet: at }, store.sheet(at.sheetId)!, renamed);
      if (plan.write) {
        // Something to write: planned again on the sheet as stored now, so a response's headers are found, not doubled.
        await store.loadTab(at.tabId, true);
        const fresh = store.sheet(at.sheetId);
        if (cancelled || !fresh) return;
        plan = formColumnsSync({ ...now, sheet: at }, fresh, renamed);
        if (
          plan.write &&
          store.write(at.sheetId, plan.write, { undoable: false, unchecked: true })
        ) {
          console.warn('[forms] form.columns.refused');
          return;
        }
      }
      seen.current.set(tabId, headersByKey(now));
      if (sameSheetColumns(at.columns, plan.columns)) return;
      save((f) =>
        f.sheet && f.sheet.sheetId === at.sheetId && f.sheet.tabId === at.tabId
          ? { ...f, sheet: { ...f.sheet, columns: plan.columns } }
          : f,
      );
    };
    timer = setTimeout(() => void sync(FORM_COLUMNS_RETRIES), FORM_COLUMNS_SYNC_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, live]);
}
