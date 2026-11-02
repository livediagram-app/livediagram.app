'use client';

// The Flows dialog (docs/specs/009-elements/sankey.md "The Flows dialog"): a Sankey's flows as a table or as
// text, a node strip to rename a node everywhere at once, a live preview, and notes on any middle node that
// does not balance. Opened by double-clicking the diagram or the menu's Edit Flows.
//
// The dialog owns a draft while open (seeded once; re-seeding on every store echo would fight the typing).
// The preview redraws from the draft as you type; the diagram behind redraws when a change is stored, on a
// cell's blur or at once for a structural change, one undo step each. A store that would change nothing is
// skipped, so tabbing through cells leaves no empty undo steps.

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { registerSankeyFlowsDialog } from '@liveworkspace/workbench/lib/sankey-flows-dialog-handle';
import { useActiveTour } from '@/lib/tour-active';
import { Button, DialogCloseButton, DialogHeader } from '@livehuddle/ui';
import {
  parseSankeyText,
  renameSankeyNode,
  SANKEY_LEFTOVER_NAME,
  withSankeyNodeLeftover,
  sankeyFlowsToText,
  type SankeyFlow,
  type SankeyNodeStyle,
  type ShapeElement,
} from '@livehuddle/document';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { SankeyView } from '@/components/canvas/SankeyView';
import { SankeyFlowsTable } from '@/components/dialogs/SankeyFlowsTable';
import { SankeyNodeStrip } from '@/components/dialogs/SankeyNodeStrip';
import { DialogTabs } from '@liveworkspace/workbench/components/dialogs/DialogTabs';
import {
  SankeyFlowsShowMeButton,
  SankeyFlowsTourStage,
  useSankeyFlowsTour,
} from '@/components/tour/SankeyFlowsTour';
import {
  balanceNotes,
  draftFlows,
  flowsToStore,
  rowsFromFlows,
  withTrailingBlank,
  type SankeyDraftRow,
} from '@/lib/sankey-flow-rows';

type Tab = 'table' | 'text';
const TABS: readonly Tab[] = ['table', 'text'];
const TAB_LABEL: Record<Tab, string> = { table: 'Table', text: 'Text' };

// The preview's width; its height follows the diagram's own proportions, within reason.
const PREVIEW_W = 300;
const PREVIEW_INK = '#334155'; // slate-700 on the preview's white

export function SankeyFlowsDialog({
  element,
  palette,
  onCommit,
  onClose,
}: {
  element: ShapeElement;
  palette?: readonly string[];
  onCommit: (flows: SankeyFlow[], nodes: SankeyNodeStyle[] | undefined) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('table');
  const [rows, setRowsState] = useState<SankeyDraftRow[]>(() =>
    withTrailingBlank(rowsFromFlows(element.sankeyFlows ?? [])),
  );
  // The draft always ends in one blank row, the table's Add a Flow line; it is never stored.
  const setRows = (next: SankeyDraftRow[]) => setRowsState(withTrailingBlank(next));
  const [nodes, setNodes] = useState<SankeyNodeStyle[] | undefined>(element.sankeyNodes);
  const [text, setText] = useState('');
  const [unread, setUnread] = useState<number[]>([]);
  const [importNote, setImportNote] = useState<string | null>(null);
  // What was last stored (the flows and node colours), so a store that would change nothing is skipped.
  const lastStored = useRef(JSON.stringify([flowsToStore(rows), element.sankeyNodes ?? null]));

  // Stores the rows with these node settings. Not a default parameter: switching the last leftover back on leaves
  // the nodes undefined, which a default would quietly swap for the old settings, and the store would be skipped.
  const storeWith = (next: SankeyDraftRow[], nextNodes: SankeyNodeStyle[] | undefined) => {
    setRows(next);
    const flows = flowsToStore(next);
    const key = JSON.stringify([flows, nextNodes ?? null]);
    if (key === lastStored.current) return;
    lastStored.current = key;
    onCommit(flows, nextNodes);
  };
  const store = (next: SankeyDraftRow[]) => storeWith(next, nodes);
  // Closing stores what is being typed: Escape unmounts the dialog without blurring the focused cell or
  // the text box, so their own store-on-blur never runs. A close after a blur stores nothing twice.
  const close = () => {
    store(rows);
    onClose();
  };

  const switchTab = (next: Tab) => {
    if (next === tab) return;
    if (next === 'text') {
      setText(sankeyFlowsToText(flowsToStore(rows)));
      setUnread([]);
    }
    setTab(next);
  };

  // Text as it is typed: parsed into the draft (the preview follows), stored when the box loses focus.
  const onText = (value: string) => {
    setText(value);
    const parsed = parseSankeyText(value);
    setUnread(parsed.unread);
    setRows(rowsFromFlows(parsed.flows));
  };

  const importFile = (file: File) => {
    void file.text().then((content) => {
      const parsed = parseSankeyText(content);
      if (parsed.flows.length === 0) {
        setImportNote(`No flows found in ${file.name}. Each row needs a From, a To and an amount.`);
        return;
      }
      const next = rowsFromFlows(parsed.flows);
      store(next);
      if (tab === 'text') setText(sankeyFlowsToText(parsed.flows));
      setImportNote(
        `Imported ${parsed.flows.length} ${parsed.flows.length === 1 ? 'flow' : 'flows'} from ${file.name}` +
          (parsed.unread.length > 0
            ? `; ${parsed.unread.length} ${parsed.unread.length === 1 ? 'line was' : 'lines were'} not read.`
            : '.'),
      );
    });
  };

  const rename = (from: string, to: string) => {
    const renamed = renameSankeyNode(flowsToStore(rows), nodes, from, to);
    const next = rowsFromFlows(renamed.flows);
    setNodes(renamed.nodes);
    storeWith(next, renamed.nodes);
    if (tab === 'text') setText(sankeyFlowsToText(renamed.flows));
  };

  const preview = useMemo(() => {
    const ratio = element.height / Math.max(1, element.width);
    const h = Math.round(Math.min(260, Math.max(150, PREVIEW_W * ratio)));
    return {
      ...element,
      width: PREVIEW_W,
      height: h,
      sankeyFlows: draftFlows(rows),
      sankeyNodes: nodes,
      sankeyAnim: undefined,
    };
  }, [element, rows, nodes]);
  const leftovers = element.sankeyLeftover !== 'hide';
  const notes = useMemo(
    () => balanceNotes(rows, element.sankeyUnit, leftovers),
    [rows, element.sankeyUnit, leftovers],
  );

  // Show Me: the tour of writing flows, run on this dialog (docs/specs/009-elements/sankey.md "Show Me").
  const { tour, freeze: freezeTour } = useSankeyFlowsTour(
    { hasNodes: flowsToStore(rows).length > 0, hasBalanceNotes: notes.length > 0 },
    { showTable: () => switchTab('table'), showText: () => switchTab('text') },
  );

  // The Sankey element tour runs these same steps from outside (docs/specs/007-editor/element-tours.md): it switches
  // the tabs and closes it at its end through this handle, and while it runs Escape is its own, as Show Me's is.
  const switchTabRef = useLatest(switchTab);
  const closeRef = useLatest(close);
  useLayoutEffect(
    () =>
      registerSankeyFlowsDialog({
        showTable: () => switchTabRef.current('table'),
        showText: () => switchTabRef.current('text'),
        close: () => closeRef.current(),
      }),
    [switchTabRef, closeRef],
  );
  const elementTourRunning = useActiveTour() === 'element';

  return (
    <Dialog
      open
      onClose={close}
      // While Show Me (or the element tour) runs, Escape is the tour's, never the dialog's.
      closeOnEscape={!tour.active && !elementTourRunning}
      ariaLabel="Edit Sankey flows"
      size="3xl"
      className="max-h-[90vh]"
    >
      <DialogHeader
        title="Flows"
        subtitle="Each flow moves an amount from one node to another; its band is drawn as wide as the amount."
      >
        <SankeyFlowsShowMeButton tour={tour} onStart={freezeTour} />
        <HelpArticleLink article="sankeyDiagram" variant="labelled" />
        <DialogCloseButton onClick={close} />
      </DialogHeader>

      <DialogTabs
        tabs={TABS}
        labels={TAB_LABEL}
        value={tab}
        onChange={switchTab}
        idPrefix="sankey"
        ariaLabel="Edit flows as"
      >
        <label
          data-tour-id="sankey-import"
          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 focus-within:ring-2 focus-within:ring-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
        >
          Import CSV
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = '';
            }}
          />
        </label>
      </DialogTabs>

      {/* The preview above the rows on a phone, beside them on a wide screen. By `order`, not a reversed column: a
          reversed column starts its scroll at the bottom, so the dialog would open on its last row. */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden px-6 py-4 md:flex-row">
        <div className="order-2 min-w-0 flex-1 md:order-1">
          {importNote ? (
            <p
              role="status"
              className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
            >
              {importNote}
            </p>
          ) : null}
          <SankeyNodeStrip
            flows={draftFlows(rows)}
            nodes={nodes}
            palette={palette}
            chartPalette={element.chartPalette}
            onRename={rename}
          />
          {tab === 'table' ? (
            <div id="sankey-panel-table" role="tabpanel" aria-labelledby="sankey-tab-table">
              <SankeyFlowsTable
                rows={rows}
                unit={element.sankeyUnit}
                nodes={nodes}
                leftoverName={
                  leftovers ? element.sankeyLeftoverName || SANKEY_LEFTOVER_NAME : undefined
                }
                palette={palette}
                chartPalette={element.chartPalette}
                onSetLeftover={(name, on) => {
                  const next = withSankeyNodeLeftover(nodes, name, on);
                  setNodes(next);
                  storeWith(rows, next);
                }}
                onRows={setRows}
                onCommit={(next) => store(next)}
              />
            </div>
          ) : (
            <div
              id="sankey-panel-text"
              role="tabpanel"
              aria-labelledby="sankey-tab-text"
              data-tour-id="sankey-text"
            >
              <textarea
                className="h-64 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-[13px] leading-relaxed text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-brand-500/30"
                value={text}
                spellCheck={false}
                aria-label="Flows, one per line"
                aria-describedby="sankey-text-help"
                placeholder={'Salary [3200] Budget\nBudget [1400] Rent'}
                onChange={(e) => onText(e.target.value)}
                onBlur={() => store(rows)}
              />
              <p
                id="sankey-text-help"
                className="mt-1.5 text-xs text-slate-500 dark:text-slate-400"
              >
                One flow per line: <code className="font-mono">From [amount] To</code>. Also reads{' '}
                <code className="font-mono">From -&gt; To: amount</code> and spreadsheet rows (From,
                To, Amount). Lines starting with <code className="font-mono">//</code> are notes.
              </p>
              {unread.length > 0 ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400" role="status">
                  {unread.length === 1
                    ? `Line ${unread[0]} was not read.`
                    : `Lines ${unread.slice(0, 6).join(', ')}${unread.length > 6 ? '…' : ''} were not read.`}{' '}
                  Each needs a From, a To and an amount.
                </p>
              ) : null}
            </div>
          )}
          {notes.length > 0 ? (
            <div
              data-tour-id="sankey-balance"
              className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10"
            >
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                In and out differ
              </p>
              <ul className="mt-1 list-disc pl-4 text-xs text-amber-800 dark:text-amber-300">
                {notes.slice(0, 6).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <figure
          data-tour-id="sankey-preview"
          className="order-1 shrink-0 md:sticky md:top-0 md:order-2 md:w-[300px] md:self-start"
        >
          <div
            // Paper in both appearances: the labels are drawn in one ink, so the preview keeps one ground.
            className="relative mx-auto w-full max-w-[300px] rounded-lg border border-slate-200 bg-white dark:border-slate-700"
            style={{ aspectRatio: `${preview.width} / ${preview.height}` }}
          >
            <SankeyView
              element={preview}
              textColor={PREVIEW_INK}
              palette={palette}
              editable={false}
            />
          </div>
          <figcaption className="mt-1.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
            Preview. Hover a band or a node to read it.
          </figcaption>
        </figure>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
        <Button variant="primary" size="md" onClick={close}>
          Done
        </Button>
      </div>
      <SankeyFlowsTourStage tour={tour} />
    </Dialog>
  );
}
