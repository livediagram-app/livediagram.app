'use client';

// The provider of AI Settings (docs/specs/030-knowledgebase/search-and-ask.md "Providers"): whose key this
// knowledgebase runs on, Anthropic's or OpenAI's. Two bordered rows, each a generic mark and the provider's name as
// text (never a company's logo). Native radios, so the arrow keys move between them and a screen reader says which
// of two. Choosing is the dialog's to act on: with a key saved it asks before the key is replaced.
import { useId, type ReactNode } from 'react';
import type { KnowledgeAiProvider, KnowledgeAiSettings } from '@liveknowledge/api-schema';
import { providerWords } from '@/lib/knowledge-ask/provider-words';
import { ProviderRingIcon, ProviderSparkIcon } from './ask-icons';

const ICONS: Record<KnowledgeAiProvider, ReactNode> = {
  anthropic: <ProviderSparkIcon />,
  openai: <ProviderRingIcon />,
};

const OPTION =
  'flex min-h-12 min-w-0 flex-1 basis-0 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors duration-short motion-reduce:transition-none pointer-coarse:min-h-11 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 has-[:focus-visible]:ring-offset-1 dark:has-[:focus-visible]:ring-offset-slate-900 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60';
const OPTION_ON = 'border-brand-500 bg-brand-50/70 dark:border-brand-400 dark:bg-brand-500/10';
const OPTION_OFF =
  'border-slate-200 hover:border-brand-300 dark:border-slate-700 dark:hover:border-brand-500/60';

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
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="flex flex-col gap-2 sm:flex-row"
      data-ai-providers=""
    >
      {providers.map(({ id, label }) => {
        const on = id === chosen;
        return (
          <label
            key={id}
            className={`${OPTION} ${on ? OPTION_ON : OPTION_OFF}`}
            data-ai-provider={id}
          >
            <input
              type="radio"
              name={name}
              value={id}
              className="sr-only"
              checked={on}
              disabled={disabled}
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
              {ICONS[id] ?? <ProviderSparkIcon />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {label}
              </span>
              <span className="block text-xs text-slate-600 dark:text-slate-400">
                {providerWords(id).about}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
