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
  // The range is read only when it can have changed: the store moving on (`version`), the source or the locale. A
  // re-render for anything else (a scroll frame, a canvas drag, a resize of the chart) reads nothing again.
  const locale = bridge.locale;
  const tables = useMemo(() => {
    const wb = store.workbook(tabId);
    const kept = sheetChartTable(wb, source, AGENT_LOCALE);
    return { kept, shown: locale === AGENT_LOCALE ? kept : sheetChartTable(wb, source, locale) };
  }, [store, tabId, source, locale, version]); // oxlint-disable-line react/exhaustive-deps
  // The fields those tables give this chart: its type (a Scatter takes a numbered read's first column as its x) and
  // its slices' or series' colours (by position) decide them.
  const { shape, chartVariant, pieSlices, lineSeries, lineCategories } = element;
  const { shown, kept } = useMemo(() => {
    const fields = (t: typeof tables.kept) =>
      t ? chartFieldsFromTable({ shape, chartVariant, pieSlices, lineSeries }, t) : null;
    const kept = fields(tables.kept);
    return { kept, shown: tables.shown === tables.kept ? kept : fields(tables.shown) };
  }, [tables, shape, chartVariant, pieSlices, lineSeries]);
  // The element keeps the last read (quietly, no undo step), so an export, a thumbnail or an agent sees it too.
  const stale = useMemo(
    () => kept !== null && !sameData({ pieSlices, lineSeries, lineCategories }, kept),
    [kept, pieSlices, lineSeries, lineCategories],
  );
  const id = element.id;
  useEffect(() => {
    if (!stale || !bridge.canEdit || !kept) return;
    bridge.tickElements((els) => els.map((el) => (el.id === id ? { ...el, ...kept } : el)));
  }, [stale, kept, id, bridge]);
  return <>{children(shown ? { ...element, ...shown } : element)}</>;
}

type DataFields = Pick<ShapeElement, 'pieSlices' | 'lineSeries' | 'lineCategories'>;

function sameData(el: DataFields, fields: ReturnType<typeof chartFieldsFromTable>): boolean {
  return Object.entries(fields).every(
    ([k, v]) => JSON.stringify(el[k as keyof DataFields]) === JSON.stringify(v),
  );
}
