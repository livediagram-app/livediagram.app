'use client';

import {
  lucideAppWindow,
  lucideArrowDown,
  lucideExternalLink,
  lucideLink,
  lucideMessagesSquare,
  lucideSquareCode,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedesign/ui';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

import { AI_CLIENT_GROUPS, AI_CLIENTS, type AiClient, type AiClientGroup } from '@/lib/ai-clients';

import { CodeSnippet } from './CodeSnippet';
import { StepText } from './StepText';

// Pick your tool (docs/specs/019-marketing/build-with-ai.md "The page" 3): a tab per client, grouped, its steps in
// the panel beside. The choice mirrors into the URL hash so `/ai#cursor` opens on Cursor. Every panel is in the
// HTML (inactive ones `hidden`), so the instructions are indexable and the first one reads before hydration.
// Tabs follow the WAI-ARIA pattern: roving tabIndex, arrows / Home / End move and select.

// Generic glyphs per group, never third-party logos.
const GROUP_ICONS: Record<AiClientGroup, ReturnType<typeof lucideGlyph>> = {
  'Chat apps': lucideGlyph(lucideMessagesSquare, 18),
  'Coding agents': lucideGlyph(lucideSquareCode, 18),
  Editors: lucideGlyph(lucideAppWindow, 18),
  'Anything else': lucideGlyph(lucideLink, 18),
};
const ExternalIcon = lucideGlyph(lucideExternalLink, 14);
const DownIcon = lucideGlyph(lucideArrowDown, 14);

const groupId = (group: AiClientGroup) => `ai-group-${group.toLowerCase().replace(/\s+/g, '-')}`;

const ORDERED = AI_CLIENT_GROUPS.flatMap((g) => AI_CLIENTS.filter((c) => c.group === g));

export function ClientPicker() {
  const [active, setActive] = useState(ORDERED[0]!.id);
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});

  // The list runs down the side from lg, across the top below it: its orientation follows, so a screen reader's
  // arrow-key hint matches what is on screen (both pairs of arrows move either way).
  const [vertical, setVertical] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 64rem)');
    const sync = () => setVertical(wide.matches);
    sync();
    wide.addEventListener('change', sync);
    return () => wide.removeEventListener('change', sync);
  }, []);

  // A hash naming a client opens on it (on arrival and when the hash changes in place). Before paint, so a deep
  // link swaps from the static first client to its own in the hydrating render, not a frame later.
  useLayoutEffect(() => {
    function fromHash(scroll: boolean) {
      const id = window.location.hash.slice(1);
      if (!ORDERED.some((c) => c.id === id)) return;
      setActive(id);
      if (scroll) {
        requestAnimationFrame(() =>
          document.getElementById('connect')?.scrollIntoView({ block: 'start' }),
        );
      }
    }
    fromHash(true);
    const onHash = () => fromHash(false);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function select(id: string, focus = false) {
    setActive(id);
    try {
      window.history.replaceState(null, '', `#${id}`);
    } catch {
      // A sandboxed frame may refuse; the tab still switches.
    }
    if (focus) tabs.current[id]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const i = ORDERED.findIndex((c) => c.id === active);
    const last = ORDERED.length - 1;
    const next =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? i === last
          ? 0
          : i + 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? i === 0
            ? last
            : i - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    select(ORDERED[next]!.id, true);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
      <div
        role="tablist"
        aria-label="AI tools"
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {ORDERED.map((client, i) => {
          const Icon = GROUP_ICONS[client.group];
          const selected = client.id === active;
          const firstOfGroup = i === 0 || ORDERED[i - 1]!.group !== client.group;
          return (
            <div key={client.id} role="presentation" className="contents">
              {firstOfGroup ? (
                <p
                  aria-hidden
                  id={groupId(client.group)}
                  className={`hidden px-3 text-xs font-semibold tracking-wider text-slate-600 uppercase lg:block dark:text-slate-400 ${
                    i === 0 ? '' : 'mt-4'
                  }`}
                >
                  {client.group}
                </p>
              ) : null}
              <button
                ref={(el) => {
                  tabs.current[client.id] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${client.id}`}
                aria-selected={selected}
                aria-controls={`panel-${client.id}`}
                // The group heading is not a tab, so it cannot sit in the list for a screen reader: each tab is
                // described by its group instead ("Claude, tab, Chat apps").
                aria-describedby={groupId(client.group)}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(client.id)}
                onKeyDown={onKeyDown}
                className={`group flex shrink-0 cursor-pointer snap-start items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 lg:w-full ${
                  selected
                    ? 'border-brand-300 bg-white shadow-sm dark:border-brand-500/50 dark:bg-slate-900'
                    : 'border-transparent bg-white/60 hover:border-slate-200 hover:bg-white max-lg:border-slate-200 dark:bg-slate-900/40 dark:hover:border-slate-700 dark:hover:bg-slate-900 max-lg:dark:border-slate-800'
                }`}
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition ${
                    selected
                      ? 'bg-brand-700 text-white dark:bg-brand-500 dark:text-slate-950'
                      : 'bg-slate-100 text-slate-600 group-hover:text-brand-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:text-brand-300'
                  }`}
                >
                  <Icon aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold whitespace-nowrap text-slate-900 dark:text-slate-100">
                    {client.name}
                  </span>
                  <span className="hidden truncate text-xs text-slate-500 lg:block dark:text-slate-400">
                    {client.blurb}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {ORDERED.map((client) => (
        <ClientPanel key={client.id} client={client} hidden={client.id !== active} />
      ))}
    </div>
  );
}

function ClientPanel({ client, hidden }: { client: AiClient; hidden: boolean }) {
  return (
    <section
      role="tabpanel"
      id={`panel-${client.id}`}
      aria-labelledby={`tab-${client.id}`}
      hidden={hidden}
      tabIndex={0}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:p-8 dark:border-slate-700 dark:bg-slate-900"
    >
      <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        Connect {client.name}
      </h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{client.blurb}</p>

      <ol className="mt-6 space-y-6">
        {client.steps.map((step, i) => (
          <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20"
            >
              <span className="text-optical-centre">{i + 1}</span>
            </span>
            <div className="min-w-0 space-y-3 pt-1">
              <p className="leading-relaxed text-slate-700 dark:text-slate-200">
                <StepText text={step.text} />
              </p>
              {step.action ? (
                <a
                  href={step.action.href}
                  {...(step.action.external
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 dark:bg-brand-500 dark:text-slate-950 dark:hover:bg-brand-400"
                >
                  <span className="text-optical-line">{step.action.label}</span>
                  {step.action.external ? (
                    <>
                      <ExternalIcon aria-hidden />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </>
                  ) : null}
                </a>
              ) : null}
              {step.code ? (
                <CodeSnippet code={step.code.code} lang={step.code.lang} label={step.code.label} />
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {client.note ? (
        <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          {client.note}
        </p>
      ) : null}

      <a
        href="#prompts"
        className="mt-6 inline-flex min-h-6 items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
      >
        Connected? Try a prompt
        <DownIcon aria-hidden />
      </a>
    </section>
  );
}
