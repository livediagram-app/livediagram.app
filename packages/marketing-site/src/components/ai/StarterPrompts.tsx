import type { StarterPrompt } from '../../lib/ai-clients';
import { CopyButton } from './CopyButton';

// Try it (docs/specs/019-marketing/build-with-ai.md "The page" 4): starter prompts to paste into a connected tool,
// each a card with its own Copy button.
export function StarterPrompts({ prompts }: { prompts: readonly StarterPrompt[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {prompts.map(({ title, prompt }) => (
        <li
          key={title}
          className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-brand-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/50"
        >
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            “{prompt}”
          </p>
          <CopyButton text={prompt} label="Copy prompt" what={title} className="mt-4 self-start" />
        </li>
      ))}
    </ul>
  );
}
