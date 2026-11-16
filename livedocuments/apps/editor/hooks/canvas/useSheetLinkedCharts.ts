'use client';

// Charts linked to a liveplanner sheet (docs/specs/009-elements/pie-chart.md "Charts linked to a liveplanner sheet";
// blueprints/data-charts.md "Linked to a sheet"): the open tab's linked charts read, each distinct range once, when the
// tab opens and when the room says one of their Sheets changed. Never polled. Each read is this person's own: one who
// can open the plan sees its values live, one who cannot sees the saved values. An Editor's live values are saved
// quietly (no undo step), so a reader without access and an export see them too.
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ChartSheetSource, Element } from '@livedocuments/document';
import { IndexError, type SheetRangeRead } from '@liveworkspace/index-client';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { documentGrant } from '@/lib/api/document-grants';
import { onSourceChanged } from '@/lib/sheet-link-signal';
import {
  liveChartFields,
  linkedChartsOn,
  sameChartData,
  sameSource,
  sheetLinkKey,
  sourceAfterRead,
  type SheetLinkStatus,
} from '@/lib/sheet-links';

type Read = (source: ChartSheetSource) => Promise<SheetLinkStatus>;

// One read, as the index answers it: live, or why not.
export async function readSheetLink(
  source: ChartSheetSource,
  documentId: string | null,
): Promise<SheetLinkStatus> {
  // The document's grant asks the plan to say when the Sheet changes; without one the read still answers.
  const grant = documentId ? await documentGrant(documentId).catch(() => null) : null;
  try {
    const read: SheetRangeRead = await indexClient.readSheetRange(
      source.itemId,
      {
        sheetId: source.sheetId,
        range: source.range,
        ...(source.cols ? { cols: source.cols } : {}),
      },
      { grant: grant?.grant ?? null, watch: grant ? documentId : null },
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

export function useSheetLinkedCharts({
  elements,
  documentId,
  canSave,
  tick,
  read = (s) => readSheetLink(s, documentId),
}: {
  elements: readonly Element[];
  documentId: string | null;
  // An Editor on an unlocked document: live values are saved quietly.
  canSave: boolean;
  tick: (map: (els: Element[]) => Element[]) => void;
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

  // On open and on a tab change: every range not yet read this session. A range already known is skipped, so a
  // status landing starts nothing.
  useEffect(() => {
    for (const [key, source] of sources) if (!statuses.has(key)) readKey(key, source);
  }, [sources, statuses, readKey]);

  // The room's frame: the ranges of the Sheets it names, read again.
  const sourcesRef = useRef(sources);
  useLayoutEffect(() => {
    sourcesRef.current = sources;
  });
  useEffect(
    () =>
      onSourceChanged(({ itemId, sheetIds }) => {
        for (const [key, source] of sourcesRef.current) {
          if (source.itemId === itemId && sheetIds.includes(source.sheetId)) readKey(key, source);
        }
      }),
    [readKey],
  );

  // An Editor's live values saved quietly: one tick for every chart a read changed, and none when nothing did.
  const save = useEffectEvent(() => {
    if (!canSave) return;
    const patches = new Map<string, Partial<Element>>();
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
        return patch && e.type === 'shape' && e.chartSheetSource
          ? ({ ...e, ...patch } as Element)
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
      statuses.get(sheetLinkKey(source)) ?? { kind: 'reading' },
    [statuses],
  );
  // A link just made carries its own first read: no second read for it.
  const seed = useCallback((source: ChartSheetSource, read: SheetRangeRead) => {
    setStatuses((prev) => new Map(prev).set(sheetLinkKey(source), { kind: 'live', read }));
  }, []);
  return { statusOf, update, seed };
}
