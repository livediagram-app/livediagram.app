'use client';

// Charts linked to a liveplanner sheet (each reader app's docs/specs/009-elements/pie-chart.md "Charts linked to a
// liveplanner sheet"): the open tab's linked charts read, each distinct range once, when the tab opens and when the
// room says one of their Sheets changed. Never polled. Each read is this person's own: one who can open the plan sees
// its values live, one who cannot sees the saved values. An Editor's live values are saved quietly (no undo step), so
// a reader without access and an export see them too.
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ChartSheetSource } from '@liveworkspace/element-model/chart-sheet-source';
import { IndexError, type SheetRangeRead } from '@liveworkspace/index-client';
import { indexClient } from '../../lib/index-client';
import { onSourceChanged } from './sheet-link-signal';
import {
  liveChartFields,
  linkedChartsOn,
  sameChartData,
  sameSource,
  sheetLinkKey,
  sourceAfterRead,
  type SheetLinkElement,
  type SheetLinkStatus,
} from './sheet-links';

type Read = (source: ChartSheetSource) => Promise<SheetLinkStatus>;

// How long the first read waits for `ready` before an unread range shows the saved values ("saved"), as a reader
// without access sees them. The read still goes once `ready` turns true.
export const SHEET_LINK_READY_TIMEOUT_MS = 10_000;

// The reader item's own grant (the product's item grants), or null: a This Browser item, a refusal, offline.
export type SheetLinkGrantOf = (itemId: string) => Promise<string | null>;

// One read, as the index answers it: live, or why not.
export async function readSheetLink(
  source: ChartSheetSource,
  itemId: string | null,
  grantOf: SheetLinkGrantOf,
): Promise<SheetLinkStatus> {
  // The item's grant asks the plan to say when the Sheet changes; without one the read still answers.
  const grant = itemId ? await grantOf(itemId).catch(() => null) : null;
  try {
    const read: SheetRangeRead = await indexClient.readSheetRange(
      source.itemId,
      {
        sheetId: source.sheetId,
        range: source.range,
        ...(source.cols ? { cols: source.cols } : {}),
      },
      { grant, watch: grant ? itemId : null },
    );
    return { kind: 'live', read };
  } catch (err) {
    if (err instanceof IndexError) {
      if (err.status === 404 || err.status === 403 || err.status === 401) return { kind: 'saved' };
      if (err.status === 409) return { kind: 'gone' };
    }
    return { kind: 'failed' };
  }
}

export function useSheetLinkedCharts<E extends SheetLinkElement>({
  elements,
  itemId,
  canSave,
  tick,
  grantOf,
  ready,
  read = (s) => readSheetLink(s, itemId, grantOf),
}: {
  elements: readonly E[];
  itemId: string | null;
  // Sign-in has answered (so the account's token is in place) and the item has loaded: no range is read before it,
  // so the first read is never anonymous, its grant is the person's own, and its watch registers the item at once
  // (Work Tracker 1215).
  ready: boolean;
  // An Editor on an unlocked item: live values are saved quietly.
  canSave: boolean;
  tick: (map: (els: E[]) => E[]) => void;
  grantOf: SheetLinkGrantOf;
  read?: Read;
}) {
  const linked = useMemo(() => linkedChartsOn(elements), [elements]);
  // Each distinct range once, by its key, with the link it is read through (the first chart's).
  const sources = useMemo(() => {
    const byKey = new Map<string, ChartSheetSource>();
    for (const el of linked) {
      const key = sheetLinkKey(el.chartSheetSource);
      if (!byKey.has(key)) byKey.set(key, el.chartSheetSource);
    }
    return byKey;
  }, [linked]);
  const [statuses, setStatuses] = useState<ReadonlyMap<string, SheetLinkStatus>>(() => new Map());
  // Reads on their way, so a burst of renders starts one each. A range with no answer yet shows as reading.
  const reading = useRef(new Set<string>());
  const readRef = useRef(read);
  useLayoutEffect(() => {
    readRef.current = read;
  });

  // Asked again while a read was on its way (a second change landing mid-read): read once more after it.
  const again = useRef(new Set<string>());
  const readKey = useCallback(function readKeyNow(key: string, source: ChartSheetSource) {
    if (reading.current.has(key)) {
      again.current.add(key);
      return;
    }
    reading.current.add(key);
    void readRef.current(source).then((status) => {
      reading.current.delete(key);
      setStatuses((prev) => new Map(prev).set(key, status));
      if (again.current.delete(key)) readKeyNow(key, source);
    });
  }, []);

  // On open (once ready) and on a tab change: every range not yet read this session. A range already known is skipped,
  // so a status landing starts nothing.
  useEffect(() => {
    if (!ready) return;
    for (const [key, source] of sources) if (!statuses.has(key)) readKey(key, source);
  }, [ready, sources, statuses, readKey]);

  // Not ready for too long (sign-in not answering): unread ranges show the saved values until it does.
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setWaitedOut(true), SHEET_LINK_READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  // The room's frame: the ranges of the Sheets it names, read again.
  const sourcesRef = useRef(sources);
  const readyRef = useRef(ready);
  useLayoutEffect(() => {
    sourcesRef.current = sources;
    readyRef.current = ready;
  });
  useEffect(
    () =>
      onSourceChanged(({ itemId: planId, sheetIds }) => {
        if (!readyRef.current) return;
        for (const [key, source] of sourcesRef.current) {
          if (source.itemId === planId && sheetIds.includes(source.sheetId)) readKey(key, source);
        }
      }),
    [readKey],
  );

  // An Editor's live values saved quietly: one tick for every chart a read changed, and none when nothing did.
  const save = useEffectEvent(() => {
    if (!canSave) return;
    const patches = new Map<string, object>();
    for (const el of linked) {
      const status = statuses.get(sheetLinkKey(el.chartSheetSource));
      if (status?.kind !== 'live') continue;
      const fields = liveChartFields(el, status.read);
      const source = sourceAfterRead(el.chartSheetSource, status.read);
      if (sameChartData(el, fields) && sameSource(el.chartSheetSource, source)) continue;
      patches.set(el.id, { ...fields, chartSheetSource: source });
    }
    if (patches.size === 0) return;
    tick((els) =>
      els.map((e) => {
        const patch = patches.get(e.id);
        return patch && (e as { chartSheetSource?: unknown }).chartSheetSource
          ? { ...e, ...patch }
          : e;
      }),
    );
  });
  useEffect(() => save(), [statuses, linked, canSave]);

  // Update: the range read again now, whatever its status.
  const update = useCallback(
    (source: ChartSheetSource) => readKey(sheetLinkKey(source), source),
    [readKey],
  );
  const statusOf = useCallback(
    (source: ChartSheetSource): SheetLinkStatus =>
      statuses.get(sheetLinkKey(source)) ??
      (waitedOut && !ready ? { kind: 'saved' } : { kind: 'reading' }),
    [statuses, waitedOut, ready],
  );
  // A link just made carries its own first read: no second read for it.
  const seed = useCallback((source: ChartSheetSource, read: SheetRangeRead) => {
    setStatuses((prev) => new Map(prev).set(sheetLinkKey(source), { kind: 'live', read }));
  }, []);
  return { statusOf, update, seed };
}
