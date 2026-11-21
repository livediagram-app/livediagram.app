'use client';

// Which AI and whose key, in AI Settings (docs/specs/030-knowledgebase/search-and-ask.md "AI Settings",
// "Providers"): built-in AI or the team's own key, and for a key, Anthropic's or OpenAI's. Two bordered rows, each a generic mark and the provider's name as
// text (never a company's logo). Native radios, so the arrow keys move between them and a screen reader says which
// of two. Choosing is the dialog's to act on: with a key saved it asks before the key is replaced.
import { useId, type ReactNode } from 'react';
import type { KnowledgeAiProvider, KnowledgeAiSettings } from '@liveknowledge/api-schema';
import { providerWords } from '@/lib/knowledge-ask/provider-words';
import { BuiltInAiIcon, KeyIcon, ProviderRingIcon, ProviderSparkIcon } from './ask-icons';

const ICONS: Record<KnowledgeAiProvider, ReactNode> = {
  anthropic: <ProviderSparkIcon />,
  openai: <ProviderRingIcon />,
};

const OPTION =
  'flex min-h-12 min-w-0 flex-1 basis-0 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors duration-short motion-reduce:transition-none pointer-coarse:min-h-11 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 has-[:focus-visible]:ring-offset-1 dark:has-[:focus-visible]:ring-offset-slate-900 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60';
const OPTION_ON = 'border-brand-500 bg-brand-50/70 dark:border-brand-400 dark:bg-brand-500/10';
const OPTION_OFF =
  'border-slate-200 hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-500/60';

/** One choice of a row group. */
export type AiChoice<Id extends string> = {
  id: Id;
  label: string;
  about: string;
  icon: ReactNode;
  /** A small pill after the label ("Included"). */
  pill?: string;
  /** Cannot be chosen here (built-in AI on a server without it). */
  unavailable?: boolean;
};

/** Bordered rows of native radios, one chosen: the provider, or which AI. */
export function AiChoiceRows<Id extends string>({
  choices,
  chosen,
  disabled,
  labelledBy,
  onChoose,
  data,
}: {
  choices: readonly AiChoice<Id>[];
  chosen: Id;
  disabled?: boolean;
  labelledBy: string;
  onChoose: (id: Id) => void;
  /** The group's data attribute, for tests and the sweep. */
  data: 'providers' | 'source';
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="flex flex-col gap-2 sm:flex-row"
      {...{ [`data-ai-${data}`]: '' }}
    >
      {choices.map(({ id, label, about, icon, pill, unavailable }) => {
        const on = id === chosen;
        return (
          <label
            key={id}
            className={`${OPTION} ${on ? OPTION_ON : OPTION_OFF}`}
            {...{ [`data-ai-${data === 'providers' ? 'provider' : 'source-choice'}`]: id }}
          >
            <input
              type="radio"
              name={name}
              value={id}
              className="sr-only"
              checked={on}
              disabled={disabled || unavailable}
              // A controlled radio: it moves only when the dialog takes the choice (after its question, with a key
              // saved).
              onChange={() => onChoose(id)}
            />
            <span
              aria-hidden
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                on
                  ? 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {icon}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {label}
                </span>
                {pill ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-px text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/30">
                    {pill}
                  </span>
                ) : null}
              </span>
              <span className="block text-xs text-slate-600 dark:text-slate-400">{about}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Whose key: Anthropic's or OpenAI's. */
export function AiProviderPicker({
  providers,
  chosen,
  disabled,
  labelledBy,
  onChoose,
}: {
  providers: KnowledgeAiSettings['providers'];
  chosen: KnowledgeAiProvider;
  disabled?: boolean;
  labelledBy: string;
  onChoose: (provider: KnowledgeAiProvider) => void;
}) {
  return (
    <AiChoiceRows
      data="providers"
      choices={providers.map(({ id, label }) => ({
        id,
        label,
        about: providerWords(id).about,
        icon: ICONS[id] ?? <ProviderSparkIcon />,
      }))}
      chosen={chosen}
      {...(disabled === undefined ? {} : { disabled })}
      labelledBy={labelledBy}
      onChoose={onChoose}
    />
  );
}

/** Which AI the knowledgebase runs on: built-in AI, or the team's own key. */
export type AiSource = 'built-in' | 'own-key';

export function AiSourcePicker({
  chosen,
  builtIn,
  disabled,
  labelledBy,
  onChoose,
}: {
  chosen: AiSource;
  /** Whether this server has built-in AI. */
  builtIn: boolean;
  disabled?: boolean;
  labelledBy: string;
  onChoose: (source: AiSource) => void;
}) {
  return (
    <AiChoiceRows<AiSource>
      data="source"
      choices={[
        {
          id: 'built-in',
          label: 'Built-In AI',
          about: builtIn ? 'Included. No key needed.' : 'Not set up on this server.',
          icon: <BuiltInAiIcon />,
          ...(builtIn ? { pill: 'Included' } : { unavailable: true }),
        },
        {
          id: 'own-key',
          label: 'Your Own Key',
          about: 'Anthropic or OpenAI, billed to your team.',
          icon: <KeyIcon />,
        },
      ]}
      chosen={chosen}
      {...(disabled === undefined ? {} : { disabled })}
      labelledBy={labelledBy}
      onChoose={onChoose}
    />
  );
}
