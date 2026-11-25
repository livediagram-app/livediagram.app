'use client';

// View As Diagram's dialog (docs/specs/026-plan/view-as-diagram.md "The dialog"): the board, the whole of it or the
// cards its filter shows, a preview counted from the cards the editor already holds (cards, lanes, arrows and the
// critical path in order), the diagram's name, and Make Diagram. An Editor of the whole plan gets the diagram as a
// connected tab; anyone else, in a new browser tab. Centred, a bottom sheet on a phone.
import { useEffect, useId, useMemo, useState } from 'react';
import {
  criticalPathLabels,
  finishedStatuses,
  planDiagramGraph,
  resolveBoardFilter,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import {
  IndexError,
  PLAN_VIEW_CARDS_MAX,
  type ConnectionMade,
  type PlanViewAnswer,
} from '@liveworkspace/index-client';
import { Button, DialogFooter, SegmentedToggle, Select, TextInput } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { viewAsDiagramHeroArt } from '@liveworkspace/ui/dialog-hero-art/view-as-diagram';
import { connectFile } from '@liveworkspace/workbench/components/connect/connect-file';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { useToast } from '@liveworkspace/workbench/hooks/ui/useToast';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { LinkTabsOption } from '@liveworkspace/workbench/components/link-tabs/LinkTabsOption';
import { useLinkTabs } from '@liveworkspace/workbench/components/link-tabs/useLinkTabs';
import { track } from '@/lib/telemetry';

const DAY_MS = 86_400_000;
// "Soon" in a board's due filter, as the plan's own redraw reads it (plan-diagram-door.ts).
const SOON_DAYS = 7;
const NAME_MAX = 120;
const LABEL = 'text-[13px] font-medium text-slate-700 dark:text-slate-200';

type Client = Pick<
  typeof indexClient,
  'viewPlanAsDiagram' | 'makeConnection' | 'takeBackConnection' | 'linkedTabs' | 'linkTabs'
>;

export type ViewAsDiagramConnect = {
  // The plan's grant at `edit` for the connection, null when refused.
  grant: () => Promise<string | null>;
  add: (made: ConnectionMade, tabId: string) => Promise<void>;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function ViewAsDiagramDialog({
  planId,
  planTitle,
  boards,
  items,
  types,
  me,
  connect,
  onClose,
  client = indexClient,
  now: nowProp,
}: {
  planId: string;
  planTitle: string;
  boards: readonly { elementId: string; setup: PlanBoardSetup }[];
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  // The person, for a filter's "Mine".
  me: string;
  // An Editor of the whole plan: the connected tab's grant and add. Null opens the diagram in a new browser tab.
  connect: ViewAsDiagramConnect | null;
  onClose: () => void;
  client?: Client;
  // The clock, for a filter's due words; read once when the dialog opens.
  now?: number;
}) {
  const [now] = useState(() => nowProp ?? Date.now());
  const toast = useToast();
  const titleId = useId();
  const ids = { board: useId(), name: useId() };
  const [boardId, setBoardId] = useState(boards[0]!.elementId);
  const setup = (boards.find((b) => b.elementId === boardId) ?? boards[0]!).setup;
  const hasFilter = !!setup.filter;
  const [filtered, setFiltered] = useState(false);
  const [name, setName] = useState(() => `${setup.title || 'Board'} diagram`.slice(0, NAME_MAX));
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Connect as tabs (connected-tabs.md "Linked from a Send to"): the diagram gets a tab back to this plan, paired with
  // the plan's own connected tab to it, so either side's Remove takes both.
  const linkTabs = useLinkTabs({ sourceId: planId, targetId: null, client });

  useEffect(() => {
    track('UI', 'Opened', 'ViewAsDiagram');
  }, []);

  // The preview, drawn as the plan will draw it: the same graph, from the cards held here.
  const graphs = useMemo(() => {
    const quick = setup.filter
      ? resolveBoardFilter(setup.filter, {
          mine: me,
          today: Math.floor(now / DAY_MS),
          soonDays: SOON_DAYS,
          finished: finishedStatuses(setup),
        })
      : undefined;
    const draw = (q: typeof quick) =>
      planDiagramGraph({
        setup,
        items,
        types,
        ...(q ? { quick: q } : {}),
        link: () => '',
      });
    const whole = draw(undefined);
    return { whole, shown: quick ? draw(quick) : whole };
  }, [setup, items, types, me, now]);
  const graph = filtered && hasFilter ? graphs.shown : graphs.whole;
  const critical = useMemo(() => criticalPathLabels(graph), [graph]);
  const empty = graph.nodes.length === 0;
  const ready = !empty && name.trim() !== '' && !drawing;

  const make = async () => {
    if (!ready) return;
    setDrawing(true);
    setError(null);
    let answer: PlanViewAnswer;
    try {
      answer = await client.viewPlanAsDiagram(planId, {
        board: boardId,
        name: name.trim(),
        ...(filtered && hasFilter ? { filtered: true } : {}),
      });
    } catch (err) {
      track('UI', 'Refused', 'ViewAsDiagram');
      setDrawing(false);
      setError(refusal(err));
      return;
    }
    track('UI', 'Created', 'ViewAsDiagram');
    const open = () => window.open(answer.diagram.link, '_blank', 'noopener,noreferrer');
    // An Editor's diagram goes in as a connected tab; a tab that cannot go in still leaves the diagram to open.
    let connected = false;
    if (connect) {
      try {
        const grant = await connect.grant();
        if (!grant) throw new Error('no grant');
        const tabId = crypto.randomUUID();
        await connectFile({
          client,
          hostId: planId,
          grant,
          tabId,
          targetId: answer.diagram.id,
          level: 'edit',
          both: false,
          addTab: (made) => connect.add(made, tabId),
        });
        connected = true;
      } catch {
        connected = false;
      }
    }
    // After the plan's tab, so the diagram's pairs with it rather than adding a second one.
    void linkTabs.finish(answer.diagram.id, {
      source: planTitle,
      target: answer.diagram.title || name.trim(),
    });
    if (!connected) open();
    toast.success('Diagram made', { action: { label: 'Open Diagram', onSelect: open } });
    onClose();
  };

  const lanes = graph.lanes.length;
  const cut = graph.total > graph.nodes.length;
  return (
    <Dialog open onClose={onClose} titleId={titleId} size="xl" phoneSheet className="max-h-[92vh]">
      <HeroDialogHeader
        art={viewAsDiagramHeroArt}
        titleId={titleId}
        title="View As Diagram"
        subtitle="Draw this board as a live diagram in livediagram."
        onClose={onClose}
      />
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void make();
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
          {boards.length > 1 ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.board} className={LABEL}>
                Board
              </label>
              <Select
                id={ids.board}
                value={boardId}
                onChange={(e) => {
                  const next = boards.find((b) => b.elementId === e.target.value);
                  setBoardId(e.target.value);
                  setFiltered(false);
                  setName(`${next?.setup.title || 'Board'} diagram`.slice(0, NAME_MAX));
                }}
                className="w-full"
                selectClassName="w-full"
              >
                {boards.map((b) => (
                  <option key={b.elementId} value={b.elementId}>
                    {b.setup.title || 'Untitled board'}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {hasFilter ? (
            <SegmentedToggle
              label="Cards"
              value={filtered ? 'filtered' : 'whole'}
              onChange={(v) => setFiltered(v === 'filtered')}
              options={[
                {
                  value: 'whole',
                  label: 'Whole Board',
                  description: `Every card on the board, ${graphs.whole.total}.`,
                },
                {
                  value: 'filtered',
                  label: 'Cards the Filter Shows',
                  description: `${graphs.shown.total} of ${graphs.whole.total}, as the board's filter shows them.`,
                },
              ]}
            />
          ) : null}
          <section
            aria-label="Preview"
            aria-live="polite"
            data-view-as-diagram-preview=""
            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40"
          >
            {empty ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {filtered ? 'The filter shows no cards.' : 'This board has no cards to draw yet.'}
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-800 dark:text-slate-100">
                  {plural(graph.nodes.length, 'card')} in {plural(lanes, 'lane')},{' '}
                  {plural(graph.edges.length, 'Blocked By arrow')}
                  {critical.length > 1
                    ? `, a critical path of ${plural(critical.length, 'card')}`
                    : ''}
                  .
                </p>
                {cut ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    The first {PLAN_VIEW_CARDS_MAX} of {graph.total} cards will be drawn.
                  </p>
                ) : null}
                {critical.length > 1 ? (
                  <ol
                    aria-label="Critical path"
                    className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-600 dark:text-slate-300"
                  >
                    {critical.map((label, i) => (
                      <li key={`${i}-${label}`} className="flex min-w-0 items-center gap-1.5">
                        {i > 0 ? (
                          <span aria-hidden className="text-slate-400">
                            →
                          </span>
                        ) : null}
                        <span className="max-w-[14rem] truncate rounded-md bg-white px-1.5 py-0.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                          {label}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </>
            )}
          </section>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.name} className={LABEL}>
              Name
            </label>
            <TextInput
              id={ids.name}
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <LinkTabsOption
            link={linkTabs}
            sourceApp="liveplanner"
            targetApp="livediagram"
            names={{ source: planTitle, target: name.trim() || 'the new diagram' }}
          />
          {error ? (
            <Callout tone="error" size="md" role="alert">
              {error}
            </Callout>
          ) : null}
        </div>
        <DialogFooter>
          <p className="mr-auto hidden min-w-0 truncate text-xs text-slate-500 sm:block dark:text-slate-400">
            {connect
              ? 'Made as you, beside this plan as a connected tab.'
              : `Made as you, drawn live from ${planTitle}.`}
          </p>
          <Button type="button" variant="secondary" onClick={onClose} className="shrink-0">
            Cancel
          </Button>
          <Button type="submit" disabled={!ready} className="shrink-0 whitespace-nowrap">
            {drawing ? 'Drawing…' : 'Make Diagram'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function refusal(err: unknown): string {
  if (err instanceof IndexError) {
    if (err.code === 'rate_limited')
      return 'That is a lot of diagrams at once. Try again in a minute.';
    if (err.status === 403 || err.status === 404) return "You can't read this board any more.";
  }
  return "livediagram couldn't be reached just now. Try again.";
}
