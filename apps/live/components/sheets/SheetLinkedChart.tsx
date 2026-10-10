'use client';

// A chart drawn from a sheet range (docs/specs/029-sheets/sheet.md "Charts"): reads the range from the document's
// sheet store and hands the chart view the element with that data, again whenever the store moves on. Without the
// sheets bridge (a read-only render), or while the sheet is not there, the element's own data (the last read) draws.
import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { chartFieldsFromTable, type ShapeElement } from '@livediagram/document';
import { AGENT_LOCALE, sheetChartTable } from '@livediagram/sheets';
import { useSheetsBridgeContext, type SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import { sheetStoreOf } from './sheet-store-client';

type Props = { element: ShapeElement; children: (element: ShapeElement) => ReactNode };

export function SheetLinkedChart({ element, children }: Props) {
  const bridge = useSheetsBridgeContext();
  if (!bridge || !element.chartSource) return <>{children(element)}</>;
  return (
    <LiveChart element={element} bridge={bridge}>
      {children}
    </LiveChart>
  );
}

function LiveChart({ element, bridge, children }: Props & { bridge: SheetsBridge }) {
  const store = sheetStoreOf(bridge);
  const version = useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  const source = element.chartSource!;
  const tabId = store.sheet(source.sheetId)?.tabId ?? bridge.activeTabId;
  useEffect(() => {
    if (tabId) void store.loadTab(tabId);
  }, [store, tabId]);
  // Drawn in this person's locale; kept on the element in one fixed locale (AGENT_LOCALE), so two people in different
  // locales never rewrite each other's copy (a date label reads differently in each).
  const { shown, kept } = useMemo(() => {
    const wb = store.workbook(tabId);
    const read = (locale: string) => {
      const table = sheetChartTable(wb, source, locale);
      return table ? chartFieldsFromTable(element, table) : null;
    };
    const kept = read(AGENT_LOCALE);
    return { kept, shown: bridge.locale === AGENT_LOCALE ? kept : read(bridge.locale) };
  }, [store, tabId, source, bridge.locale, element, version]); // eslint-disable-line react-hooks/exhaustive-deps
  // The element keeps the last read (quietly, no undo step), so an export, a thumbnail or an agent sees it too.
  const stale = kept !== null && !sameData(element, kept);
  const id = element.id;
  useEffect(() => {
    if (!stale || !bridge.canEdit || !kept) return;
    bridge.tickElements((els) => els.map((el) => (el.id === id ? { ...el, ...kept } : el)));
  }, [stale, kept, id, bridge]);
  return <>{children(shown ? { ...element, ...shown } : element)}</>;
}

function sameData(el: ShapeElement, fields: ReturnType<typeof chartFieldsFromTable>): boolean {
  return Object.entries(fields).every(
    ([k, v]) => JSON.stringify(el[k as keyof ShapeElement]) === JSON.stringify(v),
  );
}
