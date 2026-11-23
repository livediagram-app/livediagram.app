'use client';

// Send to Diagram's picker (liveworkspace/docs/specs/004-index/send-to-diagram.md "The picker"): the words, the kind of
// diagram, its name, and Make Diagram, which asks the app's api for a graph (its own AI) and the index for a new
// livediagram diagram drawn from it, then opens it in a new browser tab. Centred on screen, a bottom sheet on a phone.
// Nothing is made until the index answers; a failure says why here, and the person may try again.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  IndexError,
  type DiagramSendKind,
  type DiagramSendSource,
} from '@liveworkspace/index-client';
import { Button, DialogFooter, TextInput, lucideGlyph } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { sendToDiagramHeroArt } from '@liveworkspace/ui/dialog-hero-art/send-to-diagram';
import {
  lucideCalendarRange,
  lucideLayers,
  lucideShare2,
  lucideSparkles,
  lucideUsers,
  lucideWorkflow,
} from '@liveworkspace/icons/lucide';
import { workbench } from '../../bindings';
import { useToast } from '../../hooks/ui/useToast';
import { indexClient } from '../../lib/index-client';
import { Dialog } from '../dialogs/Dialog';
import type { DiagramDrafter, DiagramSendRequest } from './send-to-diagram-entry';

type Client = Pick<typeof indexClient, 'sendToDiagram'>;

const KINDS: readonly {
  kind: DiagramSendKind;
  label: string;
  line: string;
  icon: (p: { size?: number }) => ReactNode;
}[] = [
  { kind: 'auto', label: 'Auto', line: 'The AI picks', icon: lucideGlyph(lucideSparkles, 18) },
  {
    kind: 'flowchart',
    label: 'Flowchart',
    line: 'Steps and decisions',
    icon: lucideGlyph(lucideWorkflow, 18),
  },
  {
    kind: 'mindmap',
    label: 'Mind Map',
    line: 'Ideas round a topic',
    icon: lucideGlyph(lucideShare2, 18),
  },
  {
    kind: 'orgchart',
    label: 'Org Chart',
    line: 'People and teams',
    icon: lucideGlyph(lucideUsers, 18),
  },
  {
    kind: 'architecture',
    label: 'Architecture',
    line: 'Systems and links',
    icon: lucideGlyph(lucideLayers, 18),
  },
  {
    kind: 'timeline',
    label: 'Timeline',
    line: 'Events in order',
    icon: lucideGlyph(lucideCalendarRange, 18),
  },
];

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
      return "livediagram couldn't draw what the AI made. Try again, or pick a kind.";
    if (err.status === 403 || err.status === 404) return "You can't send words from here.";
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

export function SendToDiagramDialog({
  request,
  source,
  sourceTitle,
  drafter,
  onClose,
  client = indexClient,
}: {
  request: DiagramSendRequest;
  source: Pick<DiagramSendSource, 'app' | 'itemId'>;
  sourceTitle: string;
  drafter: DiagramDrafter;
  onClose: () => void;
  client?: Client;
}) {
  const toast = useToast();
  const titleId = useId();
  const nameId = useId();
  const [kind, setKind] = useState<DiagramSendKind>('auto');
  const [name, setName] = useState(() => diagramName(request.label, sourceTitle));
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const live = useRef(true);

  useEffect(() => {
    workbench.track('UI', 'Opened', 'SendToDiagram');
    return () => {
      live.current = false;
    };
  }, []);

  const busy = phase !== 'idle';
  const ready = !busy && name.trim() !== '';

  const make = async () => {
    if (!ready) return;
    setError(null);
    setPhase('drafting');
    const tab = openPendingTab();
    try {
      const graph = await drafter({ tabId: request.tabId, words: request.words, kind });
      if (!live.current) return tab?.close();
      setPhase('drawing');
      const { link } = await client.sendToDiagram({
        name: name.trim(),
        graph,
        source: {
          ...source,
          tabId: request.tabId,
          elementId: request.elementId,
          label: request.label,
        },
      });
      workbench.track('UI', 'Created', 'SendToDiagram');
      if (tab && !tab.closed) tab.location.href = link;
      else window.open(link, '_blank', 'noopener');
      toast.success(`Diagram made: ${name.trim()}`, {
        action: { label: 'Open Diagram', onSelect: () => window.open(link, '_blank', 'noopener') },
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
          void make();
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-5 sm:px-6">
          <section aria-label="Words" className="flex flex-col gap-2">
            <h3 className={LABEL}>Words</h3>
            <blockquote
              data-send-words=""
              className="relative max-h-[6.5rem] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-4 pl-4 text-sm leading-relaxed whitespace-pre-line text-slate-700 before:absolute before:inset-y-2.5 before:left-0 before:w-[3px] before:rounded-full before:bg-[var(--app-accent,theme(colors.sky.500))] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-8 after:bg-gradient-to-t after:from-slate-50 after:to-transparent dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-200 dark:after:from-slate-800/90"
            >
              {request.words}
            </blockquote>
          </section>
          <fieldset className="flex flex-col gap-2" disabled={busy}>
            <legend className={`${LABEL} mb-2`}>Kind</legend>
            <div
              role="radiogroup"
              aria-label="Kind of diagram"
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {KINDS.map((k) => {
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
                      const i = KINDS.findIndex((x) => x.kind === kind);
                      const step =
                        e.key === 'ArrowRight' || e.key === 'ArrowDown'
                          ? 1
                          : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                            ? -1
                            : 0;
                      if (!step) return;
                      e.preventDefault();
                      const next = KINDS[(i + step + KINDS.length) % KINDS.length]!;
                      setKind(next.kind);
                      const sibling = e.currentTarget.parentElement?.querySelector<HTMLElement>(
                        `[data-kind="${next.kind}"]`,
                      );
                      sibling?.focus();
                    }}
                    tabIndex={on ? 0 : -1}
                    className={`group flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-default disabled:opacity-60 ${
                      on
                        ? 'border-sky-500 bg-sky-50 shadow-[0_0_0_1px_theme(colors.sky.500)] dark:border-sky-400 dark:bg-sky-500/10 dark:shadow-[0_0_0_1px_theme(colors.sky.400)]'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition ${
                        on
                          ? 'bg-sky-500 text-white dark:bg-sky-400 dark:text-slate-900'
                          : 'bg-slate-100 text-slate-500 group-hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
                      }`}
                    >
                      <Icon size={17} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {k.label}
                      </span>
                      <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {k.line}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={nameId} className={LABEL}>
              Name
            </label>
            <TextInput
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              disabled={busy}
            />
          </div>
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
                : 'A new diagram of your own, linked back here.'}
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
          <Button type="submit" disabled={!ready} className="shrink-0 whitespace-nowrap">
            {phase === 'drafting' ? 'Reading…' : phase === 'drawing' ? 'Drawing…' : 'Make Diagram'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
