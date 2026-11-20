import {
  lucideBookOpen,
  lucideFilePlus,
  lucideFileText,
  lucideFlag,
  lucidePencilLine,
  lucideSearch,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

// What it can do (docs/specs/019-marketing/build-with-ai.md "The page" 5): the MCP's tools in plain words. Every
// card maps to a shipped tool (docs/specs/024-agents/knowledgebase-for-agents.md "MCP tools"); a new tool earns a
// card here only once it ships.
const CAPABILITIES = [
  {
    icon: lucideGlyph(lucideBookOpen, 20),
    title: 'Context First',
    body: 'Hands over the pages your team marked Always in Context before the agent starts, within a fixed budget.',
  },
  {
    icon: lucideGlyph(lucideSearch, 20),
    title: 'Search in Passages',
    body: 'Finds the passages that match a question, each with its page, its heading and whether it is verified.',
  },
  {
    icon: lucideGlyph(lucideFileText, 20),
    title: 'Read With Trust',
    body: 'Reads a page as Markdown with who verified it and when, whether its review is due, and what links to it.',
  },
  {
    icon: lucideGlyph(lucidePencilLine, 20),
    title: 'Suggest, Not Overwrite',
    body: 'An edit arrives as a suggestion with its reason. Nothing on the page changes until a person accepts it.',
  },
  {
    icon: lucideGlyph(lucideFlag, 20),
    title: 'Report a Gap',
    body: 'Records a question no page answered, so it shows in AI Knowledge and someone can write the page.',
  },
  {
    icon: lucideGlyph(lucideFilePlus, 20),
    title: 'New Pages',
    body: 'Writes a new page from Markdown under the parent you name. It starts unverified, like any new page.',
  },
];

export function AiCapabilities() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CAPABILITIES.map(({ icon: Icon, title, body }) => (
        <li
          key={title}
          className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <Icon aria-hidden />
          </span>
          <h3 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {body}
          </p>
        </li>
      ))}
    </ul>
  );
}
