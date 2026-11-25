'use client';

// Send to Diagram's picker (liveworkspace/docs/specs/004-index/send-to-diagram.md "The picker"): the words, where to
// draw them (a new diagram, a new tab in one the person edits, or Update for a place sent before), the kind of diagram
// and its name. Preview asks the app's api for a graph (its own AI) and shows it as a sketch; Make Diagram (Add Tab,
// Update Tab) hands that graph to the index, which has livediagram draw it, then opens it in a new browser tab.
// Centred on screen, a bottom sheet on a phone. Nothing is written until the index answers; a failure says why here.
import { useEffect, useId, useRef, useState } from 'react';
import {
  IndexError,
  type DiagramSend,
  type DiagramSendGraph,
  type DiagramSendKind,
  type DiagramSendSource,
} from '@liveworkspace/index-client';
import { Button, DialogFooter, TextInput } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { sendToDiagramHeroArt } from '@liveworkspace/ui/dialog-hero-art/send-to-diagram';
import { workbench } from '../../bindings';
import { useToast } from '../../hooks/ui/useToast';
import { indexClient } from '../../lib/index-client';
import { Dialog } from '../dialogs/Dialog';
import { DIAGRAM_KINDS } from './diagram-kinds';
import { addDiagramSend } from './diagram-send-store';
import { DiagramSketch } from './DiagramSketch';
import { DiagramWhere, type DiagramWhereChoice } from './DiagramWhere';
import type { DiagramDrafter, DiagramSendRequest } from './send-to-diagram-entry';
import { LinkTabsOption } from '../link-tabs/LinkTabsOption';
import { useLinkTabs } from '../link-tabs/useLinkTabs';

type Client = Pick<typeof indexClient, 'sendToDiagram' | 'listItems' | 'linkedTabs' | 'linkTabs'>;

type Phase = 'idle' | 'drafting' | 'drawing';

const LABEL = 'text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400';

/** The diagram's name by default: the place's, as a diagram. */
export const diagramName = (label: string, sourceTitle: string): string =>
  `${(label || sourceTitle || 'Untitled').trim()} diagram`.slice(0, 120);

function refusal(err: unknown): string {
  if (err instanceof IndexError) {
    if (err.code === 'rate_limited')
      return 'That is a lot of diagrams at once. Try again in a minute.';
    if (err.code === 'invalid_graph')
      return "livediagram couldn't draw what the AI made. Draw it again, or pick a kind.";
    if (err.code === 'diagram_gone')
      return 'That diagram is no longer there. Make a New Diagram instead.';
    if (err.status === 403) return "You can't edit that diagram. Pick another, or make a new one.";
    if (err.status === 404) return "You can't send words from here, or that diagram is put away.";
    return "livediagram couldn't be reached. Try again in a moment.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Couldn't make the diagram. Check your connection and try again.";
}

// A tab opened in the click itself, so no popup blocker stops it; pointed at the diagram once it exists. Its opener is
// cut, so the diagram's page holds no handle on this one.
function openPendingTab(): Window | null {
  try {
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    return tab;
  } catch {
    return null;
  }
}

const ACTION: Record<DiagramWhereChoice['mode'], { button: string; toast: string }> = {
  new: { button: 'Make Diagram', toast: 'Diagram made' },
  tab: { button: 'Add Tab', toast: 'Tab added' },
  update: { button: 'Update Tab', toast: 'Tab updated' },
};

export function SendToDiagramDialog({
  request,
  source,
  sourceTitle,
  drafter,
  earlier = null,
  onClose,
  client = indexClient,
}: {
  request: DiagramSendRequest;
  source: Pick<DiagramSendSource, 'app' | 'itemId'>;
  sourceTitle: string;
  drafter: DiagramDrafter;
  // The newest earlier send of this place the person can open: the picker opens on Update for it.
  earlier?: DiagramSend | null;
  onClose: () => void;
  client?: Client;
}) {
  const toast = useToast();
  const titleId = useId();
  const nameId = useId();
  const [where, setWhere] = useState<DiagramWhereChoice>(() =>
    earlier ? { mode: 'update', send: earlier } : { mode: 'new' },
  );
  const [kind, setKind] = useState<DiagramSendKind>('auto');
  const [name, setName] = useState(() => diagramName(request.label, sourceTitle));
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  // The draft shown, and the kind it was drawn as: a change of kind drops it.
  const [preview, setPreview] = useState<{ graph: DiagramSendGraph; kind: DiagramSendKind } | null>(
    null,
  );
  const live = useRef(true);
  const previewRef = useRef<HTMLElement>(null);
  // Connect as tabs (connected-tabs.md "Linked from a Send to"): the source and the diagram, once it is written.
  const destination =
    where.mode === 'update'
      ? { id: where.send.diagram.id, title: where.send.diagram.title }
      : where.mode === 'tab' && where.item
        ? { id: where.item.id, title: where.item.title }
        : null;
  const link = useLinkTabs({
    sourceId: source.itemId,
    targetId: destination?.id ?? null,
    client,
  });

  useEffect(() => {
    // Set on every mount: React's Strict Mode runs this effect, its cleanup, then the effect again.
    live.current = true;
    workbench.track('UI', 'Opened', 'SendToDiagram');
    return () => {
      live.current = false;
    };
  }, []);

  const busy = phase !== 'idle';
  const shown = preview && preview.kind === kind ? preview.graph : null;
  const named = where.mode === 'update' || name.trim() !== '';
  const placed = where.mode !== 'tab' || where.item !== null;
  const ready = !busy && named && placed;

  const draft = async () => {
    if (busy) return;
    setError(null);
    setPhase('drafting');
    try {
      const graph = await drafter({ tabId: request.tabId, words: request.words, kind });
      if (!live.current) return;
      setPreview({ graph, kind });
      setPhase('idle');
      workbench.track('UI', 'Used', 'SendToDiagram');
      requestAnimationFrame(() =>
        previewRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }),
      );
    } catch (err) {
      workbench.track('UI', 'Refused', 'SendToDiagram');
      if (!live.current) return;
      setPhase('idle');
      setError(refusal(err));
    }
  };

  const make = async (graph: DiagramSendGraph) => {
    if (!ready) return;
    setError(null);
    setPhase('drawing');
    const tab = openPendingTab();
    try {
      const target =
        where.mode === 'update'
          ? {
              itemId: where.send.diagram.id,
              // A send that never learnt its tab adds a new one rather than failing.
              ...(where.send.tabId ? { tabId: where.send.tabId } : {}),
            }
          : where.mode === 'tab' && where.item
            ? { itemId: where.item.id }
            : null;
      const {
        link: href,
        item,
        send,
      } = await client.sendToDiagram({
        name: where.mode === 'update' ? where.send.diagram.title || name.trim() : name.trim(),
        graph,
        source: {
          ...source,
          tabId: request.tabId,
          elementId: request.elementId,
          label: request.label,
        },
        ...(target ? { target } : {}),
      });
      workbench.track('UI', 'Created', 'SendToDiagram');
      if (send) addDiagramSend(send);
      void link.finish(send?.diagram.id ?? item.id, {
        source: sourceTitle,
        target: send?.diagram.title || item.title,
      });
      if (tab && !tab.closed) tab.location.href = href;
      else window.open(href, '_blank', 'noopener');
      toast.success(`${ACTION[where.mode].toast}: ${send?.diagram.title || name.trim()}`, {
        action: { label: 'Open Diagram', onSelect: () => window.open(href, '_blank', 'noopener') },
      });
      onClose();
    } catch (err) {
      tab?.close();
      workbench.track('UI', 'Refused', 'SendToDiagram');
      if (!live.current) return;
      setPhase('idle');
      setError(refusal(err));
    }
  };

  const primary = shown
    ? phase === 'drawing'
      ? 'Drawing…'
      : ACTION[where.mode].button
    : phase === 'drafting'
      ? 'Reading…'
      : 'Preview';

  return (
    <Dialog
      open
      onClose={busy ? () => {} : onClose}
      ariaLabel="Send to Diagram"
      size="lg"
      phoneSheet
      className="max-h-[92vh]"
    >
      <HeroDialogHeader
        art={sendToDiagramHeroArt}
        titleId={titleId}
        title="Send to Diagram"
        subtitle="AI draws these words as a diagram in livediagram. They stay as they are here."
        onClose={busy ? undefined : onClose}
      />
      <form
        className="flex min-h-0 flex-1 flex-col"
        aria-labelledby={titleId}
        onSubmit={(e) => {
          e.preventDefault();
          if (shown) void make(shown);
          else void draft();
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-5 sm:px-6">
          <section aria-label="Words" className="flex flex-col gap-2">
            <h3 className={LABEL}>Words</h3>
            <blockquote
              data-send-words=""
              className="relative max-h-[6.5rem] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-4 pl-4 text-sm leading-relaxed whitespace-pre-line text-slate-700 before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-full before:bg-brand-500 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-8 after:bg-gradient-to-t after:from-slate-50 after:to-transparent dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-200 dark:after:from-slate-800/90"
            >
              {request.words}
            </blockquote>
          </section>
          <DiagramWhere
            choice={where}
            onChoice={setWhere}
            earlier={earlier}
            disabled={busy}
            client={client}
          />
          <fieldset className="flex flex-col gap-2" disabled={busy}>
            <legend className={`${LABEL} mb-2`}>Kind</legend>
            <div
              role="radiogroup"
              aria-label="Kind of diagram"
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {DIAGRAM_KINDS.map((k, index) => {
                const on = kind === k.kind;
                const Icon = k.icon;
                return (
                  <button
                    key={k.kind}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    data-kind={k.kind}
                    onClick={() => setKind(k.kind)}
                    onKeyDown={(e) => {
                      const i = DIAGRAM_KINDS.findIndex((x) => x.kind === kind);
                      const step =
                        e.key === 'ArrowRight' || e.key === 'ArrowDown'
                          ? 1
                          : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                            ? -1
                            : 0;
                      if (!step) return;
                      e.preventDefault();
                      const next =
                        DIAGRAM_KINDS[(i + step + DIAGRAM_KINDS.length) % DIAGRAM_KINDS.length]!;
                      setKind(next.kind);
                      const sibling = e.currentTarget.parentElement?.querySelector<HTMLElement>(
                        `[data-kind="${next.kind}"]`,
                      );
                      sibling?.focus();
                    }}
                    tabIndex={on ? 0 : -1}
                    className={`group flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-default disabled:opacity-60 ${
                      index === 0 ? 'col-span-full' : ''
                    } ${
                      on
                        ? 'border-brand-500 bg-brand-50 shadow-[0_0_0_1px_var(--color-brand-500)] dark:border-brand-400 dark:bg-brand-500/10 dark:shadow-[0_0_0_1px_var(--color-brand-400)]'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition ${
                        on
                          ? 'bg-brand-700 text-white dark:bg-brand-600'
                          : 'bg-slate-100 text-slate-500 group-hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
                      }`}
                    >
                      <Icon size={17} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {k.label}
                      </span>
                      <span className="truncate text-xs leading-snug text-slate-500 dark:text-slate-400">
                        {k.line}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          {where.mode === 'update' ? null : (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={nameId} className={LABEL}>
                {where.mode === 'tab' ? 'Tab name' : 'Name'}
              </label>
              <TextInput
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                disabled={busy}
              />
            </div>
          )}
          {where.mode !== 'tab' || where.item ? (
            <LinkTabsOption
              link={link}
              sourceApp={source.app}
              targetApp="livediagram"
              names={{
                source: sourceTitle,
                target: destination?.title ?? (name.trim() || 'the new diagram'),
              }}
            />
          ) : null}
          {shown ? (
            <section
              ref={previewRef}
              aria-label="Preview"
              data-diagram-preview=""
              className="flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className={LABEL}>Preview</h3>
                <button
                  type="button"
                  onClick={() => void draft()}
                  disabled={busy}
                  className="cursor-pointer rounded-md px-1.5 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:cursor-default disabled:opacity-60 dark:text-brand-300 dark:hover:bg-brand-500/10"
                >
                  {phase === 'drafting' ? 'Reading…' : 'Draw Again'}
                </button>
              </div>
              <div
                role="region"
                aria-label="Preview of the diagram"
                tabIndex={0}
                className="h-56 overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-50/70 p-2 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-slate-700/70 dark:bg-slate-800/40"
              >
                <DiagramSketch graph={shown} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {shown.nodes.length} box{shown.nodes.length === 1 ? '' : 'es'}, {shown.edges.length}{' '}
                arrow{shown.edges.length === 1 ? '' : 's'}
                {shown.groups?.length
                  ? `, ${shown.groups.length} group${shown.groups.length === 1 ? '' : 's'}`
                  : ''}
                . livediagram lays it out neatly when it draws.
              </p>
            </section>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <p
            className="mr-auto hidden text-xs text-slate-500 sm:block dark:text-slate-400"
            aria-live="polite"
          >
            {phase === 'drafting'
              ? 'Reading the words…'
              : phase === 'drawing'
                ? 'Drawing the diagram…'
                : shown
                  ? 'Linked back here once drawn.'
                  : 'Preview first: nothing is written yet.'}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={busy}
            className="shrink-0"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={shown ? !ready : busy}
            className="shrink-0 whitespace-nowrap"
          >
            {primary}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
