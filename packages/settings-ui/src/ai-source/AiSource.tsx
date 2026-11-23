'use client';

// The source line (liveworkspace/docs/specs/003-accounts/ai-keys.md "The source line (AiSource)"): under every AI
// feature's field, which AI it runs on, in one quiet row: a mark, whose AI it is with the provider and model (never any
// part of a key), the feature's allowance on built-in AI, and one action that opens Settings › AI over the dialog.
// Drawn from a line the app's hook worked out (useAiSource); it reads nothing itself.

import { useRef, type ReactNode } from 'react';
import { lucideKey, lucideTriangleAlert } from '@liveworkspace/icons/lucide';
import { SparkleIcon, Tooltip, lucideGlyph } from '@liveworkspace/ui';
import type { AiProviderId } from '../account-panels/ai/ai-keys';
import { PROVIDER_NAMES, type AiSourceLine, type AiSourceOwner } from './ai-source-model';

const KeyGlyph = /* @__PURE__ */ lucideGlyph(lucideKey, 15);
const AlertGlyph = /* @__PURE__ */ lucideGlyph(lucideTriangleAlert, 15);

export type AiSourceProps = {
  line: AiSourceLine | null;
  // The line's action (useAiSource's `act`); none for someone who cannot change what applies.
  act?: (() => void) | null;
  // On built-in AI, the feature's own allowance ("Plans and forms share 10 drafts a day").
  allowance?: ReactNode;
  // What an item's own key is called ("This Knowledgebase's Key"), where the app keeps one.
  itemKeyName?: string;
  // For the field it describes (aria-describedby).
  id?: string;
};

const OWNER_WORDS: Readonly<Record<AiSourceOwner, string>> = {
  you: 'Your Key',
  team: 'Your Team’s Key',
  item: 'Its Own Key',
};

// Each provider's tile in its own tone, so a glance tells built-in AI, Anthropic and OpenAI apart without a logo.
const PROVIDER_TILES: Readonly<Record<AiProviderId, string>> = {
  anthropic:
    'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-200 dark:ring-orange-400/30',
  openai:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/30',
};

const TILE =
  'flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset motion-safe:transition-colors';

// The tile centres a glyph's ink, not its box (docs/specs/004-interface-design/optical-alignment.md): Glyph sets the
// blank margin its drawing leaves as --glyph-ink-t / --glyph-ink-b, and the sparkle's small star leaves more above
// than below, so the box alone sits its ink 0.6px low.
const INK_CENTRED = {
  translate: '0 calc((var(--glyph-ink-b, 0px) - var(--glyph-ink-t, 0px)) / 2)',
} as const;

function Mark({ line }: { line: Exclude<AiSourceLine, { kind: 'loading' }> }) {
  if (line.kind === 'built-in')
    return (
      <span
        aria-hidden
        className={`${TILE} bg-gradient-to-br from-brand-500 to-brand-700 text-white ring-brand-600/40 shadow-sm shadow-brand-500/20 dark:from-brand-400 dark:to-brand-600 dark:ring-brand-300/30`}
      >
        <SparkleIcon size={15} style={INK_CENTRED} />
      </span>
    );
  if (line.kind === 'failed')
    return (
      <span
        aria-hidden
        className={`${TILE} bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/30`}
      >
        <AlertGlyph style={INK_CENTRED} />
      </span>
    );
  return (
    <span aria-hidden className={`${TILE} ${PROVIDER_TILES[line.provider]}`}>
      <KeyGlyph style={INK_CENTRED} />
    </span>
  );
}

const ACTION_WORDS = { 'built-in': 'Use Your Own Key', key: 'Change', failed: 'Fix Key' } as const;

export function AiSource({ line, act, allowance, itemKeyName, id }: AiSourceProps) {
  // Set when the action opens Settings: the focus Settings hands back on closing is the page's, not the person's, so
  // it shows no tooltip (a keyboard close would otherwise count as keyboard focus, and so would a tap's on a phone).
  const returning = useRef(false);
  if (!line) return null;
  if (line.kind === 'loading')
    return (
      <div
        id={id}
        aria-busy
        data-ai-source="loading"
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700/80 dark:bg-slate-900/60"
      >
        <span className="size-8 shrink-0 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none dark:bg-slate-800" />
        <span className="flex flex-1 flex-col gap-1.5">
          <span className="h-3 w-24 animate-pulse rounded bg-slate-200 motion-reduce:animate-none dark:bg-slate-800" />
          <span className="h-2.5 w-40 animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-800/70" />
        </span>
      </div>
    );
  const owner = line.kind === 'built-in' ? null : line.owner;
  const whose = owner === 'item' && itemKeyName ? itemKeyName : owner ? OWNER_WORDS[owner] : null;
  const title =
    line.kind === 'built-in'
      ? 'Built-in AI'
      : line.kind === 'failed'
        ? `${whose} Needs Attention`
        : whose;
  const detail =
    line.kind === 'built-in'
      ? allowance
      : line.kind === 'failed'
        ? line.words
        : `${PROVIDER_NAMES[line.provider]} · ${line.model} · No daily limits`;
  // A member of a team with a key sees it, and who may change it.
  const note =
    line.kind !== 'built-in' && line.owner === 'team' && !line.canChange
      ? 'Only the team’s admins can change it.'
      : null;
  const action = ACTION_WORDS[line.kind];
  const name = `${action}, in Settings › AI`;
  return (
    <div
      id={id}
      data-ai-source={line.kind}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        line.kind === 'failed'
          ? 'border-amber-200 bg-amber-50/60 dark:border-amber-400/30 dark:bg-amber-500/10'
          : 'border-slate-200 bg-white dark:border-slate-700/80 dark:bg-slate-900/60'
      }`}
    >
      <Mark line={line} />
      <p className="min-w-0 flex-1 leading-tight">
        <span className="block text-[13px] font-semibold text-slate-900 dark:text-white">
          {title}
        </span>
        {detail ? (
          <span
            className={`mt-0.5 block text-[12px] ${
              line.kind === 'failed'
                ? 'text-amber-900 dark:text-amber-100'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {detail}
            {note ? ` ${note}` : null}
          </span>
        ) : null}
      </p>
      {act ? (
        <Tooltip label={name}>
          <button
            type="button"
            aria-label={name}
            onClick={() => {
              returning.current = true;
              act();
            }}
            onFocus={(event) => {
              if (!returning.current) return;
              returning.current = false;
              // Kept from the tooltip's wrapper, which opens on keyboard focus.
              event.stopPropagation();
            }}
            className="relative shrink-0 cursor-pointer rounded-md px-2 py-1 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:hover:bg-brand-100 touch-target-y dark:text-brand-200 dark:hover:bg-brand-500/15 dark:hover:text-brand-100 dark:active:hover:bg-brand-500/25"
          >
            {action}
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}
